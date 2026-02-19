#!/usr/bin/env python3
"""Wave 4 iOS runtime profiling for auth startup and transitions.

Runs deterministic, headless-friendly measurements using Playwright WebKit
with an iPhone device profile, then writes JSON + Markdown reports.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median
from typing import Any

from playwright.sync_api import Page, sync_playwright


AUTH_ENTRY_ROUTE = "/signin"
AUTH_ROUTE_MARKERS: dict[str, str] = {
    "/signin": 'a[href="/signup"]',
    "/signup": 'a[href="/signin"]',
    "/forgot-password": 'a[href="/signin"]',
}
TRANSITIONS: list[tuple[str, str, str]] = [
    ("/signin", "/signup", 'a[href="/signup"]'),
    ("/signup", "/signin", 'a[href="/signin"]'),
    ("/signin", "/forgot-password", 'a[href="/forgot-password"]'),
    ("/forgot-password", "/signin", 'a[href="/signin"]'),
]


NAVIGATION_METRICS_JS = """
() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paints = performance.getEntriesByType('paint')
  const paintMap = {}
  for (const paint of paints) {
    paintMap[paint.name] = Number(paint.startTime.toFixed(3))
  }

  if (!nav) {
    return { navigation: null, paint: paintMap, route: window.location.pathname }
  }

  return {
    navigation: {
      unloadEventEnd: Number(nav.unloadEventEnd.toFixed(3)),
      redirectCount: nav.redirectCount,
      domainLookupStart: Number(nav.domainLookupStart.toFixed(3)),
      domainLookupEnd: Number(nav.domainLookupEnd.toFixed(3)),
      connectStart: Number(nav.connectStart.toFixed(3)),
      secureConnectionStart: Number(nav.secureConnectionStart.toFixed(3)),
      connectEnd: Number(nav.connectEnd.toFixed(3)),
      requestStart: Number(nav.requestStart.toFixed(3)),
      responseStart: Number(nav.responseStart.toFixed(3)),
      responseEnd: Number(nav.responseEnd.toFixed(3)),
      domInteractive: Number(nav.domInteractive.toFixed(3)),
      domContentLoadedEventStart: Number(nav.domContentLoadedEventStart.toFixed(3)),
      domContentLoadedEventEnd: Number(nav.domContentLoadedEventEnd.toFixed(3)),
      domComplete: Number(nav.domComplete.toFixed(3)),
      loadEventStart: Number(nav.loadEventStart.toFixed(3)),
      loadEventEnd: Number(nav.loadEventEnd.toFixed(3))
    },
    paint: paintMap,
    route: window.location.pathname
  }
}
"""

FPS_SAMPLE_JS = """
async ({ durationMs }) => {
  const stamps = []
  return await new Promise((resolve) => {
    let start = null

    const step = (ts) => {
      if (start === null) {
        start = ts
      }
      stamps.push(ts)

      if (ts - start >= durationMs) {
        const frameDeltas = []
        for (let i = 1; i < stamps.length; i += 1) {
          frameDeltas.push(stamps[i] - stamps[i - 1])
        }

        const duration = frameDeltas.reduce((sum, v) => sum + v, 0)
        const fps = duration > 0 ? (frameDeltas.length / duration) * 1000 : 0
        const sorted = [...frameDeltas].sort((a, b) => a - b)
        const p95Idx = sorted.length > 0 ? Math.max(0, Math.ceil(sorted.length * 0.95) - 1) : 0
        const p95FrameMs = sorted.length > 0 ? sorted[p95Idx] : 0
        const droppedFrameRatio = frameDeltas.length > 0
          ? frameDeltas.filter((d) => d > 24).length / frameDeltas.length
          : 0

        resolve({
          avgFps: Number(fps.toFixed(3)),
          p95FrameMs: Number(p95FrameMs.toFixed(3)),
          droppedFrameRatio: Number(droppedFrameRatio.toFixed(4)),
          totalFrames: frameDeltas.length,
          sampleDurationMs: Number(duration.toFixed(3))
        })
        return
      }

      requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  })
}
"""

TRANSITION_FPS_JS = """
async ({ selector, expectedPath, sampleMs, timeoutMs }) => {
  const isVisible = (el) => {
    if (!el) return false
    const style = window.getComputedStyle(el)
    if (!style) return false
    if (style.visibility === 'hidden' || style.display === 'none') return false
    return el.getClientRects().length > 0
  }

  const candidates = Array.from(document.querySelectorAll(selector))
  const target = candidates.find(isVisible) || candidates[0] || null
  if (!target) {
    return { error: `No transition target found for selector: ${selector}` }
  }

  const startPath = window.location.pathname
  const frameStamps = []
  let captureFrames = true

  const frameStep = (ts) => {
    frameStamps.push(ts)
    if (captureFrames) {
      requestAnimationFrame(frameStep)
    }
  }
  requestAnimationFrame(frameStep)

  const navStart = performance.now()
  target.click()

  let navEnd = null
  const navDeadline = navStart + timeoutMs
  while (performance.now() < navDeadline) {
    if (window.location.pathname === expectedPath) {
      navEnd = performance.now()
      break
    }
    await new Promise((r) => setTimeout(r, 16))
  }

  const elapsed = performance.now() - navStart
  if (elapsed < sampleMs) {
    await new Promise((r) => setTimeout(r, sampleMs - elapsed))
  }

  captureFrames = false

  const frameDeltas = []
  for (let i = 1; i < frameStamps.length; i += 1) {
    frameDeltas.push(frameStamps[i] - frameStamps[i - 1])
  }
  const frameDuration = frameDeltas.reduce((sum, v) => sum + v, 0)
  const fps = frameDuration > 0 ? (frameDeltas.length / frameDuration) * 1000 : 0
  const sorted = [...frameDeltas].sort((a, b) => a - b)
  const p95Idx = sorted.length > 0 ? Math.max(0, Math.ceil(sorted.length * 0.95) - 1) : 0
  const p95FrameMs = sorted.length > 0 ? sorted[p95Idx] : 0
  const droppedFrameRatio = frameDeltas.length > 0
    ? frameDeltas.filter((d) => d > 24).length / frameDeltas.length
    : 0

  return {
    from: startPath,
    to: window.location.pathname,
    expectedTo: expectedPath,
    navigationDurationMs: navEnd !== null ? Number((navEnd - navStart).toFixed(3)) : null,
    reachedExpectedPath: window.location.pathname === expectedPath,
    avgFps: Number(fps.toFixed(3)),
    p95FrameMs: Number(p95FrameMs.toFixed(3)),
    droppedFrameRatio: Number(droppedFrameRatio.toFixed(4)),
    totalFrames: frameDeltas.length,
    sampleDurationMs: Number(frameDuration.toFixed(3))
  }
}
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Profile iOS-like runtime performance for auth startup and route transitions "
            "using Playwright WebKit + iPhone device emulation."
        )
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:5173", help="App base URL")
    parser.add_argument("--startup-runs", type=int, default=3, help="Number of startup runs")
    parser.add_argument(
        "--transition-rounds",
        type=int,
        default=2,
        help="Number of full auth transition rounds",
    )
    parser.add_argument(
        "--startup-fps-sample-ms",
        type=int,
        default=3000,
        help="Startup FPS sample window in milliseconds",
    )
    parser.add_argument(
        "--transition-fps-sample-ms",
        type=int,
        default=1800,
        help="Transition FPS sample window in milliseconds",
    )
    parser.add_argument(
        "--transition-timeout-ms",
        type=int,
        default=5000,
        help="Transition path-change timeout in milliseconds",
    )
    parser.add_argument(
        "--output-json",
        default="client/perf/wave4_ios_perf_report.json",
        help="Output path for JSON report",
    )
    parser.add_argument(
        "--output-md",
        default="client/perf/wave4_ios_perf_report.md",
        help="Output path for Markdown summary",
    )
    return parser.parse_args()


