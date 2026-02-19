# Wave 4 iOS Runtime Profiling Report

- Timestamp (UTC): 2026-02-19T03:41:37.668197+00:00
- Base URL: http://127.0.0.1:5173
- Browser/device: webkit / iPhone 13
- Startup runs: 3
- Transition rounds: 2

## Startup (`/signin`)

| Metric | Median (ms) |
|---|---:|
| responseStart | 7.0 |
| responseEnd | 7.0 |
| domInteractive | 16.0 |
| domContentLoadedEventEnd | 175.0 |
| domComplete | 255.0 |
| loadEventEnd | 256.0 |
| first-paint | None |
| first-contentful-paint | 275.0 |

| Startup FPS Metric | Median |
|---|---:|
| avgFps | 60.0 |
| p95FrameMs | 18.0 |
| droppedFrameRatio | 0.0 |

## Auth Route Transition FPS

| Transition | avgFps (mean) | avgFps (median) | p95FrameMs (median) | droppedFrameRatio (median) | navDurationMs (median) | path reach rate |
|---|---:|---:|---:|---:|---:|---:|
| /signin->/signup | 60.045 | 60.045 | 18.0 | 0.0 | 1.5 | 1.0 |
| /signup->/signin | 59.989 | 59.989 | 18.0 | 0.0 | 0.0 | 1.0 |
| /signin->/forgot-password | 59.254 | 59.254 | 18.0 | 0.0048 | 1.0 | 1.0 |
| /forgot-password->/signin | 60.079 | 60.079 | 18.0 | 0.0093 | 0.5 | 1.0 |

## Caveats

- Metrics are captured in headless WebKit using iPhone device emulation; absolute FPS may differ from physical iOS hardware.
- Startup navigation timing reflects warm local dev-server conditions after helper startup, not app-store cold boot.
- Transition FPS samples use in-app Link clicks and requestAnimationFrame windows around route changes.
