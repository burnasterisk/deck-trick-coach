import type { DeckSetupId } from "./setup";

export type TrickCategory = "basics" | "flips" | "spins" | "grinds";

export interface TrickCategoryMeta {
  id: TrickCategory;
  label: string;
  short: string;
}

export const TRICK_CATEGORIES: TrickCategoryMeta[] = [
  { id: "basics", label: "Basics", short: "Basic" },
  { id: "flips", label: "Flips", short: "Flip" },
  { id: "spins", label: "Scoops/Spins", short: "Spin" },
  { id: "grinds", label: "Grinds/Slides", short: "Grind" },
];

export type TrickId =
  // Basics
  | "ollie"
  | "boned-ollie"
  | "nollie"
  | "fakie-ollie"
  | "switch-ollie"
  // Flips
  | "kickflip"
  | "heelflip"
  | "varial-kickflip"
  | "varial-heelflip"
  | "hardflip"
  | "inward-heelflip"
  | "double-kickflip"
  // Scoops/Spins
  | "pop-shuvit"
  | "fs-shuvit"
  | "360-shuvit"
  | "tre-flip"
  | "laser-flip"
  | "bigspin"
  | "gazelle-flip"
  | "impossible"
  // Grinds/Slides
  | "50-50-grind"
  | "5-0-grind"
  | "boardslide"
  | "smith-grind"
  | "crooked-grind";

export interface FingerMark {
  finger: "I" | "M";
  /** Position on a 120×320 top-down deck, nose at the top. */
  x: number;
  y: number;
}

export interface VectorControlPoint {
  /** Forward/backward along deck axis (+1 = toward nose, -1 = toward tail). */
  along: number;
  /** Perpendicular to deck axis (-1 = upward/airborne, +1 = downward/tail-pocket). */
  perp: number;
}

export interface FingerVectorGuide {
  finger: "index" | "middle";
  label: string;
  points: VectorControlPoint[];
  tone: "primary" | "hazard";
}

export interface TrickPreviewSpec {
  /** Tail/nose pop pitch angle in degrees (positive = nose pitches upward, negative = nose dips). */
  popAngleDeg: number;
  /** Axial flip rotation in degrees (+360 kickflip, -360 heelflip, +720 double, 0 ollie/shuvit). */
  flipDeg: number;
  /** Horizontal spin rotation in degrees (+180 BS shuv, -180 FS shuv, +360 tre, +540 gazelle). */
  shuvDeg: number;
  /** Peak catch height as a multiple of deck length. */
  catchHeightNorm: number;
  /** Index finger mid-air flick/extension offset during step 2 (deck-length units). */
  flickReach: { forward: number; lift: number; lateral: number };
  /** Middle finger mid-air hover/scoop clearance offset during step 2 (deck-length units). */
  scoopSweep: { back: number; lift: number; lateral: number };
  /** Clean 3-step callouts synced to the slow-motion loop. */
  stepCallouts: readonly [string, string, string];
}

export type FlickMotionKind =
  | "slide-forward"
  | "slide-back"
  | "heel-flick"
  | "toe-flick"
  | "scoop-bs"
  | "scoop-fs"
  | "wrap-tail"
  | "grind-lock";

export interface TrickMotionSignature {
  /** Which end snaps against the surface first. */
  popOrigin: "tail" | "nose";
  /** Dominant flick/scoop pattern expected from the hand. */
  flickKind: FlickMotionKind;
  /** Expected total board flip degrees (absolute or signed). */
  expectedFlipDeg: number;
  /** Expected horizontal shuvit spin degrees (0 if straight). */
  expectedShuvDeg: number;
  /** Minimum wrist rotation in degrees expected during the trick (0 if wrist should stay square). */
  minWristTurnDeg: number;
  /** Maximum wrist turn allowed before unintentional over-twist. */
  maxWristTurnDeg: number;
  /** Ideal finger curl range [0..1] for snapping & flicking without stiffness or claw-pinch. */
  idealCurlRange: readonly [number, number];
  /** True if trick is a grind/slide that expects a mid-air plateau lock. */
  isGrind: boolean;
  /** Expected pitch bias at lock/catch (+ nose high for 5-0, - nose down for crooked/boned, 0 level). */
  targetCatchPitchDeg: number;
}

export interface Trick {
  id: TrickId;
  category: TrickCategory;
  name: string;
  short: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Whether the trick intentionally flips the board around its long axis. */
  hasFlip: boolean;
  fingers: FingerMark[];
  /** SVG path(s) for the motion arrows in top-down StanceGuide deck coordinates. */
  motion: string[];
  /** Live directional vector arrows extending from index (8) & middle (12) fingertips. */
  fingerVectors: FingerVectorGuide[];
  /** Slow-motion scale-matched Ghost Deck animation parameters. */
  preview: TrickPreviewSpec;
  /** Expected kinematic signature checked by TrickAnalyzer. */
  signature: TrickMotionSignature;
  cue: string;
  cues: Record<DeckSetupId, string>;
}

const TAIL_POP_VECTOR: FingerVectorGuide = {
  finger: "middle",
  label: "POP",
  tone: "hazard",
  points: [
    { along: 0, perp: 0 },
    { along: -0.2, perp: 0.44 },
    { along: -0.1, perp: -0.5 },
  ],
};

