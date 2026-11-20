export interface Point2D {
  x: number;
  y: number;
}

/** MediaPipe hand landmarks 5, 8, 9, and 12 in normalized [0..1] video space. */
export interface HandBoardLandmarks {
  /** Landmark 5: Index finger MCP knuckle */
  indexMcp: Point2D;
  /** Landmark 8: Index finger tip */
  indexTip: Point2D;
  /** Landmark 9: Middle finger MCP knuckle */
  middleMcp: Point2D;
  /** Landmark 12: Middle finger tip */
  middleTip: Point2D;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface BoardCalibration {
  /** Center point of the locked board in viewport CSS pixels */
  centerPx: Point2D;
  /** Center point in normalized [0..1] viewport coordinates */
  centerNorm: Point2D;
  /** Calibrated surface Y line in normalized [0..1] space */
  surfaceY: number;
  /** Real pixel length of the fingerboard deck on screen */
  deckLengthPx: number;
  /** Real pixel width/height proportion of the deck overlay */
  deckThicknessPx: number;
  /** Deck length as a fraction of viewport width */
  deckLengthNorm: number;
  /** Scale factor relative to a 260px baseline deck */
  scale: number;
  /** Measured pixel distance between index tip (8) and middle tip (12) */
  tipDistancePx: number;
  /** Measured pixel distance between index MCP (5) and middle MCP (9) */
  knuckleDistancePx: number;
  /** Average pixel reach from MCP knuckles (5, 9) to fingertips (8, 12) */
  fingerReachPx: number;
  /** Raw tail-to-nose vector angle in radians */
  rawAngleRad: number;
  /** Visual tilt angle in degrees clamped to [-85, 85] so overlays stay readable */
  tiltAngleDeg: number;
  /** Side the nose (index finger) points toward on screen */
  noseDirection: "right" | "left";
}

const BASELINE_DECK_PX = 260;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeVec(dx: number, dy: number): Point2D | null {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return null;
  return { x: dx / len, y: dy / len };
}

/** Average multiple frames of landmarks 5, 8, 9, 12 for steady board locking. */
export function averageHandLandmarks(samples: HandBoardLandmarks[]): HandBoardLandmarks | null {
  if (samples.length === 0) return null;
  let iMcpX = 0;
  let iMcpY = 0;
  let iTipX = 0;
  let iTipY = 0;
  let mMcpX = 0;
  let mMcpY = 0;
  let mTipX = 0;
  let mTipY = 0;

  for (const s of samples) {
    iMcpX += s.indexMcp.x;
    iMcpY += s.indexMcp.y;
    iTipX += s.indexTip.x;
    iTipY += s.indexTip.y;
    mMcpX += s.middleMcp.x;
    mMcpY += s.middleMcp.y;
    mTipX += s.middleTip.x;
    mTipY += s.middleTip.y;
  }

  const n = samples.length;
  return {
    indexMcp: { x: iMcpX / n, y: iMcpY / n },
    indexTip: { x: iTipX / n, y: iTipY / n },
    middleMcp: { x: mMcpX / n, y: mMcpY / n },
    middleTip: { x: mTipX / n, y: mTipY / n },
  };
}

/**
 * Measures distances and angles across MediaPipe landmarks 5, 8, 9, and 12
 * to compute the fingerboard's real pixel scale, center point, and tilt angle.
 */
export function calculateBoardCalibration(
  landmarks: HandBoardLandmarks,
  viewport: ViewportSize,
  mirrored: boolean,
): BoardCalibration {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);

  const toPx = (p: Point2D): Point2D => ({
    x: (mirrored ? 1 - p.x : p.x) * width,
    y: p.y * height,
  });

  const p5 = toPx(landmarks.indexMcp);
  const p8 = toPx(landmarks.indexTip);
  const p9 = toPx(landmarks.middleMcp);
  const p12 = toPx(landmarks.middleTip);

  const tipDistancePx = dist(p8, p12);
  const knuckleDistancePx = dist(p5, p9);
  const indexReachPx = dist(p5, p8);
  const middleReachPx = dist(p9, p12);
  const fingerReachPx = (indexReachPx + middleReachPx) / 2;

  // Estimate real fingerboard length (~98mm) from all four landmark pairs:
  // fingertips span ~50% of deck length, finger reach ~76%, MCP knuckles ~23%.
  const deckFromTips = tipDistancePx / 0.5;
  const deckFromReach = fingerReachPx / 0.76;
  const deckFromKnuckles = knuckleDistancePx / 0.23;

  const rawDeckLength =
    tipDistancePx > 4 && fingerReachPx > 4
      ? 0.52 * deckFromTips + 0.33 * deckFromReach + 0.15 * deckFromKnuckles
      : Math.max(deckFromTips, deckFromReach, BASELINE_DECK_PX);

  const minDeckPx = Math.min(115, width * 0.25);
  const maxDeckPx = Math.max(220, Math.min(width, height) * 0.88);
  const deckLengthPx = clamp(rawDeckLength, minDeckPx, maxDeckPx);
  const scale = deckLengthPx / BASELINE_DECK_PX;
  const deckThicknessPx = deckLengthPx * 0.328;

  // Combine tip axis (12 -> 8) and knuckle bridge (9 -> 5) for steady board tilt.
  const tipVec = normalizeVec(p8.x - p12.x, p8.y - p12.y) ?? { x: 1, y: 0 };
  const mcpVec = normalizeVec(p5.x - p9.x, p5.y - p9.y);
  const blendedX = mcpVec ? tipVec.x * 0.78 + mcpVec.x * 0.22 : tipVec.x;
  const blendedY = mcpVec ? tipVec.y * 0.78 + mcpVec.y * 0.22 : tipVec.y;

  const rawAngleRad = Math.atan2(blendedY, blendedX);
  const noseDirection: "right" | "left" = blendedX >= 0 ? "right" : "left";
  const visualRad = noseDirection === "right" ? rawAngleRad : Math.atan2(-blendedY, -blendedX);
  const tiltAngleDeg = clamp((visualRad * 180) / Math.PI, -85, 85);

  // Center point sits between index tip (8) and middle tip (12), nudged slightly
  // below the pads so the locked surface line meets the grip tape plane.
  const centerX = p8.x * 0.48 + p12.x * 0.52;
  const centerY = p8.y * 0.48 + p12.y * 0.52 + deckLengthPx * 0.04;

  const normX = clamp(centerX / width, 0.05, 0.95);
  const normY = clamp(centerY / height, 0.1, 0.92);

  return {
    centerPx: { x: normX * width, y: normY * height },
    centerNorm: { x: normX, y: normY },
    surfaceY: normY,
    deckLengthPx,
    deckThicknessPx,
    deckLengthNorm: deckLengthPx / width,
    scale,
    tipDistancePx,
    knuckleDistancePx,
    fingerReachPx,
    rawAngleRad,
    tiltAngleDeg,
    noseDirection,
  };
}
