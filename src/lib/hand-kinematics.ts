import type { Point2D } from "./board-calibration";

/** Subset of MediaPipe 21 hand landmarks needed for wrist rotation & finger curl. */
export interface HandKinematics {
  wrist: Point2D;
  indexMcp: Point2D;
  indexPip: Point2D;
  indexTip: Point2D;
  middleMcp: Point2D;
  middlePip: Point2D;
  middleTip: Point2D;
  pinkyMcp: Point2D;
  /** Index finger PIP flexion [0 = straight/stiff .. 1 = tightly curled]. */
  indexCurl: number;
  /** Middle finger PIP flexion [0 = straight/stiff .. 1 = tightly curled]. */
  middleCurl: number;
  /** Palm yaw/orientation angle in degrees (wrist -> middle MCP). */
  wristYawDeg: number;
  /** Knuckle-bridge roll angle in degrees (index MCP -> pinky MCP). */
  wristRollDeg: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Computes joint flexion [0 = straight, 1 = fully curled] from MCP -> PIP -> TIP points. */
export function computeFingerCurl(mcp: Point2D, pip: Point2D, tip: Point2D): number {
  const v1x = pip.x - mcp.x;
  const v1y = pip.y - mcp.y;
  const v2x = tip.x - pip.x;
  const v2y = tip.y - pip.y;

  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  if (len1 < 1e-4 || len2 < 1e-4) return 0.35;

  const cosTheta = clamp((v1x * v2x + v1y * v2y) / (len1 * len2), -1, 1);
  // Straight finger: cosTheta = 1 -> curl 0; 90° bend: cosTheta = 0 -> curl 0.5; tucked: 1.0
  return clamp((1 - cosTheta) / 2, 0, 1);
}

/** Normalizes shortest signed angular difference (a -> b) into [-180, 180]. */
export function shortestAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  let d = ((toDeg - fromDeg + 180) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

export interface LandmarkLike {
  x: number;
  y: number;
  z?: number;
}

/** Extracts wrist yaw/roll and index/middle curl from MediaPipe's 21 hand landmarks. */
export function extractHandKinematics(
  landmarks: readonly LandmarkLike[],
  mirrored = false,
): HandKinematics | null {
  const lm0 = landmarks[0];
  const lm5 = landmarks[5];
  const lm6 = landmarks[6];
  const lm8 = landmarks[8];
  const lm9 = landmarks[9];
  const lm10 = landmarks[10];
  const lm12 = landmarks[12];
  const lm17 = landmarks[17];

  if (!lm0 || !lm5 || !lm6 || !lm8 || !lm9 || !lm10 || !lm12 || !lm17) {
    return null;
  }

  const pt = (lm: LandmarkLike): Point2D => ({
    x: mirrored ? 1 - lm.x : lm.x,
    y: lm.y,
  });

  const wrist = pt(lm0);
  const indexMcp = pt(lm5);
  const indexPip = pt(lm6);
  const indexTip = pt(lm8);
  const middleMcp = pt(lm9);
  const middlePip = pt(lm10);
  const middleTip = pt(lm12);
  const pinkyMcp = pt(lm17);

  const indexCurl = computeFingerCurl(indexMcp, indexPip, indexTip);
  const middleCurl = computeFingerCurl(middleMcp, middlePip, middleTip);

  // Palm forward vector (wrist -> middle MCP) gives yaw rotation when twisting hand for 180s/boardslides.
  const wristYawDeg = (Math.atan2(middleMcp.x - wrist.x, -(middleMcp.y - wrist.y)) * 180) / Math.PI;

  // Knuckle bridge vector (index MCP -> pinky MCP) captures pronation/supination roll.
  const wristRollDeg =
    (Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x) * 180) / Math.PI;

  return {
    wrist,
    indexMcp,
    indexPip,
    indexTip,
    middleMcp,
    middlePip,
    middleTip,
    pinkyMcp,
    indexCurl,
    middleCurl,
    wristYawDeg,
    wristRollDeg,
  };
}
