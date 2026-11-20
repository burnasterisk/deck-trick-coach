import { describe, expect, it } from "vitest";

import type { SavedClip } from "@/lib/clips";
import {
  DAILY_WARMUP_PLAN,
  evaluateTutorialAttempt,
  evaluateWarmupAttempt,
  getTrickOfTheDay,
  getTutorial,
  getWeeklyChallenge,
  isClipQualifiedForChallenge,
  isPhysicsAttemptSuccess,
  recordCompletedDrillHistory,
  upsertTrickHistoryEntry,
  type SessionHistoryEntry,
  type WarmupProgress,
} from "@/lib/sessions";
import type { Attempt } from "@/lib/trick-analyzer";

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 1,
    trickId: "boned-ollie",
    setup: "wood",
    score: 82,
    trickMatched: true,
    matchConfidence: 90,
    detectedMotionLabel: "Boned Ollie",
    failureReasons: [],
    correctionArrows: [],
    replayFrames: [],
    diagnosis: {
      title: "CLEAN POP",
      advice: "Clean lock.",
      tip: "Pop higher.",
      whyFailed: "Locked smoothly.",
    },
    metrics: {
      peakPop: 0.22,
      spread: 0.11,
      flick: 0.045,
      levelness: 0.01,
      popTiming: "crisp",
      popLeadMs: 25,
      boardPitchDeg: -4,
      landingKind: "clean",
    },
    ...overrides,
  };
}

describe("Guided Tutorials", () => {
  it("verifies all 3 phases of the Boned Ollie Tutorial step-by-step", () => {
    const tut = getTutorial("boned-ollie-tutorial")!;
    expect(tut).toBeDefined();
    expect(tut.steps.length).toBe(3);

    // Phase 1 rejects an early slide before tail snap
    const earlySlide = makeAttempt({
      metrics: {
        peakPop: 0.2,
        spread: 0.11,
        flick: 0.03,
        levelness: 0.01,
        popTiming: "early-slide",
      },
    });
    const failPhase1 = evaluateTutorialAttempt(tut, 0, earlySlide, 1);
    expect(failPhase1.passed).toBe(false);
    expect(failPhase1.nextStepIndex).toBe(0);

    // Phase 1 passes crisp tail snap and advances to Phase 2
    const goodPop = makeAttempt();
    const passPhase1 = evaluateTutorialAttempt(tut, 0, goodPop, 1);
    expect(passPhase1.passed).toBe(true);
    expect(passPhase1.nextStepIndex).toBe(1);
    expect(passPhase1.completed).toBe(false);

    // Phase 2 rejects a nose-high rocket landing
    const rocketNose = makeAttempt({
      metrics: {
        peakPop: 0.2,
        spread: 0.11,
        flick: 0.01,
        levelness: 0.08,
        boardPitchDeg: 18,
        landingKind: "rocket",
      },
    });
    const failPhase2 = evaluateTutorialAttempt(tut, 1, rocketNose, 1);
    expect(failPhase2.passed).toBe(false);
    expect(failPhase2.nextStepIndex).toBe(1);

    // Phase 2 passes boned nose level and advances to Phase 3
    const passPhase2 = evaluateTutorialAttempt(tut, 1, goodPop, 1);
    expect(passPhase2.passed).toBe(true);
    expect(passPhase2.nextStepIndex).toBe(2);

    // Phase 3 verifies final level four-wheel catch and marks tutorial complete
    const passPhase3 = evaluateTutorialAttempt(tut, 2, goodPop, 1);
    expect(passPhase3.passed).toBe(true);
    expect(passPhase3.completed).toBe(true);
  });
});

