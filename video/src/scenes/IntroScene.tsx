import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
  Sequence,
} from "remotion";
import { COLORS } from "../colors";
import { WarmBackground } from "../components/WarmBackground";
import { nunitoFamily, quicksandFamily } from "../fonts";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance - bouncy spring
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.3, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  // Title entrance
  const titleSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 200 },
  });
  const titleY = interpolate(titleSpring, [0, 1], [50, 0]);

  // Tagline entrance
  const taglineSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 200 },
  });
  const taglineY = interpolate(taglineSpring, [0, 1], [30, 0]);

  // Sparkle particles
  const sparkles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const delay = i * 5 + 20;
    const sparkleSpring = spring({
      frame: frame - delay,
      fps,
      config: { damping: 15 },
    });
    const distance = interpolate(sparkleSpring, [0, 1], [0, 180 + i * 20]);
    const sparkleOpacity = interpolate(
      frame - delay,
      [0, 15, 40],
      [0, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { angle, distance, opacity: sparkleOpacity, size: 8 + (i % 3) * 4 };
  });

  // Gold shimmer line
  const shimmerX = interpolate(frame, [40, 90], [-200, 1280], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <WarmBackground variant="cream" />

      {/* Decorative gold circles */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: `2px solid ${COLORS.gold}22`,
          opacity: interpolate(frame, [0, 30], [0, 0.5], {
            extrapolateRight: "clamp",
          }),
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 300,
          right: -80,
          width: 250,
          height: 250,
          borderRadius: "50%",
          border: `2px solid ${COLORS.gold}22`,
          opacity: interpolate(frame, [0, 30], [0, 0.5], {
            extrapolateRight: "clamp",
          }),
        }}
      />

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Sparkle particles */}
        {sparkles.map((sparkle, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "38%",
              left: "50%",
              width: sparkle.size,
              height: sparkle.size,
              borderRadius: "50%",
              background:
                i % 2 === 0 ? COLORS.gold : COLORS.blush,
              opacity: sparkle.opacity,
              transform: `translate(${Math.cos(sparkle.angle) * sparkle.distance}px, ${Math.sin(sparkle.angle) * sparkle.distance}px)`,
            }}
          />
        ))}

        {/* App icon */}
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 44,
            overflow: "hidden",
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            boxShadow: `0 20px 60px ${COLORS.gold}44, 0 8px 20px rgba(0,0,0,0.1)`,
            marginBottom: 40,
          }}
        >
          <Img
            src={staticFile("assets/logo.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        {/* App name */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            fontFamily: quicksandFamily,
            background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.maroon} 100%)`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            opacity: titleSpring,
            transform: `translateY(${titleY}px)`,
            letterSpacing: 4,
          }}
        >
          Pause
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 30,
            fontWeight: 400,
            fontFamily: nunitoFamily,
            color: COLORS.brownLight,
            opacity: taglineSpring,
            transform: `translateY(${taglineY}px)`,
            marginTop: 16,
            textAlign: "center",
            lineHeight: 1.5,
            padding: "0 80px",
          }}
        >
          Every couple disagrees{"\n"}sometimes...
        </div>

        {/* Gold shimmer line */}
        <Sequence from={40} layout="none">
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              width: 1080,
              height: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: shimmerX - 200,
                width: 200,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${COLORS.gold}66, transparent)`,
              }}
            />
          </div>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