const NOSE_POP_VECTOR: FingerVectorGuide = {
  finger: "index",
  label: "NOSE POP",
  tone: "hazard",
  points: [
    { along: 0, perp: 0 },
    { along: 0.22, perp: 0.44 },
    { along: 0.1, perp: -0.5 },
  ],
};

const HEEL_FLICK_VECTOR: FingerVectorGuide = {
  finger: "index",
  label: "HEEL FLICK",
  tone: "primary",
  points: [
    { along: 0, perp: 0 },
    { along: 0.46, perp: -0.62 },
    { along: 1.06, perp: -0.22 },
  ],
};

const TOE_FLICK_VECTOR: FingerVectorGuide = {
  finger: "index",
  label: "TOE FLICK",
  tone: "primary",
  points: [
    { along: 0, perp: 0 },
    { along: 0.44, perp: 0.38 },
    { along: 1.02, perp: -0.52 },
  ],
};

const BS_SCOOP_VECTOR: FingerVectorGuide = {
  finger: "middle",
  label: "BS SCOOP",
  tone: "hazard",
  points: [
    { along: 0, perp: 0 },
    { along: -0.38, perp: 0.64 },
    { along: -1.0, perp: 0.2 },
  ],
};

const FS_SCOOP_VECTOR: FingerVectorGuide = {
  finger: "middle",
  label: "FS PUSH",
  tone: "hazard",
  points: [
    { along: 0, perp: 0 },
    { along: -0.32, perp: -0.52 },
    { along: -0.92, perp: -0.24 },
  ],
};

