import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../colors";
import { WarmBackground } from "../components/WarmBackground";
import { ScreenshotPhone } from "../components/ScreenshotPhone";
import { quicksandFamily } from "../fonts";

/**
 * Date Planning Scene (210 frames = 7s @ 30fps)
 *
 * 0-105: calendar screenshot
 *   Text: "Plan dates that feel personal"
 *
 * 105-210: ai-plan screenshot
 *   Text: "AI remembers your story"
 */
export const DatePlanningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone entrance
  const phoneEntrance = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const phoneY = interpolate(phoneEntrance, [0, 1], [400, 0]);

  // Phase transition
  const isPhase2 = frame >= 105;
  const phase2Opacity = isPhase2
    ? interpolate(frame, [105, 120], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Text 1
  const text1Spring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 200 },
  });
  const text1Opacity = isPhase2
    ? interpolate(frame, [100, 110], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : text1Spring;
  const text1Y = interpolate(text1Spring, [0, 1], [30, 0]);

  // Text 2
  const text2Spring = spring({
    frame: Math.max(0, frame - 120),
    fps,
    config: { damping: 200 },
  });
  const text2Y = interpolate(text2Spring, [0, 1], [30, 0]);

  return (
    <AbsoluteFill>
      <WarmBackground variant="cream" />

      {/* Narrative text - Phase 1 */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0 60px",
          opacity: text1Opacity,
          transform: `translateY(${text1Y}px)`,
        }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            fontFamily: quicksandFamily,
            color: COLORS.brown,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          Plan dates that{"\n"}feel personal
        </div>
      </div>

      {/* Narrative text - Phase 2 */}
      {isPhase2 && (
        <div
          style={{
            position: "absolute",
            top: 150,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 60px",
            opacity: text2Spring,
            transform: `translateY(${text2Y}px)`,
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              fontFamily: quicksandFamily,
              color: COLORS.brown,
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            AI remembers{"\n"}your story
          </div>
        </div>
      )}

      {/* Phone with screenshots */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: `translateX(-50%) translateY(${phoneY}px)`,
          opacity: phoneEntrance,
        }}
      >
        <ScreenshotPhone
          screenshot1="calendar.png"
          screenshot2="ai-plan.png"
          crossfadeAt={105}
          crossfadeDuration={15}
        />
      </div>
    </AbsoluteFill>
  );
};
