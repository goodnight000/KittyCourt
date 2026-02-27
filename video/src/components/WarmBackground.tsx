import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../colors";

export const WarmBackground: React.FC<{
  variant?: "cream" | "gold" | "brown";
}> = ({ variant = "cream" }) => {
  const frame = useCurrentFrame();

  const gradients = {
    cream: `linear-gradient(145deg, ${COLORS.cream} 0%, ${COLORS.ivory} 40%, ${COLORS.tan}44 100%)`,
    gold: `linear-gradient(145deg, ${COLORS.cream} 0%, ${COLORS.goldLight}66 50%, ${COLORS.cream} 100%)`,
    brown: `linear-gradient(145deg, ${COLORS.brownDark} 0%, ${COLORS.brown} 50%, ${COLORS.maroon}88 100%)`,
  };

  // Slowly moving ambient orbs
  const orbX = interpolate(frame, [0, 300], [0, 40], {
    extrapolateRight: "clamp",
  });
  const orbY = interpolate(frame, [0, 300], [0, -30], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: gradients[variant],
        }}
      />
      {/* Ambient gold orb */}
      <div
        style={{
          position: "absolute",
          top: `${30 + orbY * 0.3}%`,
          right: `${-10 + orbX * 0.2}%`,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.gold}22 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      {/* Ambient blush orb */}
      <div
        style={{
          position: "absolute",
          bottom: `${20 - orbY * 0.2}%`,
          left: `${-5 + orbX * 0.15}%`,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.blush}22 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
    </AbsoluteFill>
  );
};
