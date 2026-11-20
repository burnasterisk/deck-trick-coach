import {
  calculateBoardCalibration,
  type BoardCalibration,
  type HandBoardLandmarks,
  type Point2D,
  type ViewportSize,
} from "./board-calibration";
import type { DeckSetupId } from "./setup";
import type { Tips } from "./trick-analyzer";
import type { Trick } from "./tricks";

export interface GhostAnchor {
  /** Launch center on the resting deck surface in viewport CSS pixels. */
  centerPx: Point2D;
  /** Real pixel length of the user's deck on screen. */
  deckLengthPx: number;
  /** Scale relative to 260px baseline deck. */
  scale: number;
  /** Visual ground tilt angle in radians (matches user's real board angle). */
  tiltAngleRad: number;
  /** +1 when nose (index finger) points right on screen, -1 when left. */
  noseSign: 1 | -1;
  /** Resting fingertip separation in pixels. */
  tipSpanPx: number;
  /** True when live handPose/tips or boardLock anchored the preview. */
  anchoredToHand: boolean;
}

export interface Point3D {
  /** Along deck length (-0.5 tail .. +0.5 nose). */
  x: number;
  /** Across deck width / lateral (-0.5 .. +0.5). */
  y: number;
  /** Vertical above resting surface (+ up, in deck-length units). */
  z: number;
}

export interface GhostPose {
  /** Normalized loop phase [0..1). */
  progress: number;
  /** Active coaching step index: 0 (Snap Tail), 1 (Flick/Scoop), 2 (Hover & Catch). */
  stepIndex: 0 | 1 | 2;
  /** Active step label from trick.preview.stepCallouts. */
  stepLabel: string;
  /** Center lift above resting surface as fraction of deckLengthPx. */
  liftNorm: number;
  /** Board pitch angle in degrees (+ = nose up, tail down). */
  pitchDeg: number;
  /** Axial flip rotation in degrees around long axis. */
  rollDeg: number;
  /** Shuvit yaw rotation in degrees around vertical axis. */
  yawDeg: number;
  /** Peak target catch height as fraction of deckLengthPx. */
  catchHeightNorm: number;
  /** Separation multiplier between ghost index & middle fingers (1.0 = resting). */
  fingerSeparation: number;
  /** Ghost index finger position in launch-local deck-length coordinates. */
  indexLocal: Point3D;
  /** Ghost middle finger position in launch-local deck-length coordinates. */
  middleLocal: Point3D;
  /** Concise live metric readout for the active phase. */
  phaseReadout: string;
}

export interface ProjectedDeck {
  /** Top deck perimeter polygon in screen CSS pixels. */
  outline: Point2D[];
  /** Center spine line (tail -> nose) for orientation & pop angle visualization. */
  spine: [Point2D, Point2D];
  /** Nose kick arc highlight points (front third of deck). */
  noseAccent: Point2D[];
  /** Four wheel circles projected below the deck underside. */
  wheels: Point2D[];
  /** Ghost index and middle fingertip screen positions. */
  indexTipPx: Point2D;
  middleTipPx: Point2D;
  /** Resting surface baseline endpoints (tail -> nose) in screen CSS pixels. */
  baseline: [Point2D, Point2D];
  /** Tail pivot point on surface in screen CSS pixels. */
  tailPivotPx: Point2D;
  /** Catch apex center point in screen CSS pixels. */
  catchApexPx: Point2D;
  /** Current deck center in screen CSS pixels. */
  deckCenterPx: Point2D;
  /** Whether the grip-tape top face is currently facing the viewer (vs underside graphic). */
  topFacing: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const GHOST_LOOP_DURATION_MS = 3600;

/**
 * Resolves the live, scale-matched Ghost Deck anchor directly from resting fingertips
 * (`handPose` landmarks 5·8·9·12 preferred, then `tips` 8·12, then locked board calibration,
 * then centered viewport fallback).
 */
export function resolveGhostAnchor(params: {
  handPose: HandBoardLandmarks | null;
  tips: Tips | null;
  boardLock: BoardCalibration | null;
  viewport: ViewportSize;
  mirrored: boolean;
}): GhostAnchor {
  const { handPose, tips, boardLock, viewport, mirrored } = params;
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);

