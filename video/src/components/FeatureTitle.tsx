import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../colors";
import { nunitoFamily, quicksandFamily } from "../fonts";

export const FeatureTitle: React.FC<{
  title: string;
  subtitle: string;
  delay?: number;
  icon?: string;
}> = ({ title, subtitle, delay = 0, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const subtitleEntrance = spring({
    frame: frame - delay - 8,
    fps,
    config: { damping: 200 },
  });

  const y = interpolate(entrance, [0, 1], [60, 0]);
  const subtitleY = interpolate(subtitleEntrance, [0, 1], [40, 0]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: 56,
            opacity: entrance,
            transform: `translateY(${y}px)`,
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          fontFamily: quicksandFamily,
          color: COLORS.brown,
          textAlign: "center",
          opacity: entrance,
          transform: `translateY(${y}px)`,
          lineHeight: 1.2,
          padding: "0 40px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 400,
          fontFamily: nunitoFamily,
          color: COLORS.brownLight,
          textAlign: "center",
          opacity: subtitleEntrance,
          transform: `translateY(${subtitleY}px)`,
          padding: "0 60px",
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};