def visible_selector_wait(page: Page, selector: str, timeout_ms: int = 15000) -> None:
    page.wait_for_function(
        """
        (sel) => {
          return Array.from(document.querySelectorAll(sel)).some((el) => {
            const style = window.getComputedStyle(el)
            if (!style) return false
            if (style.visibility === 'hidden' || style.display === 'none') return false
            return el.getClientRects().length > 0
          })
        }
        """,
        arg=selector,
        timeout=timeout_ms,
    )


def wait_for_route_ready(page: Page, route: str) -> None:
    page.wait_for_function("(path) => window.location.pathname === path", arg=route, timeout=15000)
    marker = AUTH_ROUTE_MARKERS[route]
    visible_selector_wait(page, marker, timeout_ms=15000)
    page.wait_for_timeout(250)


def safe_round(value: float | None, places: int = 3) -> float | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return round(float(value), places)


def collect_startup_runs(
    base_url: str,
    startup_runs: int,
    startup_fps_sample_ms: int,
) -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []
    with sync_playwright() as pw:
        iphone = pw.devices["iPhone 13"]
        browser = pw.webkit.launch(headless=True)
        try:
            for run_id in range(1, startup_runs + 1):
                context = browser.new_context(
                    **iphone,
                    locale="en-US",
                    timezone_id="UTC",
                )
                page = context.new_page()

                page.goto(f"{base_url}{AUTH_ENTRY_ROUTE}", wait_until="domcontentloaded")
                wait_for_route_ready(page, AUTH_ENTRY_ROUTE)

                navigation = page.evaluate(NAVIGATION_METRICS_JS)
                startup_fps = page.evaluate(FPS_SAMPLE_JS, {"durationMs": startup_fps_sample_ms})

                runs.append(
                    {
                        "run": run_id,
                        "route": page.url,
                        "metrics": {
                            "navigation": navigation.get("navigation"),
                            "paint": navigation.get("paint"),
                            "startupFps": startup_fps,
                        },
                    }
                )
                context.close()
        finally:
            browser.close()
    return runs


