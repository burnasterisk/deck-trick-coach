import { describe, expect, it } from "vitest";

import { TrickAnalyzer, type Tips } from "@/lib/trick-analyzer";

const SURFACE_Y = 0.8;

function tipsAt(indexY: number, middleY: number, x = 0.5, spread = 0.11): Tips {
  return { index: { x: x - spread / 2, y: indexY }, middle: { x: x + spread / 2, y: middleY } };
}

/** Simulates a pop: rise to `peak` over `upMs`, hang, fall back over `downMs`. */
function runPop(
  analyzer: TrickAnalyzer,
  opts: {
    peak?: number;
    upMs?: number;
    downMs?: number;
    landIndexY?: number;
    landMiddleY?: number;
    levelness?: number;
  } = {},
) {
  const { peak = 0.5, upMs = 180, downMs = 200, landIndexY, landMiddleY, levelness = 0.01 } = opts;
  let attempt = null;
  let t = 0;
  const step = (y: number, dt: number) => {
    t += dt;
    const a = analyzer.feed(tipsAt(y, y + levelness), SURFACE_Y, t, false, "ollie");
    if (a) attempt = a;
  };
  // Settle at rest so the analyzer learns the rest level.
  for (let i = 0; i < 60; i++) step(SURFACE_Y, 16);
  // Pop up.
  const frames = Math.ceil(upMs / 16);
  for (let i = 1; i <= frames; i++) step(SURFACE_Y - (SURFACE_Y - peak) * (i / frames), 16);
  // Hang.
  for (let i = 0; i < 6; i++) step(peak, 16);
  // Fall back.
  const down = Math.ceil(downMs / 16);
  for (let i = 1; i <= down; i++) {
    const y = peak + (SURFACE_Y - peak) * (i / down);
    const idxY = landIndexY ?? y;
    const midY = landMiddleY ?? y + levelness;
    const a = analyzer.feed(tipsAt(idxY, midY), SURFACE_Y, (t += 16), false, "ollie");
    if (a) attempt = a;
  }
  return attempt;
}

