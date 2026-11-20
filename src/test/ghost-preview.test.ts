import { describe, expect, it } from "vitest";

import { projectGhostDeck, resolveGhostAnchor, sampleGhostPose } from "@/lib/ghost-preview";
import { getTrick } from "@/lib/tricks";

const VIEWPORT = { width: 1280, height: 720 };

describe("ghost preview kinematics & anchoring", () => {
  it("anchors directly to resting fingertips and scales deck length proportionally", () => {
    const narrowPose = {
      indexMcp: { x: 0.56, y: 0.45 },
      indexTip: { x: 0.55, y: 0.65 },
      middleMcp: { x: 0.46, y: 0.45 },
      middleTip: { x: 0.45, y: 0.65 },
    };
    const widePose = {
      indexMcp: { x: 0.62, y: 0.35 },
      indexTip: { x: 0.6, y: 0.68 },
      middleMcp: { x: 0.42, y: 0.35 },
      middleTip: { x: 0.4, y: 0.68 },
    };

    const narrowAnchor = resolveGhostAnchor({
      handPose: narrowPose,
      tips: null,
      boardLock: null,
      viewport: VIEWPORT,
      mirrored: false,
    });
    const wideAnchor = resolveGhostAnchor({
      handPose: widePose,
      tips: null,
      boardLock: null,
      viewport: VIEWPORT,
      mirrored: false,
    });

    expect(narrowAnchor.anchoredToHand).toBe(true);
    expect(wideAnchor.anchoredToHand).toBe(true);
    expect(wideAnchor.deckLengthPx).toBeGreaterThan(narrowAnchor.deckLengthPx);
    expect(narrowAnchor.centerPx.x).toBeCloseTo(VIEWPORT.width * (0.55 * 0.48 + 0.45 * 0.52), 1);
  });

  it("samples pop angle, flip/shuv rotation, finger separation, and catch height across the 3 steps", () => {
    const kickflip = getTrick("kickflip");
    const treFlip = getTrick("tre-flip");

    const step1 = sampleGhostPose(kickflip, 0.2, "plastic");
    const step2 = sampleGhostPose(kickflip, 0.48, "plastic");
    const step3 = sampleGhostPose(kickflip, 0.74, "plastic");

    expect(step1.stepIndex).toBe(0);
    expect(step1.stepLabel).toBe("1. Snap Tail");
    expect(step1.pitchDeg).toBeGreaterThan(15);

    expect(step2.stepIndex).toBe(1);
    expect(step2.stepLabel).toBe("2. Heel Flick");
    expect(step2.rollDeg).toBeGreaterThan(90);
    expect(step2.fingerSeparation).toBeGreaterThan(1.1);
    expect(step2.liftNorm).toBeGreaterThan(step1.liftNorm);

    expect(step3.stepIndex).toBe(2);
    expect(step3.stepLabel).toBe("3. Hover & Catch");
    expect(step3.rollDeg).toBe(360);
    expect(step3.pitchDeg).toBe(0);

    const treStep2 = sampleGhostPose(treFlip, 0.48, "wood");
    expect(treStep2.stepLabel).toBe("2. Flick & Scoop");
    expect(treStep2.rollDeg).toBeGreaterThan(90);
    expect(treStep2.yawDeg).toBeGreaterThan(90);
  });

  it("projects 3D deck outline and tracks top vs underside face across a kickflip", () => {
    const kickflip = getTrick("kickflip");
    const anchor = resolveGhostAnchor({
      handPose: null,
      tips: { index: { x: 0.58, y: 0.65 }, middle: { x: 0.42, y: 0.65 } },
      boardLock: null,
      viewport: VIEWPORT,
      mirrored: false,
    });

    const launchPose = sampleGhostPose(kickflip, 0.1, "wood");
    const invertedPose = sampleGhostPose(kickflip, 0.48, "wood");

    const launchProj = projectGhostDeck(launchPose, anchor, "wood");
    const invertedProj = projectGhostDeck(invertedPose, anchor, "wood");

    expect(launchProj.outline.length).toBeGreaterThan(10);
    expect(launchProj.wheels).toHaveLength(4);
    expect(launchProj.topFacing).toBe(true);
    expect(invertedProj.topFacing).toBe(false);
    expect(invertedProj.deckCenterPx.y).toBeLessThan(launchProj.deckCenterPx.y);
  });
});
