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
 * Daily Meow Scene (240 frames = 8s @ 30fps)
 *
 * 0-120: daily-mood screenshot
 *   Text: "Stay connected every day"
 *
 * 120-240: daily-done screenshot
 *   Text: "Share what matters most"
 */
export const DailyMeowScene: React.FC = () => {
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
  const isPhase2 = frame >= 120;
  const phase2Opacity = isPhase2
    ? interpolate(frame, [120, 135], [0, 1], {
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
    ? interpolate(frame, [115, 125], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : text1Spring;
  const text1Y = interpolate(text1Spring, [0, 1], [30, 0]);

  // Text 2
  const text2Spring = spring({
    frame: Math.max(0, frame - 135),
    fps,
    config: { damping: 200 },
  });
  const text2Y = interpolate(text2Spring, [0, 1], [30, 0]);

  return (
    <AbsoluteFill>
      <WarmBackground variant="gold" />

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
          Stay connected{"\n"}every day
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
            Share what{"\n"}matters most
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
          screenshot1="daily-mood.png"
          screenshot2="daily-done.png"
          crossfadeAt={120}
          crossfadeDuration={15}
        />
      </div>
    </AbsoluteFill>
  );
};
