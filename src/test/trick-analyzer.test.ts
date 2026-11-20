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
    const attempt = runPop(analyzer, { peak: 0.4, landIndexY: SURFACE_Y - 0.12, landMiddleY: SURFACE_Y - 0.02 });
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
    for (let i = 0; i < 60; i++) analyzer.feed(tipsAt(SURFACE_Y, SURFACE_Y), SURFACE_Y, (t += 16), false, "ollie");
    for (let i = 0; i < 15; i++) analyzer.feed(tipsAt(SURFACE_Y - 0.3, SURFACE_Y - 0.3), SURFACE_Y, (t += 16), false, "ollie");
    // Hand leaves frame well past the lost-tracking window.
    expect(analyzer.feed(null, SURFACE_Y, t + 500, false, "ollie")).toBeNull();
    expect(analyzer.feed(tipsAt(SURFACE_Y, SURFACE_Y), SURFACE_Y, t + 516, false, "ollie")).toBeNull();
  });

  it("ignores a second pop inside the cooldown", () => {
    const analyzer = new TrickAnalyzer();
    const first = runPop(analyzer, { peak: 0.45 });
    expect(first).not.toBeNull();
    const second = runPop(analyzer, { peak: 0.45 });
    expect(second).toBeNull();
  });
});