describe("TrickAnalyzer", () => {
  it("does not fire from resting noise", () => {
    const analyzer = new TrickAnalyzer();
    for (let t = 16; t <= 3000; t += 16) {
      const jitter = SURFACE_Y + Math.sin(t / 200) * 0.004;
      expect(analyzer.feed(tipsAt(jitter, jitter), SURFACE_Y, t, false, "ollie")).toBeNull();
    }
  });

  it("detects a clean pop and scores it highly", () => {
    const analyzer = new TrickAnalyzer();
    const attempt = runPop(analyzer, { peak: 0.45, levelness: 0.005 });
    expect(attempt).not.toBeNull();
    expect(attempt!.metrics.peakPop).toBeGreaterThan(0.25);
    expect(attempt!.metrics.levelness).toBeLessThan(0.02);
    expect(attempt!.score).toBeGreaterThanOrEqual(78);
    expect(attempt!.diagnosis.title).toBe("CLEAN POP");
  });

  it("flags a rocket ollie when the catch is nose-high", () => {
    const analyzer = new TrickAnalyzer();
    const attempt = runPop(analyzer, {
      peak: 0.4,
      landIndexY: SURFACE_Y - 0.12,
      landMiddleY: SURFACE_Y - 0.02,
    });
    expect(attempt).not.toBeNull();
    expect(attempt!.diagnosis.title).toBe("ROCKET OLLIE");
  });

  it("scores a dead pop low", () => {
    const analyzer = new TrickAnalyzer();
    const attempt = runPop(analyzer, { peak: SURFACE_Y - 0.07, upMs: 100 });
    expect(attempt).not.toBeNull();
    expect(attempt!.metrics.peakPop).toBeLessThan(0.075);
    expect(attempt!.diagnosis.title).toBe("DEAD POP");
  });

  it("aborts when tracking is lost mid-air", () => {
    const analyzer = new TrickAnalyzer();
    let t = 0;
    for (let i = 0; i < 60; i++)
      analyzer.feed(tipsAt(SURFACE_Y, SURFACE_Y), SURFACE_Y, (t += 16), false, "ollie");
    for (let i = 0; i < 15; i++)
      analyzer.feed(tipsAt(SURFACE_Y - 0.3, SURFACE_Y - 0.3), SURFACE_Y, (t += 16), false, "ollie");
    // Hand leaves frame well past the lost-tracking window.
    expect(analyzer.feed(null, SURFACE_Y, t + 500, false, "ollie")).toBeNull();
    expect(
      analyzer.feed(tipsAt(SURFACE_Y, SURFACE_Y), SURFACE_Y, t + 516, false, "ollie"),
    ).toBeNull();
  });

  it("ignores a second pop inside the cooldown", () => {
    const analyzer = new TrickAnalyzer();
    const first = runPop(analyzer, { peak: 0.45 });
    expect(first).not.toBeNull();
    const second = runPop(analyzer, { peak: 0.45 });
    expect(second).toBeNull();
  });

  it("adjusts pop sensitivity between plastic sandpaper and wood foam setups", () => {
    // A shallow 5.6% rise triggers plastic (0.05 threshold) but is filtered out on wood (0.065 threshold).
    const plasticAnalyzer = new TrickAnalyzer("plastic");
    const woodAnalyzer = new TrickAnalyzer("wood");
    const shallowPeak = SURFACE_Y - 0.058;

    const plasticAttempt = runPop(plasticAnalyzer, { peak: shallowPeak, upMs: 120 });
    const woodAttempt = runPop(woodAnalyzer, { peak: shallowPeak, upMs: 120 });

    expect(plasticAttempt).not.toBeNull();
    expect(plasticAttempt!.setup).toBe("plastic");
    expect(woodAttempt).toBeNull();
  });

  it("tailors coaching terminology to plastic sandpaper vs wood foam setups", () => {
    const plasticAttempt = runPop(new TrickAnalyzer("plastic"), { peak: 0.45, levelness: 0.005 });
    const woodAttempt = runPop(new TrickAnalyzer("wood"), { peak: 0.45, levelness: 0.005 });

    expect(plasticAttempt).not.toBeNull();
    expect(woodAttempt).not.toBeNull();
    expect(plasticAttempt!.diagnosis.advice.toLowerCase()).toMatch(/plastic|sandpaper/);
    expect(woodAttempt!.diagnosis.advice.toLowerCase()).toMatch(/foam|5-ply|maple/);
  });

  it("detects primo, rocket, and sketchy landings from board pitch and flip rotation", () => {
    const analyzer = new TrickAnalyzer("wood");
    const roi = { x: 0.3, y: 0.5, width: 0.4, height: 0.25 };

    let t = 0;
    const feedWithBoard = (
      indexY: number,
      middleY: number,
      pitchDeg: number,
      flipRateDegPerSec: number,
      primoScore: number,
    ) => {
      t += 16;
      return analyzer.feed(tipsAt(indexY, middleY), SURFACE_Y, t, false, "kickflip", "wood", 1, {
        detected: true,
        boundingBox: roi,
        pitchDeg,
        flipRateDegPerSec,
        primoScore,
        aspectRatio: primoScore > 0.5 ? 0.8 : 0.3,
        flowVectors: [],
        meanFlow: { x: 0, y: 0 },
      });
    };

    // Settle at rest, pop high, and land on the rail (primo).
    for (let i = 0; i < 60; i++) feedWithBoard(SURFACE_Y, SURFACE_Y, 0, 0, 0.1);
    for (let i = 1; i <= 10; i++) {
      const y = SURFACE_Y - 0.35 * (i / 10);
      feedWithBoard(y, y, 5, 900, 0.2);
    }
    let primoAttempt = null;
    for (let i = 1; i <= 14; i++) {
      const progress = Math.min(1, i / 10);
      const y = SURFACE_Y - 0.35 + 0.35 * progress;
      const res = feedWithBoard(y, y, 4, 0, i >= 10 ? 0.78 : 0.4);
      if (res) primoAttempt = res;
    }

    expect(primoAttempt).not.toBeNull();
    expect(primoAttempt!.metrics.landingKind).toBe("primo");
    expect(primoAttempt!.diagnosis.title).toBe("PRIMO LANDING");

    // Advance past cooldown and test rocket landing (high board pitchDeg >= 18).
    t += 1500;
    for (let i = 0; i < 60; i++) feedWithBoard(SURFACE_Y, SURFACE_Y, 0, 0, 0.1);
    for (let i = 1; i <= 10; i++) {
      const y = SURFACE_Y - 0.35 * (i / 10);
      feedWithBoard(y, y, 12, 1800, 0.1);
    }
    let rocketAttempt = null;
    for (let i = 1; i <= 14; i++) {
      const progress = Math.min(1, i / 10);
      const y = SURFACE_Y - 0.35 + 0.35 * progress;
      const res = feedWithBoard(y, y, 22, 0, 0.1);
      if (res) rocketAttempt = res;
    }

    expect(rocketAttempt).not.toBeNull();
    expect(rocketAttempt!.metrics.landingKind).toBe("rocket");
    expect(rocketAttempt!.metrics.boardPitchDeg).toBe(22);
    expect(rocketAttempt!.diagnosis.title).toBe("ROCKET OLLIE");

    // Advance past cooldown and test sketchy landing (moderate pitch ~13 deg on a completed flip).
    t += 1500;
    for (let i = 0; i < 60; i++) feedWithBoard(SURFACE_Y, SURFACE_Y, 0, 0, 0.1);
    for (let i = 1; i <= 10; i++) {
      const y = SURFACE_Y - 0.35 * (i / 10);
      feedWithBoard(y, y, 6, 2800, 0.1);
    }
    let sketchyAttempt = null;
    for (let i = 1; i <= 14; i++) {
      const progress = Math.min(1, i / 10);
      const y = SURFACE_Y - 0.35 + 0.35 * progress;
      const res = feedWithBoard(y, y, 13, 0, 0.1);
      if (res) sketchyAttempt = res;
    }

    expect(sketchyAttempt).not.toBeNull();
    expect(sketchyAttempt!.metrics.landingKind).toBe("sketchy");
    expect(sketchyAttempt!.diagnosis.title).toBe("SKETCHY CATCH");
  });

  it("detects trick mismatch, wrist rotation deficits, stiff finger curl, and produces correction arrows + replay frames", () => {
    const analyzer = new TrickAnalyzer("wood");
    let t = 0;

    const mkKinematics = (indexCurl: number, middleCurl: number, wristYawDeg: number) => ({
      wrist: { x: 0.45, y: 0.3 },
      indexMcp: { x: 0.55, y: 0.5 },
      indexPip: { x: 0.55, y: 0.6 },
      indexTip: { x: 0.55, y: 0.7 },
      middleMcp: { x: 0.45, y: 0.5 },
      middlePip: { x: 0.45, y: 0.6 },
      middleTip: { x: 0.45, y: 0.7 },
      pinkyMcp: { x: 0.35, y: 0.5 },
      indexCurl,
      middleCurl,
      wristYawDeg,
      wristRollDeg: 0,
    });

    // Test 1: Boardslide requires >= 55° wrist turn; straight wrist + stiff curl fails match and gives correction arrows.
    for (let i = 0; i < 60; i++) {
      t += 16;
      analyzer.feed(
        tipsAt(SURFACE_Y, SURFACE_Y),
        SURFACE_Y,
        t,
        false,
        "boardslide",
        "wood",
        1,
        null,
        mkKinematics(0.06, 0.06, 0),
      );
    }
    for (let i = 1; i <= 10; i++) {
      t += 16;
      const y = SURFACE_Y - 0.3 * (i / 10);
      analyzer.feed(
        tipsAt(y, y),
        SURFACE_Y,
        t,
        false,
        "boardslide",
        "wood",
        1,
        null,
        mkKinematics(0.06, 0.06, 5),
      );
    }
    let boardslideAttempt = null;
    for (let i = 1; i <= 14; i++) {
      t += 16;
      const y = SURFACE_Y - 0.3 + 0.3 * Math.min(1, i / 10);
      const res = analyzer.feed(
        tipsAt(y, y),
        SURFACE_Y,
        t,
        false,
        "boardslide",
        "wood",
        1,
        null,
        mkKinematics(0.06, 0.06, 4),
      );
      if (res) boardslideAttempt = res;
    }

    expect(boardslideAttempt).not.toBeNull();
    expect(boardslideAttempt!.trickMatched).toBe(false);
    expect(boardslideAttempt!.failureReasons.length).toBeGreaterThan(0);
    expect(boardslideAttempt!.correctionArrows.length).toBeGreaterThan(0);
    expect(boardslideAttempt!.replayFrames.length).toBeGreaterThan(5);
    expect(boardslideAttempt!.diagnosis.whyFailed.toLowerCase()).toMatch(/foam|5-ply|curl|arch/);

    // Test 2: Early slide before tail pop triggers EARLY SLIDE + correction arrows on plastic setup.
    t += 1500;
    for (let i = 0; i < 60; i++) {
      t += 16;
      // Start sliding front index sideways while still resting at SURFACE_Y
      const slideX = i >= 54 ? 0.5 + (i - 54) * 0.015 : 0.5;
      analyzer.feed(
        tipsAt(SURFACE_Y, SURFACE_Y, slideX),
        SURFACE_Y,
        t,
        false,
        "ollie",
        "plastic",
        1,
        null,
        mkKinematics(0.35, 0.35, 0),
      );
    }
    for (let i = 1; i <= 10; i++) {
      t += 16;
      const y = SURFACE_Y - 0.28 * (i / 10);
      analyzer.feed(
        tipsAt(y, y, 0.56),
        SURFACE_Y,
        t,
        false,
        "ollie",
        "plastic",
        1,
        null,
        mkKinematics(0.35, 0.35, 0),
      );
    }
    let earlyAttempt = null;
    for (let i = 1; i <= 14; i++) {
      t += 16;
      const y = SURFACE_Y - 0.28 + 0.28 * Math.min(1, i / 10);
      const res = analyzer.feed(
        tipsAt(y, y, 0.56),
        SURFACE_Y,
        t,
        false,
        "ollie",
        "plastic",
        1,
        null,
        mkKinematics(0.35, 0.35, 0),
      );
      if (res) earlyAttempt = res;
    }

    expect(earlyAttempt).not.toBeNull();
    expect(earlyAttempt!.metrics.popTiming).toBe("early-slide");
    expect(earlyAttempt!.diagnosis.title).toBe("EARLY SLIDE");
    expect(earlyAttempt!.diagnosis.whyFailed.toLowerCase()).toMatch(/sandpaper|plastic/);
    expect(earlyAttempt!.correctionArrows.some((a) => a.label.includes("SNAP"))).toBe(true);
  });
});