  if (handPose) {
    const cal = calculateBoardCalibration(handPose, viewport, mirrored);
    return {
      centerPx: cal.centerPx,
      deckLengthPx: cal.deckLengthPx,
      scale: cal.scale,
      tiltAngleRad: (cal.tiltAngleDeg * Math.PI) / 180,
      noseSign: cal.noseDirection === "right" ? 1 : -1,
      tipSpanPx: cal.tipDistancePx,
      anchoredToHand: true,
    };
  }

  if (tips) {
    const ix = (mirrored ? 1 - tips.index.x : tips.index.x) * width;
    const iy = tips.index.y * height;
    const mx = (mirrored ? 1 - tips.middle.x : tips.middle.x) * width;
    const my = tips.middle.y * height;
    const tipSpanPx = Math.hypot(ix - mx, iy - my);
    const minDeckPx = Math.min(115, width * 0.25);
    const maxDeckPx = Math.max(220, Math.min(width, height) * 0.88);
    const deckLengthPx = clamp(tipSpanPx > 4 ? tipSpanPx / 0.5 : 240, minDeckPx, maxDeckPx);
    const noseSign: 1 | -1 = ix >= mx ? 1 : -1;
    const dx = (ix - mx) * noseSign;
    const dy = (iy - my) * noseSign;
    const tiltAngleRad = clamp(Math.atan2(dy, dx), (-85 * Math.PI) / 180, (85 * Math.PI) / 180);

    return {
      centerPx: {
        x: ix * 0.48 + mx * 0.52,
        y: iy * 0.48 + my * 0.52 + deckLengthPx * 0.04,
      },
      deckLengthPx,
      scale: deckLengthPx / 260,
      tiltAngleRad,
      noseSign,
      tipSpanPx,
      anchoredToHand: true,
    };
  }

  if (boardLock) {
    return {
      centerPx: boardLock.centerPx,
      deckLengthPx: boardLock.deckLengthPx,
      scale: boardLock.scale,
      tiltAngleRad: (boardLock.tiltAngleDeg * Math.PI) / 180,
      noseSign: boardLock.noseDirection === "right" ? 1 : -1,
      tipSpanPx: boardLock.tipDistancePx,
      anchoredToHand: true,
    };
  }

  const deckLengthPx = clamp(width * 0.34, 180, 320);
  return {
    centerPx: { x: width * 0.5, y: height * 0.56 },
    deckLengthPx,
    scale: deckLengthPx / 260,
    tiltAngleRad: 0,
    noseSign: 1,
    tipSpanPx: deckLengthPx * 0.5,
    anchoredToHand: false,
  };
}

/** Smooths anchor updates so resting hand micro-tremor never jitters the preview. */
export function smoothGhostAnchor(
  prev: GhostAnchor | null,
  next: GhostAnchor,
  alpha = 0.22,
): GhostAnchor {
  if (!prev || prev.anchoredToHand !== next.anchoredToHand || prev.noseSign !== next.noseSign) {
    return next;
  }
  return {
    centerPx: {
      x: lerp(prev.centerPx.x, next.centerPx.x, alpha),
      y: lerp(prev.centerPx.y, next.centerPx.y, alpha),
    },
    deckLengthPx: lerp(prev.deckLengthPx, next.deckLengthPx, alpha),
    scale: lerp(prev.scale, next.scale, alpha),
    tiltAngleRad: lerp(prev.tiltAngleRad, next.tiltAngleRad, alpha),
    noseSign: next.noseSign,
    tipSpanPx: lerp(prev.tipSpanPx, next.tipSpanPx, alpha),
    anchoredToHand: next.anchoredToHand,
  };
}

/**
 * Samples the slow-motion trick preview kinematics at normalized phase `progress` in [0..1).
 */
