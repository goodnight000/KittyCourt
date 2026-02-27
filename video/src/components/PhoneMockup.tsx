import React from "react";

export const PhoneMockup: React.FC<{
  children: React.ReactNode;
  scale?: number;
}> = ({ children, scale = 1 }) => {
  const phoneWidth = 340;
  const phoneHeight = 700;
  const borderRadius = 44;
  const bezelWidth = 8;

  return (
    <div
      style={{
        width: phoneWidth * scale,
        height: phoneHeight * scale,
        position: "relative",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {/* Phone outer shell */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: borderRadius,
          background: "linear-gradient(145deg, #2D221A, #1a1310)",
          boxShadow:
            "0 25px 60px rgba(0,0,0,0.4), 0 10px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      />
      {/* Phone screen area */}
      <div
        style={{
          position: "absolute",
          top: bezelWidth,
          left: bezelWidth,
          right: bezelWidth,
          bottom: bezelWidth,
          borderRadius: borderRadius - bezelWidth,
          overflow: "hidden",
          background: "#FFFBF5",
        }}
      >
        {/* Dynamic Island / Notch */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 32,
            borderRadius: 16,
            background: "#1a1310",
            zIndex: 10,
          }}
        />
        {/* Screen content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
