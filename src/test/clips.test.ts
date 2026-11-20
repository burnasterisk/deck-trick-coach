import { describe, expect, it } from "vitest";

import {
  detectMistakeHighlight,
  encodeSlowMoClipVideo,
  isRealTrickMotion,
  type ClipFrame,
} from "@/lib/clips";
import type { Attempt } from "@/lib/trick-analyzer";

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 1,
    trickId: "kickflip",
    setup: "wood",
    score: 64,
    trickMatched: true,
    matchConfidence: 82,
    detectedMotionLabel: "Kickflip",
    failureReasons: [],
    correctionArrows: [
      {
        target: "index",
        label: "FLICK EARLIER",
        fromOffset: { x: 0, y: 0 },
        ctrlOffset: { x: 0.04, y: -0.08 },
        toOffset: { x: 0.09, y: -0.05 },
        tone: "primary",
      },
    ],
    replayFrames: [
      {
        tMs: 0,
        index: { x: 0.45, y: 0.78 },
        middle: { x: 0.55, y: 0.78 },
        boardPitchDeg: 0,
        flipDeg: 0,
        wristRotDeg: 0,
      },
      {
        tMs: 60,
        index: { x: 0.47, y: 0.62 },
        middle: { x: 0.55, y: 0.65 },
        boardPitchDeg: 10,
        flipDeg: 90,
        wristRotDeg: 4,
      },
      {
        tMs: 140,
        index: { x: 0.51, y: 0.48 },
        middle: { x: 0.56, y: 0.5 },
        boardPitchDeg: 4,
        flipDeg: 210,
        wristRotDeg: 6,
      },
      {
        tMs: 240,
        index: { x: 0.56, y: 0.62 },
        middle: { x: 0.57, y: 0.62 },
        boardPitchDeg: 2,
        flipDeg: 320,
        wristRotDeg: 5,
      },
      {
        tMs: 320,
        index: { x: 0.56, y: 0.78 },
        middle: { x: 0.57, y: 0.78 },
        boardPitchDeg: 0,
        flipDeg: 355,
        wristRotDeg: 4,
      },
    ],
    diagnosis: {
      title: "CLEAN POP",
      advice: "Clean catch.",
      tip: "Pop higher.",
      whyFailed: "Locked smoothly.",
    },
    metrics: {
      peakPop: 0.24,
      spread: 0.11,
      flick: 0.045,
      levelness: 0.01,
      popTiming: "crisp",
      popLeadMs: 30,
      flipRotationDeg: 350,
    },
    ...overrides,
  };
}

function makeClipFrames(): ClipFrame[] {
  return [
    // pre-roll (0, 1)
    {
      tMs: -90,
      phase: "pre",
      index: { x: 0.45, y: 0.78 },
      middle: { x: 0.55, y: 0.78 },
      boardPitchDeg: 0,
      flipDeg: 0,
      wristRotDeg: 0,
    },
    {
      tMs: -30,
      phase: "pre",
      index: { x: 0.48, y: 0.78 },
      middle: { x: 0.55, y: 0.78 },
      boardPitchDeg: 0,
      flipDeg: 0,
      wristRotDeg: 0,
    },
    // pop (2)
    {
      tMs: 0,
      phase: "air",
      index: { x: 0.49, y: 0.72 },
      middle: { x: 0.55, y: 0.74 },
      boardPitchDeg: 8,
      flipDeg: 20,
      wristRotDeg: 2,
    },
    // apex (3) -> min average y = 0.46
    {
      tMs: 110,
      phase: "air",
      index: { x: 0.5, y: 0.46 },
      middle: { x: 0.56, y: 0.46 },
      boardPitchDeg: 2,
      flipDeg: 180,
      wristRotDeg: 4,
    },
    // late flick velocity peak (4) -> dx = 0.09
    {
      tMs: 190,
      phase: "air",
      index: { x: 0.59, y: 0.52 },
      middle: { x: 0.58, y: 0.54 },
      boardPitchDeg: 12,
      flipDeg: 280,
      wristRotDeg: 6,
    },
    // steep early drop (5) -> dy = +0.23
    {
      tMs: 260,
      phase: "land",
      index: { x: 0.6, y: 0.76 },
      middle: { x: 0.6, y: 0.76 },
      boardPitchDeg: 18,
      flipDeg: 310,
      wristRotDeg: 5,
    },
    {
      tMs: 310,
      phase: "land",
      index: { x: 0.6, y: 0.78 },
      middle: { x: 0.6, y: 0.78 },
      boardPitchDeg: 0,
      flipDeg: 320,
      wristRotDeg: 2,
    },
  ];
}