export function sampleGhostPose(trick: Trick, progress: number, setup: DeckSetupId): GhostPose {
  const p = ((progress % 1) + 1) % 1;
  const spec = trick.preview;
  // Wood decks with foam grip give slightly higher pop clearance & cushioned catch.
  const heightMult = setup === "wood" ? 1.06 : 1;
  const catchHeightNorm = spec.catchHeightNorm * heightMult;

  const baseIndexX = 0.16;
  const baseMiddleX = -0.34;
  const fingerZ = 0.06;

  let stepIndex: 0 | 1 | 2 = 0;
  let liftNorm = 0;
  let pitchDeg = 0;
  let rollDeg = 0;
  let yawDeg = 0;
  let indexLocal: Point3D = { x: baseIndexX, y: 0, z: fingerZ };
  let middleLocal: Point3D = { x: baseMiddleX, y: 0, z: fingerZ };
  let phaseReadout = `${spec.popAngleDeg}° POP`;

  if (p < 0.28) {
    // Step 1: 1. Snap Tail
    stepIndex = 0;
    const u = easeInOut(p / 0.28);
    // Tail dips to contact surface while nose pivots up to popAngleDeg.
    pitchDeg = spec.popAngleDeg * u;
    const sinPitch = Math.sin((pitchDeg * Math.PI) / 180);
    liftNorm = 0.36 * Math.abs(sinPitch);

    // Middle finger presses tail down; index slides forward toward nose pocket.
    middleLocal = {
      x: baseMiddleX - 0.04 * u,
      y: spec.scoopSweep.lateral * 0.25 * u,
      z: liftNorm - 0.38 * sinPitch + fingerZ * (1 - 0.4 * u),
    };
    indexLocal = {
      x: baseIndexX + spec.flickReach.forward * 0.45 * u,
      y: spec.flickReach.lateral * 0.25 * u,
      z: liftNorm + 0.18 * sinPitch + fingerZ,
    };
    phaseReadout = `${Math.round(pitchDeg)}° POP`;
  } else if (p < 0.68) {
    // Step 2: 2. Flick / Scoop
    stepIndex = 1;
    const u = (p - 0.28) / 0.4;
    const climb = easeOutCubic(Math.min(1, u * 1.15));
    const spinEase = easeInOut(u);
    const sepBell = Math.sin(u * Math.PI);

    liftNorm = lerp(0.36 * Math.sin((spec.popAngleDeg * Math.PI) / 180), catchHeightNorm, climb);
    pitchDeg = spec.popAngleDeg * (1 - easeInOut(Math.min(1, u * 1.25)));
    rollDeg = spec.flipDeg * spinEase;
    yawDeg = spec.shuvDeg * spinEase;

    indexLocal = {
      x: baseIndexX + spec.flickReach.forward * (0.45 + 0.55 * sepBell) + 0.04 * (1 - u),
      y: spec.flickReach.lateral * sepBell,
      z: liftNorm + fingerZ + spec.flickReach.lift * sepBell,
    };
    middleLocal = {
      x: baseMiddleX - spec.scoopSweep.back * sepBell,
      y: spec.scoopSweep.lateral * sepBell,
      z: liftNorm + fingerZ + spec.scoopSweep.lift * sepBell,
    };

    if (Math.abs(spec.flipDeg) > 0 && Math.abs(spec.shuvDeg) > 0) {
      phaseReadout = `${Math.round(Math.abs(rollDeg))}° FLIP · ${Math.round(Math.abs(yawDeg))}° SHUV`;
    } else if (Math.abs(spec.flipDeg) > 0) {
      phaseReadout = `${Math.round(Math.abs(rollDeg))}° FLIP`;
    } else if (Math.abs(spec.shuvDeg) > 0) {
      phaseReadout = `${Math.round(Math.abs(yawDeg))}° SHUV`;
    } else {
      phaseReadout = `LEVEL ${Math.round(catchHeightNorm * 98)}mm`;
    }
  } else {
    // Step 3: 3. Hover & Catch
    stepIndex = 2;
    const u = (p - 0.68) / 0.32;
    rollDeg = spec.flipDeg;
    yawDeg = spec.shuvDeg;
    pitchDeg = 0;

    if (u < 0.42) {
      // Hover & lock fingers onto bolts at catch height.
      const hoverU = easeInOut(u / 0.42);
      liftNorm = catchHeightNorm * (1 - 0.08 * hoverU);
      const settle = 1 - hoverU;
      indexLocal = {
        x: lerp(baseIndexX + 0.03, baseIndexX, hoverU),
        y: spec.flickReach.lateral * 0.1 * settle,
        z: liftNorm + fingerZ + 0.05 * settle,
      };
      middleLocal = {
        x: lerp(baseMiddleX - 0.02, baseMiddleX, hoverU),
        y: spec.scoopSweep.lateral * 0.1 * settle,
        z: liftNorm + fingerZ + 0.05 * settle,
      };
      phaseReadout = `CATCH ${Math.round(catchHeightNorm * 98)}mm`;
    } else if (u < 0.86) {
      // Controlled ride-down back to resting surface.
      const dropU = easeInOut((u - 0.42) / 0.44);
      liftNorm = catchHeightNorm * 0.92 * (1 - dropU);
      indexLocal = { x: baseIndexX, y: 0, z: liftNorm + fingerZ };
      middleLocal = { x: baseMiddleX, y: 0, z: liftNorm + fingerZ };
      phaseReadout = `ROLL AWAY`;
    } else {
      // Brief pause on surface before next slow-motion loop.
      liftNorm = 0;
      indexLocal = { x: baseIndexX, y: 0, z: fingerZ };
      middleLocal = { x: baseMiddleX, y: 0, z: fingerZ };
      phaseReadout = `READY`;
    }
  }

  const baseDist = baseIndexX - baseMiddleX;
  const liveDist = Math.hypot(
    indexLocal.x - middleLocal.x,
    indexLocal.y - middleLocal.y,
    indexLocal.z - middleLocal.z,
  );
  const fingerSeparation = liveDist / Math.max(0.05, baseDist);

  return {
    progress: p,
    stepIndex,
    stepLabel: spec.stepCallouts[stepIndex],
    liftNorm,
    pitchDeg,
    rollDeg,
    yawDeg,
    catchHeightNorm,
    fingerSeparation,
    indexLocal,
    middleLocal,
    phaseReadout,
  };
}

