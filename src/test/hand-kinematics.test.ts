import { describe, expect, it } from "vitest";

import {
  computeFingerCurl,
  extractHandKinematics,
  shortestAngleDeltaDeg,
  type LandmarkLike,
} from "@/lib/hand-kinematics";

function makeSyntheticHand(
  opts: {
    curlAngleRad?: number;
    wristYawShiftX?: number;
    pinkyYOffset?: number;
  } = {},
): LandmarkLike[] {
  const { curlAngleRad = 0.5, wristYawShiftX = 0, pinkyYOffset = 0 } = opts;
  const pts: LandmarkLike[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  pts[0] = { x: 0.45, y: 0.25 }; // Wrist
  pts[5] = { x: 0.56 + wristYawShiftX, y: 0.42 }; // Index MCP
  pts[6] = { x: 0.56 + wristYawShiftX, y: 0.54 }; // Index PIP
  pts[8] = {
    x: 0.56 + wristYawShiftX - Math.sin(curlAngleRad) * 0.1,
    y: 0.54 + Math.cos(curlAngleRad) * 0.1,
  }; // Index TIP
  pts[9] = { x: 0.48 + wristYawShiftX, y: 0.42 }; // Middle MCP
  pts[10] = { x: 0.48 + wristYawShiftX, y: 0.54 }; // Middle PIP
  pts[12] = {
    x: 0.48 + wristYawShiftX - Math.sin(curlAngleRad) * 0.1,
    y: 0.54 + Math.cos(curlAngleRad) * 0.1,
  }; // Middle TIP
  pts[17] = { x: 0.36 + wristYawShiftX, y: 0.42 + pinkyYOffset }; // Pinky MCP
  return pts;
}

describe("hand kinematics", () => {
  it("measures finger curl accurately from straight to curled claw", () => {
    const straight = computeFingerCurl(
      { x: 0.5, y: 0.4 },
      { x: 0.5, y: 0.52 },
      { x: 0.5, y: 0.64 },
    );
    const arched = computeFingerCurl({ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.52 }, { x: 0.38, y: 0.52 });
    const claw = computeFingerCurl({ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.52 }, { x: 0.5, y: 0.41 });

    expect(straight).toBeCloseTo(0, 2);
    expect(arched).toBeCloseTo(0.5, 2);
    expect(claw).toBeCloseTo(1, 2);
  });

  it("extracts wrist yaw/roll and curl from 21 MediaPipe landmarks", () => {
    const square = extractHandKinematics(makeSyntheticHand({ curlAngleRad: 0.05 }));
    const turned = extractHandKinematics(
      makeSyntheticHand({ curlAngleRad: 1.6, wristYawShiftX: 0.14, pinkyYOffset: 0.12 }),
    );

    expect(square).not.toBeNull();
    expect(turned).not.toBeNull();
    expect(square!.indexCurl).toBeLessThan(0.1);
    expect(turned!.indexCurl).toBeGreaterThan(0.45);
    expect(
      Math.abs(shortestAngleDeltaDeg(square!.wristYawDeg, turned!.wristYawDeg)),
    ).toBeGreaterThan(25);
  });
});