def collect_transition_rounds(
    base_url: str,
    transition_rounds: int,
    transition_fps_sample_ms: int,
    transition_timeout_ms: int,
) -> list[dict[str, Any]]:
    rounds: list[dict[str, Any]] = []
    with sync_playwright() as pw:
        iphone = pw.devices["iPhone 13"]
        browser = pw.webkit.launch(headless=True)
        try:
            for round_id in range(1, transition_rounds + 1):
                context = browser.new_context(
                    **iphone,
                    locale="en-US",
                    timezone_id="UTC",
                )
                page = context.new_page()
                page.goto(f"{base_url}{AUTH_ENTRY_ROUTE}", wait_until="domcontentloaded")
                wait_for_route_ready(page, AUTH_ENTRY_ROUTE)

                transition_entries: list[dict[str, Any]] = []
                for source_route, expected_route, selector in TRANSITIONS:
                    if page.evaluate("() => window.location.pathname") != source_route:
                        page.goto(f"{base_url}{source_route}", wait_until="domcontentloaded")
                        wait_for_route_ready(page, source_route)

                    result = page.evaluate(
                        TRANSITION_FPS_JS,
                        {
                            "selector": selector,
                            "expectedPath": expected_route,
                            "sampleMs": transition_fps_sample_ms,
                            "timeoutMs": transition_timeout_ms,
                        },
                    )
                    if result.get("error"):
                        raise RuntimeError(result["error"])

                    wait_for_route_ready(page, expected_route)
                    transition_entries.append(
                        {
                            "from": source_route,
                            "to": expected_route,
                            "selector": selector,
                            "metrics": result,
                        }
                    )

                rounds.append({"round": round_id, "transitions": transition_entries})
                context.close()
        finally:
            browser.close()
    return rounds