describe("isRealTrickMotion", () => {
  it("rejects minor resting lifts and micro-jitters without pop and flick", () => {
    const minorLift = makeAttempt({
      metrics: {
        peakPop: 0.032,
        spread: 0.05,
        flick: 0.004,
        levelness: 0.01,
      },
    });
    expect(isRealTrickMotion(minorLift)).toBe(false);

    const tooBrief = makeAttempt({
      replayFrames: [
        {
          tMs: 0,
          index: { x: 0.5, y: 0.7 },
          middle: { x: 0.6, y: 0.7 },
          boardPitchDeg: 0,
          flipDeg: 0,
          wristRotDeg: 0,
        },
        {
          tMs: 30,
          index: { x: 0.5, y: 0.6 },
          middle: { x: 0.6, y: 0.6 },
          boardPitchDeg: 0,
          flipDeg: 0,
          wristRotDeg: 0,
        },
      ],
    });
    expect(isRealTrickMotion(tooBrief)).toBe(false);
  });

  it("accepts real trick attempts with genuine pop and flick/flip motion", () => {
    expect(isRealTrickMotion(makeAttempt())).toBe(true);
  });
});

describe("detectMistakeHighlight", () => {
  it("highlights the exact post-apex frame for late flicks", () => {
    const frames = makeClipFrames();
    const attempt = makeAttempt({
      score: 62,
      diagnosis: {
        title: "LATE FLICK",
        advice: "Flick earlier.",
        tip: "Snap and whip immediately.",
        whyFailed: "Flicked after apex.",
      },
      metrics: {
        peakPop: 0.28,
        spread: 0.12,
        flick: 0.09,
        levelness: 0.02,
        popTiming: "late-flick",
        popLeadMs: 165,
      },
    });

    const hl = detectMistakeHighlight(frames, attempt);
    expect(hl.severity).toBe("mistake");
    expect(hl.tag).toBe("LATE FLICK");
    expect(hl.frameIndex).toBe(4);
    expect(hl.arrows.length).toBeGreaterThan(0);
  });

  it("highlights the steep drop frame for early drops / missed grind locks", () => {
    const frames = makeClipFrames();
    const attempt = makeAttempt({
      trickId: "50-50",
      score: 52,
      trickMatched: false,
      diagnosis: {
        title: "MISSED GRIND LOCK",
        advice: "Hold apex.",
        tip: "Level over coping.",
        whyFailed: "Dropped off rail early.",
      },
      metrics: {
        peakPop: 0.28,
        spread: 0.11,
        flick: 0.03,
        levelness: 0.02,
        grindHoldMs: 32,
      },
    });

    const hl = detectMistakeHighlight(frames, attempt);
    expect(hl.severity).toBe("mistake");
    expect(hl.tag).toBe("EARLY DROP");
    expect(hl.frameIndex).toBe(5);
  });

  it("highlights early pre-pop slide and clean apex catches accurately", () => {
    const frames = makeClipFrames();
    const earlySlide = makeAttempt({
      score: 58,
      diagnosis: {
        title: "EARLY SLIDE",
        advice: "Wait for tail click.",
        tip: "Snap first.",
        whyFailed: "Slid pre-snap.",
      },
      metrics: {
        peakPop: 0.25,
        spread: 0.11,
        flick: 0.05,
        levelness: 0.01,
        popTiming: "early-slide",
        popLeadMs: -35,
      },
    });

    const earlyHl = detectMistakeHighlight(frames, earlySlide);
    expect(earlyHl.severity).toBe("mistake");
    expect(earlyHl.tag).toBe("EARLY SLIDE");
    expect(earlyHl.frameIndex).toBe(1);

    const cleanAttempt = makeAttempt({ score: 91, trickMatched: true });
    const cleanHl = detectMistakeHighlight(frames, cleanAttempt);
    expect(cleanHl.severity).toBe("clean");
    expect(cleanHl.tag).toBe("CLEAN CATCH");
    expect(cleanHl.frameIndex).toBe(3);
  });
});

describe("encodeSlowMoClipVideo", () => {
  it("returns null gracefully when MediaRecorder is unavailable", async () => {
    const frames = makeClipFrames();
    const attempt = makeAttempt();
    const clip = {
      frames,
      mistake: detectMistakeHighlight(frames, attempt),
      mirrored: false,
      trickName: "Kickflip",
      setup: "wood" as const,
      attempt,
      width: 320,
      height: 180,
    };
    const res = await encodeSlowMoClipVideo(clip, () => null);
    expect(res).toBeNull();
  });
});