/** Generates a 3D skateboard perimeter curve in local deck-length units (nose = +0.5x, tail = -0.5x). */
function buildDeckLocalMesh(setup: DeckSetupId): {
  outline: Point3D[];
  noseAccent: Point3D[];
  wheels: Point3D[];
} {
  // Pro Wood decks are wider (~34mm -> 0.35), Plastic Tech Decks slightly narrower (~30mm -> 0.30).
  const halfW = setup === "wood" ? 0.175 : 0.15;
  const halfL = 0.5;
  const kickAt = (x: number): number => {
    const ax = Math.abs(x);
    if (ax <= 0.3) return 0;
    const t = (ax - 0.3) / 0.2;
    return 0.068 * t * t;
  };

  const outline: Point3D[] = [];
  const noseAccent: Point3D[] = [];
  const nosePts = 8;

  // Nose rounded end (+0.32 .. +0.50)
  for (let i = 0; i <= nosePts; i++) {
    const a = -Math.PI / 2 + (i / nosePts) * Math.PI;
    const x = 0.33 + 0.17 * Math.cos(a);
    const y = halfW * Math.sin(a);
    const pt = { x, y, z: kickAt(x) };
    outline.push(pt);
    noseAccent.push(pt);
  }
  // Tail rounded end (-0.33 .. -0.50)
  for (let i = 0; i <= nosePts; i++) {
    const a = Math.PI / 2 + (i / nosePts) * Math.PI;
    const x = -0.33 + 0.17 * Math.cos(a);
    const y = halfW * Math.sin(a);
    outline.push({ x, y, z: kickAt(x) });
  }
  // Close subtly by ensuring wheelbase symmetry
  void halfL;

  const wheelY = halfW * 0.72;
  const wheelZ = -0.065;
  const wheels: Point3D[] = [
    { x: 0.27, y: -wheelY, z: wheelZ },
    { x: 0.27, y: wheelY, z: wheelZ },
    { x: -0.27, y: -wheelY, z: wheelZ },
    { x: -0.27, y: wheelY, z: wheelZ },
  ];

  return { outline, noseAccent, wheels };
}

