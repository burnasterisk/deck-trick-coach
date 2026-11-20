import { describe, expect, it } from "vitest";

import {
  averageHandLandmarks,
  calculateBoardCalibration,
  type HandBoardLandmarks,
} from "@/lib/board-calibration";

const VIEWPORT = { width: 1000, height: 800 };

describe("board calibration from landmarks 5, 8, 9, 12", () => {
  it("computes center point, pixel scale, and near-zero tilt for a flat right-facing stance", () => {
    const pose: HandBoardLandmarks = {
      indexMcp: { x: 0.56, y: 0.42 },
      indexTip: { x: 0.57, y: 0.65 },
      middleMcp: { x: 0.49, y: 0.42 },
      middleTip: { x: 0.44, y: 0.65 },
    };

    const cal = calculateBoardCalibration(pose, VIEWPORT, false);

    expect(cal.tipDistancePx).toBeCloseTo(130, 1);
    expect(cal.knuckleDistancePx).toBeCloseTo(70, 1);
    expect(cal.deckLengthPx).toBeGreaterThan(220);
    expect(cal.deckLengthPx).toBeLessThan(320);
    expect(cal.scale).toBeCloseTo(cal.deckLengthPx / 260, 4);
    expect(cal.tiltAngleDeg).toBeCloseTo(0, 1);
    expect(cal.noseDirection).toBe("right");
    expect(cal.centerNorm.x).toBeCloseTo(0.5024, 3);
    expect(cal.centerNorm.y).toBeGreaterThan(0.65);
  });

  it("scales proportionally when the board is closer vs farther from the camera", () => {
    const closePose: HandBoardLandmarks = {
      indexMcp: { x: 0.62, y: 0.3 },
      indexTip: { x: 0.65, y: 0.65 },
      middleMcp: { x: 0.48, y: 0.3 },
      middleTip: { x: 0.4, y: 0.65 },
    };
    const farPose: HandBoardLandmarks = {
      indexMcp: { x: 0.54, y: 0.5 },
      indexTip: { x: 0.55, y: 0.65 },
      middleMcp: { x: 0.49, y: 0.5 },
      middleTip: { x: 0.45, y: 0.65 },
    };

    const closeCal = calculateBoardCalibration(closePose, VIEWPORT, false);
    const farCal = calculateBoardCalibration(farPose, VIEWPORT, false);

    expect(closeCal.deckLengthPx).toBeGreaterThan(farCal.deckLengthPx * 1.5);
    expect(closeCal.scale).toBeGreaterThan(farCal.scale * 1.5);
  });

  it("measures positive and negative board tilt angles from landmarks 5, 8, 9, 12", () => {
    // Nose (index tip 8) angled upward (smaller y) relative to tail (middle tip 12)
    const noseUpPose: HandBoardLandmarks = {
      indexMcp: { x: 0.57, y: 0.38 },
      indexTip: { x: 0.58, y: 0.58 },
      middleMcp: { x: 0.49, y: 0.41 },
      middleTip: { x: 0.44, y: 0.66 },
    };

    const cal = calculateBoardCalibration(noseUpPose, VIEWPORT, false);
    expect(cal.tiltAngleDeg).toBeLessThan(-10);
    expect(cal.noseDirection).toBe("right");
  });

  it("handles mirrored front-camera frames without flipping nose direction backwards", () => {
    const pose: HandBoardLandmarks = {
      indexMcp: { x: 0.56, y: 0.42 },
      indexTip: { x: 0.57, y: 0.65 },
      middleMcp: { x: 0.49, y: 0.42 },
      middleTip: { x: 0.44, y: 0.65 },
    };

    const unmirrored = calculateBoardCalibration(pose, VIEWPORT, false);
    const mirrored = calculateBoardCalibration(pose, VIEWPORT, true);

    expect(unmirrored.noseDirection).toBe("right");
    expect(mirrored.noseDirection).toBe("left");
    expect(mirrored.centerNorm.x).toBeCloseTo(1 - unmirrored.centerNorm.x, 3);
    expect(mirrored.deckLengthPx).toBeCloseTo(unmirrored.deckLengthPx, 2);
  });

  it("averages multiple hand-pose frames accurately", () => {
    const a: HandBoardLandmarks = {
      indexMcp: { x: 0.5, y: 0.4 },
      indexTip: { x: 0.6, y: 0.6 },
      middleMcp: { x: 0.4, y: 0.4 },
      middleTip: { x: 0.4, y: 0.6 },
    };
    const b: HandBoardLandmarks = {
      indexMcp: { x: 0.54, y: 0.44 },
      indexTip: { x: 0.64, y: 0.64 },
      middleMcp: { x: 0.44, y: 0.44 },
      middleTip: { x: 0.44, y: 0.64 },
    };

    const avg = averageHandLandmarks([a, b]);
    expect(avg).not.toBeNull();
    expect(avg!.indexTip.x).toBeCloseTo(0.62, 5);
    expect(avg!.middleTip.y).toBeCloseTo(0.62, 5);
    expect(averageHandLandmarks([])).toBeNull();
  });
});
