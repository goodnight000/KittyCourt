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
import { nunitoFamily, quicksandFamily } from "../fonts";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 12 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);

  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200 },
  });

  const ctaSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 15 },
  });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.8, 1]);

  const features = [
    { icon: "\u2696", text: "AI Dispute Resolution" },
    { icon: "\u{1F431}", text: "Daily Check-ins" },
    { icon: "\u{1F4C5}", text: "AI Date Planning" },
  ];

  // Floating hearts
  const hearts = Array.from({ length: 6 }, (_, i) => {
    const heartFrame = frame - i * 8;
    const progress = interpolate(heartFrame, [0, 90], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const x = 100 + i * 160 + Math.sin(heartFrame * 0.05 + i) * 30;
    const y = interpolate(progress, [0, 1], [1920, -100]);
    const heartOpacity = interpolate(
      progress,
      [0, 0.1, 0.8, 1],
      [0, 0.4, 0.4, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { x, y, opacity: heartOpacity, size: 16 + (i % 3) * 8 };
  });

  // Gold shimmer
  const shimmerX = interpolate(frame, [20, 80], [-300, 1380], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <WarmBackground variant="cream" />

      {/* Floating hearts */}
      {hearts.map((heart, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: heart.x,
            top: heart.y,
            fontSize: heart.size,
            opacity: heart.opacity,
          }}
        >
          {"\u{1F496}"}
        </div>
      ))}

      {/* Gold shimmer */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: shimmerX,
            width: 300,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${COLORS.gold}44, transparent)`,
          }}
        />
      </div>

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
        }}
      >
        {/* App icon */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 40,
            overflow: "hidden",
            transform: `scale(${logoScale})`,
            opacity: logoSpring,
            boxShadow: `0 20px 60px ${COLORS.gold}44`,
          }}
        >
          <Img
            src={staticFile("assets/logo.png")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* App name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            fontFamily: quicksandFamily,
            background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.maroon} 100%)`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            opacity: titleSpring,
            letterSpacing: 3,
          }}
        >
          Pause
        </div>

        {/* Features list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "center",
          }}
        >
          {features.map((feat, i) => {
            const featSpring = spring({
              frame: frame - 15 - i * 6,
              fps,
              config: { damping: 200 },
            });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: featSpring,
                  transform: `translateY(${interpolate(featSpring, [0, 1], [20, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `${COLORS.goldLight}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  {feat.icon}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    fontFamily: nunitoFamily,
                    color: COLORS.brown,
                  }}
                >
                  {feat.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 20,
            transform: `scale(${ctaScale})`,
            opacity: ctaSpring,
          }}
        >
          <div
            style={{
              background: `linear-gradient(160deg, ${COLORS.gold}, ${COLORS.goldDark})`,
              color: COLORS.white,
              padding: "20px 60px",
              borderRadius: 30,
              fontSize: 28,
              fontWeight: 800,
              fontFamily: nunitoFamily,
              boxShadow: `0 8px 32px ${COLORS.gold}66`,
              letterSpacing: 1,
            }}
          >
            Download Pause
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