/** Projects a local 3D point relative to the deck center into screen CSS pixels. */
function projectLocalPoint(
  pt: Point3D,
  pose: GhostPose,
  anchor: GhostAnchor,
  applyDeckRotation: boolean,
): { screen: Point2D; depthSignZ: number } {
  let x = pt.x;
  let y = pt.y;
  let z = pt.z;

  let normalZ = 1;

  if (applyDeckRotation) {
    // 1. Axial flip around nose-tail X axis
    const rRad = (pose.rollDeg * Math.PI) / 180;
    const cr = Math.cos(rRad);
    const sr = Math.sin(rRad);
    const y1 = y * cr - z * sr;
    const z1 = y * sr + z * cr;
    y = y1;
    z = z1;
    normalZ = cr;

    // 2. Shuvit yaw around vertical Z axis
    const yRad = (pose.yawDeg * Math.PI) / 180;
    const cy = Math.cos(yRad);
    const sy = Math.sin(yRad);
    const x2 = x * cy - y * sy;
    const y2 = x * sy + y * cy;
    x = x2;
    y = y2;

    // 3. Pop pitch (+pitchDeg lifts nose +x upward in +z)
    const pRad = (pose.pitchDeg * Math.PI) / 180;
    const cp = Math.cos(pRad);
    const sp = Math.sin(pRad);
    const x3 = x * cp - z * sp;
    const z3 = x * sp + z * cp;
    x = x3;
    z = z3;

    z += pose.liftNorm;
  }

  // Slight top-down 24 deg camera tilt so width, flip spin, and trucks read clearly in 3D.
  const camTilt = 0.42;
  const screenLocalX = x * anchor.noseSign;
  const screenLocalY = -(z * Math.cos(camTilt) - y * Math.sin(camTilt));

  // Rotate by the user's real anchored board tilt angle on screen.
  const cosT = Math.cos(anchor.tiltAngleRad);
  const sinT = Math.sin(anchor.tiltAngleRad);
  const rotX = screenLocalX * cosT - screenLocalY * sinT;
  const rotY = screenLocalX * sinT + screenLocalY * cosT;

  return {
    screen: {
      x: anchor.centerPx.x + rotX * anchor.deckLengthPx,
      y: anchor.centerPx.y + rotY * anchor.deckLengthPx,
    },
    depthSignZ: normalZ,
  };
}

/** Projects the full translucent 3D Ghost Deck, wheels, baseline, and fingertips into screen space. */
export function projectGhostDeck(
  pose: GhostPose,
  anchor: GhostAnchor,
  setup: DeckSetupId,
): ProjectedDeck {
  const mesh = buildDeckLocalMesh(setup);

  let topFacing = true;
  const outline = mesh.outline.map((pt, idx) => {
    const res = projectLocalPoint(pt, pose, anchor, true);
    if (idx === 0) topFacing = res.depthSignZ >= 0;
    return res.screen;
  });

  const noseAccent = mesh.noseAccent.map((pt) => projectLocalPoint(pt, pose, anchor, true).screen);
  const wheels = mesh.wheels.map((pt) => projectLocalPoint(pt, pose, anchor, true).screen);

  const spineTail = projectLocalPoint({ x: -0.44, y: 0, z: 0.02 }, pose, anchor, true).screen;
  const spineNose = projectLocalPoint({ x: 0.44, y: 0, z: 0.02 }, pose, anchor, true).screen;

  const baseTail = projectLocalPoint({ x: -0.48, y: 0, z: 0 }, pose, anchor, false).screen;
  const baseNose = projectLocalPoint({ x: 0.48, y: 0, z: 0 }, pose, anchor, false).screen;
  const tailPivotPx = projectLocalPoint({ x: -0.34, y: 0, z: 0 }, pose, anchor, false).screen;
  const catchApexPx = projectLocalPoint(
    { x: 0, y: 0, z: pose.catchHeightNorm },
    pose,
    anchor,
    false,
  ).screen;
  const deckCenterPx = projectLocalPoint(
    { x: 0, y: 0, z: pose.liftNorm },
    pose,
    anchor,
    false,
  ).screen;

  const indexTipPx = projectLocalPoint(pose.indexLocal, pose, anchor, false).screen;
  const middleTipPx = projectLocalPoint(pose.middleLocal, pose, anchor, false).screen;

  return {
    outline,
    spine: [spineTail, spineNose],
    noseAccent,
    wheels,
    indexTipPx,
    middleTipPx,
    baseline: [baseTail, baseNose],
    tailPivotPx,
    catchApexPx,
    deckCenterPx,
    topFacing,
  };
}