export const TRICKS: Trick[] = [
  // ==================== BASICS ====================
  {
    id: "ollie",
    category: "basics",
    name: "Ollie",
    short: "OL",
    difficulty: 1,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 120 },
      { finger: "M", x: 60, y: 270 },
    ],
    motion: ["M60 102 L60 62"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "SLIDE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.42, perp: -0.45 },
          { along: 0.92, perp: -0.34 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 34,
      flipDeg: 0,
      shuvDeg: 0,
      catchHeightNorm: 0.62,
      flickReach: { forward: 0.14, lift: 0.1, lateral: 0 },
      scoopSweep: { back: 0.04, lift: 0.08, lateral: 0 },
      stepCallouts: ["1. Snap Tail", "2. Slide Nose", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "slide-forward",
      expectedFlipDeg: 0,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 35,
      idealCurlRange: [0.18, 0.62],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Snap the tail with your middle finger, then slide your index toward the nose to level out.",
    cues: {
      plastic:
        "Snap the thin plastic tail fast, then drag hard across the sandpaper grip to level the nose.",
      wood: "Press into the foam grip, pop the 5-ply tail cleanly, and let the cushion pull the deck level.",
    },
  },
  {
    id: "boned-ollie",
    category: "basics",
    name: "Boned Ollie",
    short: "BO",
    difficulty: 2,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 108 },
      { finger: "M", x: 60, y: 272 },
    ],
    motion: ["M60 94 L60 40", "M60 250 L60 205"],
    fingerVectors: [
      {
        finger: "middle",
        label: "TUCK HIGH",
        tone: "hazard",
        points: [
          { along: 0, perp: 0 },
          { along: -0.18, perp: 0.48 },
          { along: 0.08, perp: -0.78 },
        ],
      },
      {
        finger: "index",
        label: "PUSH NOSE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.56, perp: -0.45 },
          { along: 1.15, perp: -0.1 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 38,
      flipDeg: 0,
      shuvDeg: 0,
      catchHeightNorm: 0.72,
      flickReach: { forward: 0.24, lift: 0.04, lateral: 0 },
      scoopSweep: { back: 0.02, lift: 0.22, lateral: 0 },
      stepCallouts: ["1. Snap Tail", "2. Push Nose", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "slide-forward",
      expectedFlipDeg: 0,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 35,
      idealCurlRange: [0.22, 0.68],
      isGrind: false,
      targetCatchPitchDeg: -10,
    },
    cue: "Pop steep, push your index forward past the bolts to bone the nose down, and tuck your middle finger up.",
    cues: {
      plastic:
        "Whip the plastic tail and press straight into the sandpaper nose kick so the tail snaps up behind.",
      wood: "Load the foam, drag deep into the nose pocket to dip the front trucks, and suck your middle finger up.",
    },
  },
  {
    id: "nollie",
    category: "basics",
    name: "Nollie",
    short: "NL",
    difficulty: 2,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 50 },
      { finger: "M", x: 60, y: 185 },
    ],
    motion: ["M60 202 L60 250"],
    fingerVectors: [
      NOSE_POP_VECTOR,
      {
        finger: "middle",
        label: "BACK SLIDE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: -0.42, perp: -0.45 },
          { along: -0.9, perp: -0.3 },
        ],
      },
    ],
    preview: {
      popAngleDeg: -32,
      flipDeg: 0,
      shuvDeg: 0,
      catchHeightNorm: 0.56,
      flickReach: { forward: -0.04, lift: 0.1, lateral: 0 },
      scoopSweep: { back: 0.16, lift: 0.1, lateral: 0 },
      stepCallouts: ["1. Snap Nose", "2. Pull Middle", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "nose",
      flickKind: "slide-back",
      expectedFlipDeg: 0,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 38,
      idealCurlRange: [0.2, 0.65],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Snap down on the nose with your index finger while gliding forward, then drag your middle finger back to level.",
    cues: {
      plastic:
        "Push weight forward over the sandpaper nose and snap briskly with your index tip — don't stall backward.",
      wood: "Lean your palm slightly forward into the foam nose kick so the index snap rebounds the 5-ply clean.",
    },
  },
  {
    id: "fakie-ollie",
    category: "basics",
    name: "Fakie Ollie",
    short: "FK",
    difficulty: 2,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 122 },
      { finger: "M", x: 60, y: 270 },
    ],
    motion: ["M60 140 L60 95"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "FAKE SLIDE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.36, perp: -0.44 },
          { along: 0.82, perp: -0.3 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 30,
      flipDeg: 0,
      shuvDeg: 0,
      catchHeightNorm: 0.56,
      flickReach: { forward: 0.12, lift: 0.1, lateral: 0 },
      scoopSweep: { back: 0.06, lift: 0.09, lateral: 0 },
      stepCallouts: ["1. Snap Tail", "2. Level Backward", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "slide-forward",
      expectedFlipDeg: 0,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 38,
      idealCurlRange: [0.18, 0.62],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Roll backward in your normal stance, snap the tail against momentum, and float level before landing.",
    cues: {
      plastic:
        "Keep momentum moving tail-first and snap quick on the plastic kick so sandpaper drag pulls it with you.",
      wood: "Stay centered over the foam concave while rolling backward — let your wrist absorb the pop rebound.",
    },
  },
  {
    id: "switch-ollie",
    category: "basics",
    name: "Switch Ollie",
    short: "SW",
    difficulty: 3,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 126 },
      { finger: "M", x: 60, y: 268 },
    ],
    motion: ["M60 110 L60 66"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "SW SLIDE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.38, perp: -0.48 },
          { along: 0.85, perp: -0.32 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 29,
      flipDeg: 0,
      shuvDeg: 0,
      catchHeightNorm: 0.54,
      flickReach: { forward: 0.12, lift: 0.11, lateral: 0 },
      scoopSweep: { back: 0.04, lift: 0.09, lateral: 0 },
      stepCallouts: ["1. Snap Tail", "2. Tight Slide", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "slide-forward",
      expectedFlipDeg: 0,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 36,
      idealCurlRange: [0.22, 0.64],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Keep your wrist square and fingers stacked cleanly while popping off your opposite stance.",
    cues: {
      plastic:
        "Sandpaper helps grip switch slides — focus on a straight middle snap without twisting your wrist.",
      wood: "Compress evenly into the foam before popping so the heavier maple doesn't wobble sideways.",
    },
  },

  // ==================== FLIPS ====================
  {
    id: "kickflip",
    category: "flips",
    name: "Kickflip",
    short: "KF",
    difficulty: 2,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 52, y: 104 },
      { finger: "M", x: 60, y: 270 },
    ],
    motion: ["M54 88 Q 62 62 96 46"],
    fingerVectors: [TAIL_POP_VECTOR, HEEL_FLICK_VECTOR],
    preview: {
      popAngleDeg: 32,
      flipDeg: 360,
      shuvDeg: 0,
      catchHeightNorm: 0.66,
      flickReach: { forward: 0.24, lift: 0.18, lateral: -0.14 },
      scoopSweep: { back: 0.05, lift: 0.16, lateral: 0.04 },
      stepCallouts: ["1. Snap Tail", "2. Heel Flick", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "heel-flick",
      expectedFlipDeg: 360,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 40,
      idealCurlRange: [0.2, 0.64],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Pop, slide your index up and flick off the toe-side corner of the nose.",
    cues: {
      plastic:
        "Quick snap on the plastic tail and flick briskly off the sandpaper pocket for a fast spin.",
      wood: "Use the foam tape traction to guide your index up the concave before flicking the nose pocket.",
    },
  },
  {
    id: "heelflip",
    category: "flips",
    name: "Heelflip",
    short: "HF",
    difficulty: 2,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 68, y: 104 },
      { finger: "M", x: 60, y: 270 },
    ],
    motion: ["M66 88 Q 58 62 24 46"],
    fingerVectors: [TAIL_POP_VECTOR, TOE_FLICK_VECTOR],
    preview: {
      popAngleDeg: 31,
      flipDeg: -360,
      shuvDeg: 0,
      catchHeightNorm: 0.65,
      flickReach: { forward: 0.22, lift: 0.19, lateral: 0.16 },
      scoopSweep: { back: 0.05, lift: 0.16, lateral: -0.04 },
      stepCallouts: ["1. Snap Tail", "2. Toe Flick", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "toe-flick",
      expectedFlipDeg: -360,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 42,
      idealCurlRange: [0.18, 0.62],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Pop, slide your index up and flick outward off the heel-side corner of the nose.",
    cues: {
      plastic:
        "Snap sharp and push your index cleanly off the sandpaper edge so it clears the front trucks.",
      wood: "Sink into the foam grip, pop steady, and drive straight through the heel pocket of the concave.",
    },
  },
  {
    id: "varial-kickflip",
    category: "flips",
    name: "Varial Kickflip",
    short: "VK",
    difficulty: 3,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 52, y: 106 },
      { finger: "M", x: 76, y: 270 },
    ],
    motion: ["M82 262 Q 58 292 34 268", "M54 90 Q 62 62 94 48"],
    fingerVectors: [
      {
        finger: "middle",
        label: "180 SCOOP",
        tone: "hazard",
        points: [
          { along: 0, perp: 0 },
          { along: -0.34, perp: 0.56 },
          { along: -0.82, perp: 0.14 },
        ],
      },
      HEEL_FLICK_VECTOR,
    ],
    preview: {
      popAngleDeg: 30,
      flipDeg: 360,
      shuvDeg: 180,
      catchHeightNorm: 0.65,
      flickReach: { forward: 0.22, lift: 0.18, lateral: -0.14 },
      scoopSweep: { back: 0.18, lift: 0.15, lateral: 0.14 },
      stepCallouts: ["1. Snap Tail", "2. Scoop & Flick", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "heel-flick",
      expectedFlipDeg: 360,
      expectedShuvDeg: 180,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 48,
      idealCurlRange: [0.22, 0.66],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Pair a gentle 180° backside scoop with a standard kickflip flick — keep it lighter than a Tre.",
    cues: {
      plastic:
        "Don't over-scoop the light plastic tail or it turns into a Tre — half-scoop + clean sandpaper flick.",
      wood: "Let the middle finger push a controlled 180° through the foam while index flicks the nose pocket.",
    },
  },
  {
    id: "varial-heelflip",
    category: "flips",
    name: "Varial Heelflip",
    short: "VH",
    difficulty: 3,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 68, y: 106 },
      { finger: "M", x: 46, y: 270 },
    ],
    motion: ["M42 260 Q 64 292 88 266", "M66 90 Q 58 62 24 48"],
    fingerVectors: [FS_SCOOP_VECTOR, TOE_FLICK_VECTOR],
    preview: {
      popAngleDeg: 30,
      flipDeg: -360,
      shuvDeg: -180,
      catchHeightNorm: 0.64,
      flickReach: { forward: 0.21, lift: 0.19, lateral: 0.16 },
      scoopSweep: { back: 0.18, lift: 0.15, lateral: -0.14 },
      stepCallouts: ["1. Snap Tail", "2. Push & Heel", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "toe-flick",
      expectedFlipDeg: -360,
      expectedShuvDeg: -180,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 50,
      idealCurlRange: [0.2, 0.64],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Push the tail forward for a frontside shuv while your index kicks out a clean heelflip.",
    cues: {
      plastic:
        "Snap forward on the plastic tail and clear your index quickly off the sandpaper so it doesn't tangle.",
      wood: "Use the wood deck's weight to sync the FS shove with a crisp outward toe kick.",
    },
  },
  {
    id: "hardflip",
    category: "flips",
    name: "Hardflip",
    short: "HD",
    difficulty: 4,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 52, y: 108 },
      { finger: "M", x: 46, y: 270 },
    ],
    motion: ["M42 260 Q 62 292 88 264", "M54 90 Q 68 58 92 40"],
    fingerVectors: [FS_SCOOP_VECTOR, HEEL_FLICK_VECTOR],
    preview: {
      popAngleDeg: 35,
      flipDeg: 360,
      shuvDeg: -180,
      catchHeightNorm: 0.72,
      flickReach: { forward: 0.26, lift: 0.24, lateral: -0.16 },
      scoopSweep: { back: 0.16, lift: 0.2, lateral: -0.14 },
      stepCallouts: ["1. Snap Tail", "2. FS Pop & Flip", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "heel-flick",
      expectedFlipDeg: 360,
      expectedShuvDeg: -180,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 55,
      idealCurlRange: [0.24, 0.7],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Snap the tail slightly forward (FS shuv) while snapping a steep vertical kickflip between your fingers.",
    cues: {
      plastic:
        "Pop high and pull your index clear right after flicking — plastic decks want to rocket vertically here.",
      wood: "Press deep into the foam tail pocket to launch the 5-ply vertically through the flip.",
    },
  },
  {
    id: "inward-heelflip",
    category: "flips",
    name: "Inward Heelflip",
    short: "IH",
    difficulty: 4,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 68, y: 108 },
      { finger: "M", x: 76, y: 270 },
    ],
    motion: ["M82 262 Q 58 292 34 268", "M66 90 Q 52 58 26 42"],
    fingerVectors: [BS_SCOOP_VECTOR, TOE_FLICK_VECTOR],
    preview: {
      popAngleDeg: 34,
      flipDeg: -360,
      shuvDeg: 180,
      catchHeightNorm: 0.7,
      flickReach: { forward: 0.23, lift: 0.22, lateral: 0.17 },
      scoopSweep: { back: 0.19, lift: 0.18, lateral: 0.15 },
      stepCallouts: ["1. Snap Tail", "2. BS Scoop & Heel", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "toe-flick",
      expectedFlipDeg: -360,
      expectedShuvDeg: 180,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 52,
      idealCurlRange: [0.22, 0.68],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Scoop the tail backward (BS shuv) while kicking your index forward off the heel corner.",
    cues: {
      plastic:
        "Lift your palm slightly higher on pop so the light plastic can tuck 180° under your fingers cleanly.",
      wood: "Sync the foam-grip scoop with a sharp diagonal heel kick so the board spins on one plane.",
    },
  },
  {
    id: "double-kickflip",
    category: "flips",
    name: "Double Kickflip",
    short: "2K",
    difficulty: 4,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 50, y: 106 },
      { finger: "M", x: 60, y: 272 },
    ],
    motion: ["M52 88 Q 64 56 104 40"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "FAST 2X FLICK",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.52, perp: -0.72 },
          { along: 1.18, perp: -0.25 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 35,
      flipDeg: 720,
      shuvDeg: 0,
      catchHeightNorm: 0.76,
      flickReach: { forward: 0.28, lift: 0.24, lateral: -0.18 },
      scoopSweep: { back: 0.05, lift: 0.24, lateral: 0.05 },
      stepCallouts: ["1. Snap Tail", "2. Whip 2X Flick", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "heel-flick",
      expectedFlipDeg: 720,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 45,
      idealCurlRange: [0.22, 0.66],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Pop extra high and whip a fast index flick across the nose pocket — hover until both spins finish.",
    cues: {
      plastic:
        "Sandpaper + light plastic spins fast — wait an extra beat at the top before dropping to catch.",
      wood: "Give the 5-ply maple maximum pop height and flick hard right at the concave corner for 720°.",
    },
  },

  // ==================== SCOOPS / SPINS ====================
  {
    id: "pop-shuvit",
    category: "spins",
    name: "Pop Shuvit",
    short: "PS",
    difficulty: 2,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 96 },
      { finger: "M", x: 78, y: 268 },
    ],
    motion: ["M86 260 Q 60 296 30 268"],
    fingerVectors: [
      BS_SCOOP_VECTOR,
      {
        finger: "index",
        label: "CATCH",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.08, perp: -0.48 },
          { along: 0.24, perp: -0.6 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 26,
      flipDeg: 0,
      shuvDeg: 180,
      catchHeightNorm: 0.54,
      flickReach: { forward: 0.04, lift: 0.2, lateral: 0 },
      scoopSweep: { back: 0.22, lift: 0.14, lateral: 0.16 },
      stepCallouts: ["1. Snap Tail", "2. 180° Scoop", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "scoop-bs",
      expectedFlipDeg: 0,
      expectedShuvDeg: 180,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 42,
      idealCurlRange: [0.18, 0.64],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Scoop the tail backward with your middle finger while lifting your index clear for the 180°.",
    cues: {
      plastic:
        "Light scoop on the tail — light plastic decks spin fast, so keep the 180° controlled.",
      wood: "Firm backward scoop with your middle finger to swing the 5-ply maple 180° under your hand.",
    },
  },
  {
    id: "fs-shuvit",
    category: "spins",
    name: "FS Shuvit",
    short: "FS",
    difficulty: 2,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 98 },
      { finger: "M", x: 44, y: 268 },
    ],
    motion: ["M36 260 Q 60 294 88 268"],
    fingerVectors: [
      FS_SCOOP_VECTOR,
      {
        finger: "index",
        label: "GUIDE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.1, perp: -0.46 },
          { along: 0.18, perp: -0.58 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 26,
      flipDeg: 0,
      shuvDeg: -180,
      catchHeightNorm: 0.54,
      flickReach: { forward: 0.04, lift: 0.2, lateral: 0 },
      scoopSweep: { back: 0.18, lift: 0.15, lateral: -0.16 },
      stepCallouts: ["1. Snap Tail", "2. FS Push", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "scoop-fs",
      expectedFlipDeg: 0,
      expectedShuvDeg: -180,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 45,
      idealCurlRange: [0.18, 0.64],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Pop down and push the tail forward (toward knuckles) so the board whips frontside 180°.",
    cues: {
      plastic:
        "Don't slide the index off the sandpaper — lift straight up and let the middle push FS 180°.",
      wood: "Press the foam tail pocket forward on the snap so the heavy deck stays flat during the 180°.",
    },
  },
  {
    id: "360-shuvit",
    category: "spins",
    name: "360 Shuvit",
    short: "3S",
    difficulty: 3,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 96 },
      { finger: "M", x: 80, y: 270 },
    ],
    motion: ["M88 260 Q 60 302 28 264"],
    fingerVectors: [
      {
        finger: "middle",
        label: "360 SCOOP",
        tone: "hazard",
        points: [
          { along: 0, perp: 0 },
          { along: -0.42, perp: 0.72 },
          { along: -1.12, perp: 0.24 },
        ],
      },
      {
        finger: "index",
        label: "HOVER",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.08, perp: -0.56 },
          { along: 0.18, perp: -0.7 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 27,
      flipDeg: 0,
      shuvDeg: 360,
      catchHeightNorm: 0.6,
      flickReach: { forward: 0.04, lift: 0.24, lateral: 0 },
      scoopSweep: { back: 0.28, lift: 0.17, lateral: 0.2 },
      stepCallouts: ["1. Snap Tail", "2. Deep 360° Scoop", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "scoop-bs",
      expectedFlipDeg: 0,
      expectedShuvDeg: 360,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 50,
      idealCurlRange: [0.2, 0.66],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Keep your index completely flat and elevated to prevent flip while whipping a full 360° tail scoop.",
    cues: {
      plastic:
        "Keep index tip off the sandpaper edge or it'll turn into a Tre Flip — pure middle-finger snap-scoop.",
      wood: "Wrap your middle finger onto the tail rail edge and whip smoothly through the foam.",
    },
  },
  {
    id: "tre-flip",
    category: "spins",
    name: "Tre Flip",
    short: "3F",
    difficulty: 4,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 50, y: 112 },
      { finger: "M", x: 80, y: 270 },
    ],
    motion: ["M88 262 Q 60 300 30 270", "M52 96 Q 60 66 94 48"],
    fingerVectors: [
      {
        finger: "middle",
        label: "POCKET SCOOP",
        tone: "hazard",
        points: [
          { along: 0, perp: 0 },
          { along: -0.34, perp: 0.68 },
          { along: -1.06, perp: 0.24 },
        ],
      },
      HEEL_FLICK_VECTOR,
    ],
    preview: {
      popAngleDeg: 30,
      flipDeg: 360,
      shuvDeg: 360,
      catchHeightNorm: 0.7,
      flickReach: { forward: 0.22, lift: 0.21, lateral: -0.16 },
      scoopSweep: { back: 0.24, lift: 0.18, lateral: 0.18 },
      stepCallouts: ["1. Snap Tail", "2. Flick & Scoop", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "scoop-bs",
      expectedFlipDeg: 360,
      expectedShuvDeg: 360,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 52,
      idealCurlRange: [0.22, 0.68],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Scoop the tail pocket hard for 360° while your index lightly flicks the kickflip.",
    cues: {
      plastic:
        "Sharp snap-scoop and fast sandpaper flick — stay high while the light plastic whips 360°.",
      wood: "Deep foam-grip tail scoop paired with a deliberate front-finger flick for a smooth 360° catch.",
    },
  },
  {
    id: "laser-flip",
    category: "spins",
    name: "Laser Flip",
    short: "LF",
    difficulty: 5,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 68, y: 110 },
      { finger: "M", x: 42, y: 270 },
    ],
    motion: ["M34 260 Q 62 300 94 268", "M66 96 Q 58 64 24 46"],
    fingerVectors: [FS_SCOOP_VECTOR, TOE_FLICK_VECTOR],
    preview: {
      popAngleDeg: 31,
      flipDeg: -360,
      shuvDeg: -360,
      catchHeightNorm: 0.74,
      flickReach: { forward: 0.24, lift: 0.23, lateral: 0.18 },
      scoopSweep: { back: 0.24, lift: 0.2, lateral: -0.18 },
      stepCallouts: ["1. Snap Tail", "2. FS 360 + Heel", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "scoop-fs",
      expectedFlipDeg: -360,
      expectedShuvDeg: -360,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 58,
      idealCurlRange: [0.22, 0.7],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Power a deep frontside 360° tail push while your index snaps a quick outward heelflip.",
    cues: {
      plastic:
        "Whip the plastic tail forward hard and clear both tips high — sandpaper snaps the heel rotation quick.",
      wood: "Sink into the foam pocket to torque the full FS 360° before pushing out the heelflip.",
    },
  },
  {
    id: "bigspin",
    category: "spins",
    name: "Bigspin",
    short: "BG",
    difficulty: 3,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 58, y: 98 },
      { finger: "M", x: 80, y: 270 },
    ],
    motion: ["M88 262 Q 60 300 28 266", "M60 98 Q 92 72 86 40"],
    fingerVectors: [
      BS_SCOOP_VECTOR,
      {
        finger: "index",
        label: "180 WRIST",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.24, perp: -0.6 },
          { along: -0.25, perp: -0.68 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 28,
      flipDeg: 0,
      shuvDeg: 360,
      catchHeightNorm: 0.64,
      flickReach: { forward: -0.18, lift: 0.22, lateral: 0.12 },
      scoopSweep: { back: 0.18, lift: 0.18, lateral: 0.14 },
      stepCallouts: ["1. Snap Tail", "2. 360° + Wrist 180°", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "scoop-bs",
      expectedFlipDeg: 0,
      expectedShuvDeg: 360,
      minWristTurnDeg: 115,
      maxWristTurnDeg: 230,
      idealCurlRange: [0.2, 0.68],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Scoop a 360° shuvit while turning your wrist 180° in the same direction to catch it switch.",
    cues: {
      plastic:
        "Don't out-turn the fast plastic spin — initiate the 360° scoop before rotating your wrist 180°.",
      wood: "Let the 5-ply rotate smoothly beneath your wrist as you smoothly turn 180° into the catch.",
    },
  },
  {
    id: "gazelle-flip",
    category: "spins",
    name: "Gazelle Flip",
    short: "GZ",
    difficulty: 5,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 50, y: 110 },
      { finger: "M", x: 82, y: 270 },
    ],
    motion: ["M90 260 Q 58 304 24 264", "M50 96 Q 94 60 88 34"],
    fingerVectors: [
      {
        finger: "middle",
        label: "540 SCOOP",
        tone: "hazard",
        points: [
          { along: 0, perp: 0 },
          { along: -0.44, perp: 0.72 },
          { along: -1.16, perp: 0.28 },
        ],
      },
      HEEL_FLICK_VECTOR,
    ],
    preview: {
      popAngleDeg: 32,
      flipDeg: 360,
      shuvDeg: 540,
      catchHeightNorm: 0.78,
      flickReach: { forward: 0.2, lift: 0.26, lateral: -0.18 },
      scoopSweep: { back: 0.26, lift: 0.22, lateral: 0.2 },
      stepCallouts: ["1. Snap Tail", "2. 540° Flip + 360°", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "scoop-bs",
      expectedFlipDeg: 360,
      expectedShuvDeg: 540,
      minWristTurnDeg: 180,
      maxWristTurnDeg: 390,
      idealCurlRange: [0.24, 0.72],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Unwind a massive 540° BS scoop + kickflip while whipping a full 360° wrist spin around the board.",
    cues: {
      plastic:
        "Pop high so the light deck clears 540°+flip while you whip a crisp 360° wrist rotation over top.",
      wood: "Pre-load the foam tail deeply; keep fingers relaxed during the 360° wrist turn so you catch bolts.",
    },
  },
  {
    id: "impossible",
    category: "spins",
    name: "Impossible",
    short: "IM",
    difficulty: 4,
    hasFlip: true,
    fingers: [
      { finger: "I", x: 60, y: 108 },
      { finger: "M", x: 62, y: 274 },
    ],
    motion: ["M62 256 C 24 210 24 140 62 110"],
    fingerVectors: [
      {
        finger: "middle",
        label: "VERTICAL WRAP",
        tone: "hazard",
        points: [
          { along: 0, perp: 0 },
          { along: -0.24, perp: -0.68 },
          { along: 0.16, perp: -0.82 },
        ],
      },
      {
        finger: "index",
        label: "CLEAR UP",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.12, perp: -0.6 },
          { along: 0.28, perp: -0.72 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 58,
      flipDeg: 360,
      shuvDeg: 0,
      catchHeightNorm: 0.72,
      flickReach: { forward: 0.08, lift: 0.28, lateral: 0 },
      scoopSweep: { back: -0.1, lift: 0.18, lateral: 0.06 },
      stepCallouts: ["1. Snap Tail", "2. Vertical Wrap", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "wrap-tail",
      expectedFlipDeg: 360,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 45,
      idealCurlRange: [0.3, 0.78],
      isGrind: false,
      targetCatchPitchDeg: 0,
    },
    cue: "Lift your index out of the way and curl your middle finger backward so the deck wraps vertically 360° around it.",
    cues: {
      plastic:
        "Curl your middle finger gently into the plastic pocket — light decks wrap super fast if you lift index cleanly.",
      wood: "Foam traction hugs your middle pad during the wrap; keep your index straight up until the tail swings back.",
    },
  },

  // ==================== GRINDS / SLIDES ====================
  {
    id: "50-50-grind",
    category: "grinds",
    name: "50-50 Grind",
    short: "50",
    difficulty: 2,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 118 },
      { finger: "M", x: 60, y: 268 },
    ],
    motion: ["M60 112 L60 72", "M44 160 L76 160"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "LEVEL LOCK",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.44, perp: -0.42 },
          { along: 0.9, perp: -0.05 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 30,
      flipDeg: 0,
      shuvDeg: 0,
      catchHeightNorm: 0.56,
      flickReach: { forward: 0.14, lift: 0.06, lateral: 0 },
      scoopSweep: { back: 0.04, lift: 0.06, lateral: 0 },
      stepCallouts: ["1. Snap Tail", "2. Lock Trucks", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "grind-lock",
      expectedFlipDeg: 0,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 32,
      idealCurlRange: [0.2, 0.62],
      isGrind: true,
      targetCatchPitchDeg: 0,
    },
    cue: "Ollie onto rail height, lock both trucks level for a smooth hold, then pop or drop clean.",
    cues: {
      plastic:
        "Plastic trucks slide slick — apply steady downward balance across both tips once locked.",
      wood: "Keep even pressure over the foam bolts during the lock hold so neither truck slips off the coping.",
    },
  },
  {
    id: "5-0-grind",
    category: "grinds",
    name: "5-0 Grind",
    short: "50+",
    difficulty: 3,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 118 },
      { finger: "M", x: 60, y: 274 },
    ],
    motion: ["M60 112 L60 74", "M60 264 L60 222"],
    fingerVectors: [
      {
        finger: "middle",
        label: "PRESS TAIL",
        tone: "hazard",
        points: [
          { along: 0, perp: 0 },
          { along: -0.2, perp: 0.44 },
          { along: -0.1, perp: -0.22 },
        ],
      },
      {
        finger: "index",
        label: "NOSE UP",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.35, perp: -0.58 },
          { along: 0.65, perp: -0.55 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 32,
      flipDeg: 0,
      shuvDeg: 0,
      catchHeightNorm: 0.58,
      flickReach: { forward: 0.1, lift: 0.16, lateral: 0 },
      scoopSweep: { back: 0.04, lift: 0.03, lateral: 0 },
      stepCallouts: ["1. Snap Tail", "2. Lock Back Truck", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "grind-lock",
      expectedFlipDeg: 0,
      expectedShuvDeg: 0,
      minWristTurnDeg: 0,
      maxWristTurnDeg: 35,
      idealCurlRange: [0.22, 0.65],
      isGrind: true,
      targetCatchPitchDeg: 18,
    },
    cue: "Pop onto the rail holding the nose pitched ~18°–24° high on just the back truck before dropping out.",
    cues: {
      plastic:
        "Don't let the plastic tail scrape drag you backward — hover the index lightly to hold the manual balance.",
      wood: "Sink your middle finger pad onto the foam tail pocket to balance the 5-0 cleanly.",
    },
  },
  {
    id: "boardslide",
    category: "grinds",
    name: "Boardslide",
    short: "BS",
    difficulty: 2,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 60, y: 118 },
      { finger: "M", x: 60, y: 268 },
    ],
    motion: ["M60 112 L60 72", "M40 160 Q 60 140 88 164"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "90° TURN",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.38, perp: -0.52 },
          { along: 0.15, perp: -0.68 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 28,
      flipDeg: 0,
      shuvDeg: 90,
      catchHeightNorm: 0.56,
      flickReach: { forward: 0.08, lift: 0.12, lateral: 0.14 },
      scoopSweep: { back: 0.08, lift: 0.12, lateral: -0.14 },
      stepCallouts: ["1. Snap Tail", "2. Turn 90° & Slide", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "grind-lock",
      expectedFlipDeg: 0,
      expectedShuvDeg: 90,
      minWristTurnDeg: 55,
      maxWristTurnDeg: 130,
      idealCurlRange: [0.2, 0.65],
      isGrind: true,
      targetCatchPitchDeg: 0,
    },
    cue: "Ollie cleanly and rotate your wrist 90° so the middle of the deck locks perpendicular across the rail.",
    cues: {
      plastic:
        "Slick plastic slides super fast — rotate a crisp 90° wrist turn and counter-twist back straight on exit.",
      wood: "Keep fingers centered over the middle of the foam tape while holding the 90° slide angle.",
    },
  },
  {
    id: "smith-grind",
    category: "grinds",
    name: "Smith Grind",
    short: "SM",
    difficulty: 4,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 64, y: 110 },
      { finger: "M", x: 56, y: 270 },
    ],
    motion: ["M60 104 L76 64", "M56 262 L44 230"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "DIP NOSE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.48, perp: -0.42 },
          { along: 0.88, perp: 0.12 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 32,
      flipDeg: 0,
      shuvDeg: 32,
      catchHeightNorm: 0.58,
      flickReach: { forward: 0.16, lift: 0.02, lateral: 0.1 },
      scoopSweep: { back: 0.06, lift: 0.08, lateral: -0.06 },
      stepCallouts: ["1. Snap Tail", "2. Pinch & Dip Nose", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "grind-lock",
      expectedFlipDeg: 0,
      expectedShuvDeg: 35,
      minWristTurnDeg: 18,
      maxWristTurnDeg: 68,
      idealCurlRange: [0.24, 0.68],
      isGrind: true,
      targetCatchPitchDeg: -14,
    },
    cue: "Pop into a slight angled back-truck lock while dipping the nose down past the rail edge.",
    cues: {
      plastic:
        "Pinch your middle tip lightly on the back heel side so the slick plastic truck doesn't bounce off.",
      wood: "Use foam grip friction with your index tip to hold that tweaked nose-down pinch through the slide.",
    },
  },
  {
    id: "crooked-grind",
    category: "grinds",
    name: "Crooked Grind",
    short: "CK",
    difficulty: 4,
    hasFlip: false,
    fingers: [
      { finger: "I", x: 54, y: 92 },
      { finger: "M", x: 64, y: 266 },
    ],
    motion: ["M54 88 L36 52", "M64 256 L78 220"],
    fingerVectors: [
      TAIL_POP_VECTOR,
      {
        finger: "index",
        label: "PINCH NOSE",
        tone: "primary",
        points: [
          { along: 0, perp: 0 },
          { along: 0.5, perp: -0.36 },
          { along: 0.85, perp: 0.14 },
        ],
      },
    ],
    preview: {
      popAngleDeg: 31,
      flipDeg: 0,
      shuvDeg: -35,
      catchHeightNorm: 0.58,
      flickReach: { forward: 0.18, lift: 0.02, lateral: -0.1 },
      scoopSweep: { back: 0.05, lift: 0.12, lateral: 0.08 },
      stepCallouts: ["1. Snap Tail", "2. Pinch Crook", "3. Hover & Catch"],
    },
    signature: {
      popOrigin: "tail",
      flickKind: "grind-lock",
      expectedFlipDeg: 0,
      expectedShuvDeg: -35,
      minWristTurnDeg: 18,
      maxWristTurnDeg: 68,
      idealCurlRange: [0.24, 0.7],
      isGrind: true,
      targetCatchPitchDeg: -16,
    },
    cue: "Ollie onto the front truck slightly tweaked nose-down, locking your index into the nose pinch.",
    cues: {
      plastic:
        "Press lightly into the sandpaper nose pocket so the slick truck stays tweaked without slipping into 50-50.",
      wood: "Sink your index pad into the foam nose kick to lock the crooked pinch, then nudge forward to exit.",
    },
  },
];

export const DEFAULT_TRICK: TrickId = "ollie";

export function getTrick(id: TrickId): Trick {
  return TRICKS.find((t) => t.id === id) ?? TRICKS[0]!;
}

export function getTricksByCategory(category: TrickCategory): Trick[] {
  return TRICKS.filter((t) => t.category === category);
}

export function getTrickCue(trick: Trick, setup?: DeckSetupId): string {
  return setup ? trick.cues[setup] : trick.cue;
}
