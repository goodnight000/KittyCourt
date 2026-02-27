import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { COLORS } from "../colors";
import { WarmBackground } from "../components/WarmBackground";
import { ScreenshotPhone } from "../components/ScreenshotPhone";
import { nunitoFamily, quicksandFamily } from "../fonts";

/**
 * Court Scene (270 frames = 9s @ 30fps)
 *
 * 0-120: court-idle → court-evidence crossfade at frame 70
 *   Text: "When you can't see eye to eye..."
 *
 * 120-270: court-verdict
 *   Text: "Let a wise cat judge help you both grow"
 */
export const CourtScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone entrance
  const phoneEntrance = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const phoneY = interpolate(phoneEntrance, [0, 1], [400, 0]);

  // Phase 1 (0-120): idle → evidence
  const isPhase2 = frame >= 120;
  const phase2Opacity = isPhase2
    ? interpolate(frame, [120, 135], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Text animations
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

  const text2Spring = spring({
    frame: Math.max(0, frame - 135),
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
          top: 140,
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
          When you can't see{"\n"}eye to eye...
        </div>
      </div>

      {/* Narrative text - Phase 2 */}
      {isPhase2 && (
        <div
          style={{
            position: "absolute",
            top: 140,
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
              fontSize: 38,
              fontWeight: 700,
              fontFamily: quicksandFamily,
              color: COLORS.brown,
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            Let a wise cat judge{"\n"}help you both grow
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
        {/* Phase 1 phone: idle → evidence crossfade */}
        <div style={{ opacity: 1 - phase2Opacity }}>
          <ScreenshotPhone
            screenshot1="court-idle.png"
            screenshot2="court-evidence.png"
            crossfadeAt={70}
            crossfadeDuration={15}
          />
        </div>
        {/* Phase 2 phone: verdict */}
        {isPhase2 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: phase2Opacity,
            }}
          >
            <ScreenshotPhone screenshot1="court-verdict.png" />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
