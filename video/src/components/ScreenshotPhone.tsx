import React from "react";
import {
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { PhoneMockup } from "./PhoneMockup";

/**
 * Displays a phone mockup with one or two screenshots.
 * If two screenshots are provided, crossfades from the first to the second
 * at the specified `crossfadeAt` frame within the local timeline.
 */
export const ScreenshotPhone: React.FC<{
  screenshot1: string;
  screenshot2?: string;
  crossfadeAt?: number;
  crossfadeDuration?: number;
}> = ({
  screenshot1,
  screenshot2,
  crossfadeAt = 60,
  crossfadeDuration = 20,
}) => {
  const frame = useCurrentFrame();

  const secondOpacity = screenshot2
    ? interpolate(
        frame,
        [crossfadeAt, crossfadeAt + crossfadeDuration],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  return (
    <PhoneMockup>
      {/* First screenshot */}
      <Img
        src={staticFile(`screenshots/${screenshot1}`)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {/* Second screenshot (crossfade) */}
      {screenshot2 && secondOpacity > 0 && (
        <Img
          src={staticFile(`screenshots/${screenshot2}`)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: secondOpacity,
          }}
        />
      )}
    </PhoneMockup>
  );
};