def aggregate_startup(startup_runs: list[dict[str, Any]]) -> dict[str, Any]:
    nav_fields = [
        "responseStart",
        "responseEnd",
        "domInteractive",
        "domContentLoadedEventEnd",
        "domComplete",
        "loadEventEnd",
    ]
    paint_fields = ["first-paint", "first-contentful-paint"]
    fps_fields = ["avgFps", "p95FrameMs", "droppedFrameRatio"]

    nav_summary: dict[str, float | None] = {}
    for field in nav_fields:
        vals = [
            run["metrics"]["navigation"][field]
            for run in startup_runs
            if run["metrics"]["navigation"] and field in run["metrics"]["navigation"]
        ]
        nav_summary[field] = safe_round(median(vals), 3) if vals else None

    paint_summary: dict[str, float | None] = {}
    for field in paint_fields:
        vals = [
            run["metrics"]["paint"].get(field)
            for run in startup_runs
            if run["metrics"]["paint"] and run["metrics"]["paint"].get(field) is not None
        ]
        paint_summary[field] = safe_round(median(vals), 3) if vals else None

    fps_summary: dict[str, float | None] = {}
    for field in fps_fields:
        vals = [
            run["metrics"]["startupFps"][field]
            for run in startup_runs
            if run["metrics"]["startupFps"] and run["metrics"]["startupFps"].get(field) is not None
        ]
        fps_summary[field] = safe_round(median(vals), 4 if field == "droppedFrameRatio" else 3) if vals else None

    return {
        "navigationMsMedian": nav_summary,
        "paintMsMedian": paint_summary,
        "startupFpsMedian": fps_summary,
    }


def aggregate_transitions(transition_rounds: list[dict[str, Any]]) -> dict[str, Any]:
    by_edge: dict[str, list[dict[str, Any]]] = {}
    for round_entry in transition_rounds:
        for transition in round_entry["transitions"]:
            edge_key = f'{transition["from"]}->{transition["to"]}'
            by_edge.setdefault(edge_key, []).append(transition["metrics"])

    summary: dict[str, Any] = {}
    for edge, metrics_list in by_edge.items():
        fps_vals = [m["avgFps"] for m in metrics_list if m.get("avgFps") is not None]
        p95_vals = [m["p95FrameMs"] for m in metrics_list if m.get("p95FrameMs") is not None]
        drop_vals = [m["droppedFrameRatio"] for m in metrics_list if m.get("droppedFrameRatio") is not None]
        nav_vals = [m["navigationDurationMs"] for m in metrics_list if m.get("navigationDurationMs") is not None]
        reach_rate = mean([1.0 if m.get("reachedExpectedPath") else 0.0 for m in metrics_list])

        summary[edge] = {
            "avgFpsMean": safe_round(mean(fps_vals), 3) if fps_vals else None,
            "avgFpsMedian": safe_round(median(fps_vals), 3) if fps_vals else None,
            "p95FrameMsMedian": safe_round(median(p95_vals), 3) if p95_vals else None,
            "droppedFrameRatioMedian": safe_round(median(drop_vals), 4) if drop_vals else None,
            "navigationDurationMsMedian": safe_round(median(nav_vals), 3) if nav_vals else None,
            "expectedPathReachRate": safe_round(reach_rate, 4),
            "samples": len(metrics_list),
        }

    return summary


