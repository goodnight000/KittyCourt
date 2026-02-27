import React from "react";

export const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow:
          "0 4px 24px rgba(74, 55, 40, 0.08), 0 1px 4px rgba(74, 55, 40, 0.04)",
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
