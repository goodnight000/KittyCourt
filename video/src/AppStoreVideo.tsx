import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { IntroScene } from "./scenes/IntroScene";
import { CourtScene } from "./scenes/CourtScene";
import { DailyMeowScene } from "./scenes/DailyMeowScene";
import { DatePlanningScene } from "./scenes/DatePlanningScene";
import { OutroScene } from "./scenes/OutroScene";

// 30fps, 30 seconds total = 900 frames
// Scene durations (in frames):
const INTRO = 120; // 4s  - Logo + "Every couple disagrees sometimes..."
const COURT = 270; // 9s  - court-idle → evidence → verdict
const DAILY = 240; // 8s  - daily-mood → daily-done
const DATES = 210; // 7s  - calendar → ai-plan
const OUTRO = 120; // 4s  - Logo + features + "Download Pause"
const TRANSITION = 15; // 0.5s each

// Total = 120+270+240+210+120 - 4*15 = 960-60 = 900 frames = 30s

export const AppStoreVideo: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Scene 1: Intro */}
      <TransitionSeries.Sequence durationInFrames={INTRO}>
        <IntroScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      {/* Scene 2: Court Feature */}
      <TransitionSeries.Sequence durationInFrames={COURT}>
        <CourtScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      {/* Scene 3: Daily Check-ins */}
      <TransitionSeries.Sequence durationInFrames={DAILY}>
        <DailyMeowScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      {/* Scene 4: Date Planning */}
      <TransitionSeries.Sequence durationInFrames={DATES}>
        <DatePlanningScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      {/* Scene 5: Outro */}
      <TransitionSeries.Sequence durationInFrames={OUTRO}>
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