def write_json(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def build_markdown(report: dict[str, Any]) -> str:
    startup = report["startup"]["summary"]
    transitions = report["transitions"]["summaryByRouteEdge"]
    startup_fps = startup["startupFpsMedian"]
    startup_nav = startup["navigationMsMedian"]
    startup_paint = startup["paintMsMedian"]

    lines: list[str] = []
    lines.append("# Wave 4 iOS Runtime Profiling Report")
    lines.append("")
    lines.append(f"- Timestamp (UTC): {report['meta']['generatedAtUtc']}")
    lines.append(f"- Base URL: {report['meta']['baseUrl']}")
    lines.append(f"- Browser/device: {report['meta']['browser']} / {report['meta']['deviceProfile']}")
    lines.append(f"- Startup runs: {report['config']['startupRuns']}")
    lines.append(f"- Transition rounds: {report['config']['transitionRounds']}")
    lines.append("")
    lines.append("## Startup (`/signin`)")
    lines.append("")
    lines.append("| Metric | Median (ms) |")
    lines.append("|---|---:|")
    lines.append(f"| responseStart | {startup_nav.get('responseStart')} |")
    lines.append(f"| responseEnd | {startup_nav.get('responseEnd')} |")
    lines.append(f"| domInteractive | {startup_nav.get('domInteractive')} |")
    lines.append(f"| domContentLoadedEventEnd | {startup_nav.get('domContentLoadedEventEnd')} |")
    lines.append(f"| domComplete | {startup_nav.get('domComplete')} |")
    lines.append(f"| loadEventEnd | {startup_nav.get('loadEventEnd')} |")
    lines.append(f"| first-paint | {startup_paint.get('first-paint')} |")
    lines.append(f"| first-contentful-paint | {startup_paint.get('first-contentful-paint')} |")
    lines.append("")
    lines.append("| Startup FPS Metric | Median |")
    lines.append("|---|---:|")
    lines.append(f"| avgFps | {startup_fps.get('avgFps')} |")
    lines.append(f"| p95FrameMs | {startup_fps.get('p95FrameMs')} |")
    lines.append(f"| droppedFrameRatio | {startup_fps.get('droppedFrameRatio')} |")
    lines.append("")
    lines.append("## Auth Route Transition FPS")
    lines.append("")
    lines.append("| Transition | avgFps (mean) | avgFps (median) | p95FrameMs (median) | droppedFrameRatio (median) | navDurationMs (median) | path reach rate |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|")
    for edge, vals in transitions.items():
        lines.append(
            f"| {edge} | {vals.get('avgFpsMean')} | {vals.get('avgFpsMedian')} | "
            f"{vals.get('p95FrameMsMedian')} | {vals.get('droppedFrameRatioMedian')} | "
            f"{vals.get('navigationDurationMsMedian')} | {vals.get('expectedPathReachRate')} |"
        )

    lines.append("")
    lines.append("## Caveats")
    lines.append("")
    for caveat in report["caveats"]:
        lines.append(f"- {caveat}")

    return "\n".join(lines) + "\n"


def write_markdown(path: Path, markdown: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown, encoding="utf-8")


def main() -> None:
    args = parse_args()
    base_url = args.base_url.rstrip("/")

    startup_runs = collect_startup_runs(
        base_url=base_url,
        startup_runs=args.startup_runs,
        startup_fps_sample_ms=args.startup_fps_sample_ms,
    )
    transition_rounds = collect_transition_rounds(
        base_url=base_url,
        transition_rounds=args.transition_rounds,
        transition_fps_sample_ms=args.transition_fps_sample_ms,
        transition_timeout_ms=args.transition_timeout_ms,
    )

    report: dict[str, Any] = {
        "meta": {
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "baseUrl": base_url,
            "browser": "webkit",
            "deviceProfile": "iPhone 13",
        },
        "config": {
            "startupRuns": args.startup_runs,
            "transitionRounds": args.transition_rounds,
            "startupFpsSampleMs": args.startup_fps_sample_ms,
            "transitionFpsSampleMs": args.transition_fps_sample_ms,
            "transitionTimeoutMs": args.transition_timeout_ms,
            "authEntryRoute": AUTH_ENTRY_ROUTE,
            "transitions": [
                {"from": from_route, "to": to_route, "selector": selector}
                for from_route, to_route, selector in TRANSITIONS
            ],
        },
        "startup": {
            "runs": startup_runs,
            "summary": aggregate_startup(startup_runs),
        },
        "transitions": {
            "rounds": transition_rounds,
            "summaryByRouteEdge": aggregate_transitions(transition_rounds),
        },
        "caveats": [
            "Metrics are captured in headless WebKit using iPhone device emulation; absolute FPS may differ from physical iOS hardware.",
            "Startup navigation timing reflects warm local dev-server conditions after helper startup, not app-store cold boot.",
            "Transition FPS samples use in-app Link clicks and requestAnimationFrame windows around route changes.",
        ],
    }

    output_json = Path(args.output_json)
    output_md = Path(args.output_md)
    write_json(output_json, report)
    write_markdown(output_md, build_markdown(report))

    print(f"Wrote JSON report: {output_json}")
    print(f"Wrote Markdown report: {output_md}")


if __name__ == "__main__":
    main()