describe("Daily Warmup & Trick of the Day", () => {
  it("advances warmup steps across tricks until completed", () => {
    let state: WarmupProgress = {
      active: true,
      stepIndex: 0,
      repsCompleted: 0,
      completed: false,
      lastFeedback: null,
    };

    // Bank required reps for each warmup stage
    for (let s = 0; s < DAILY_WARMUP_PLAN.length; s++) {
      const target = DAILY_WARMUP_PLAN[s]!;
      for (let r = 0; r < target.targetReps; r++) {
        state = evaluateWarmupAttempt(
          state,
          makeAttempt({ trickId: target.trickId, score: 80, trickMatched: true }),
        );
      }
    }

    expect(state.completed).toBe(true);
  });

  it("picks a deterministic Trick of the Day for any calendar date", () => {
    const d = new Date(Date.UTC(2026, 10, 20));
    const a = getTrickOfTheDay(d);
    const b = getTrickOfTheDay(d);
    expect(a.dateKey).toBe(b.dateKey);
    expect(a.trick.id).toBe(b.trick.id);
    expect(a.bonusCue("wood").length).toBeGreaterThan(10);
  });
});

describe("Weekly Clip Challenge", () => {
  it("returns a deterministic weekly challenge and qualifies matching high-score clips", () => {
    const challenge = getWeeklyChallenge(new Date(Date.UTC(2026, 10, 20)));
    expect(challenge.trick.id).toBe(challenge.trickId);
    expect(challenge.minScore).toBeGreaterThanOrEqual(70);

    const baseClip: SavedClip = {
      id: "c1",
      createdAt: Date.now(),
      trickId: challenge.trickId,
      trickName: challenge.trick.name,
      mirrored: false,
      width: 480,
      height: 270,
      durationMs: 420,
      attempt: makeAttempt({ trickId: challenge.trickId, score: 84, trickMatched: true }),
      frames: [],
      mistake: {
        frameIndex: 0,
        severity: "clean",
        tag: "CLEAN CATCH",
        detail: "Clean",
        target: "index",
        arrows: [],
      },
      posterUrl: "",
      exportState: "ready",
    };

    expect(isClipQualifiedForChallenge(baseClip, challenge)).toBe(true);

    const lowScoreClip: SavedClip = {
      ...baseClip,
      attempt: { ...baseClip.attempt, score: 52 },
    };
    expect(isClipQualifiedForChallenge(lowScoreClip, challenge)).toBe(false);
  });
});

describe("Session History", () => {
  it("classifies physics attempt success accurately and records drill & trick success rates with timestamps", () => {
    const cleanMake = makeAttempt({ score: 86, trickMatched: true });
    const primoFail = makeAttempt({
      score: 72,
      trickMatched: true,
      metrics: {
        peakPop: 0.2,
        spread: 0.11,
        flick: 0.04,
        levelness: 0.01,
        landingKind: "primo",
      },
    });
    const mismatchFail = makeAttempt({ score: 78, trickMatched: false });

    expect(isPhysicsAttemptSuccess(cleanMake)).toBe(true);
    expect(isPhysicsAttemptSuccess(primoFail)).toBe(false);
    expect(isPhysicsAttemptSuccess(mismatchFail)).toBe(false);

    let history: SessionHistoryEntry[] = [];
    history = upsertTrickHistoryEntry(history, cleanMake, "block-1", "Boned Ollie", 1000);
    history = upsertTrickHistoryEntry(history, primoFail, "block-1", "Boned Ollie", 2000);
    history = upsertTrickHistoryEntry(history, mismatchFail, "block-1", "Boned Ollie", 3000);

    expect(history).toHaveLength(1);
    expect(history[0]!.attempts).toBe(3);
    expect(history[0]!.landedCount).toBe(1);
    expect(history[0]!.successRatePct).toBe(33);
    expect(history[0]!.bestScore).toBe(86);
    expect(history[0]!.timestamp).toBe(3000);

    history = recordCompletedDrillHistory(history, {
      id: "drill-1",
      kind: "drill",
      title: "Boned Ollie Tutorial",
      trickId: "boned-ollie",
      setup: "wood",
      attempts: 5,
      landedCount: 4,
      bestScore: 92,
      lastScore: 88,
      lastVerdict: "CLEAN POP",
      timestamp: 4000,
    });

    expect(history).toHaveLength(2);
    expect(history[0]!.kind).toBe("drill");
    expect(history[0]!.successRatePct).toBe(80);
    expect(history[0]!.timestamp).toBe(4000);
  });
});
