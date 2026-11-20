export type TrickId = "ollie" | "kickflip" | "heelflip" | "pop-shuvit" | "tre-flip";

export interface FingerMark {
  finger: "I" | "M";
  /** Position on a 120×320 top-down deck, nose at the top. */
  x: number;
  y: number;
}

export interface Trick {
  id: TrickId;
  name: string;
  short: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  fingers: FingerMark[];
  /** SVG path(s) for the motion arrows in deck coordinates. */
  motion: string[];
  cue: string;
}

export const TRICKS: Trick[] = [
  {
    id: "ollie",
    name: "Ollie",
    short: "OL",
    difficulty: 1,
    fingers: [
      { finger: "I", x: 60, y: 120 },
      { finger: "M", x: 60, y: 270 },
    ],
    motion: ["M60 102 L60 62"],
    cue: "Snap the tail with your middle finger, then slide your index toward the nose to level out.",
  },
  {
    id: "kickflip",
    name: "Kickflip",
    short: "KF",
    difficulty: 2,
    fingers: [
      { finger: "I", x: 52, y: 104 },
      { finger: "M", x: 60, y: 270 },
    ],
    motion: ["M54 88 Q 62 62 96 46"],
    cue: "Pop, slide your index up and flick off the toe-side corner of the nose.",
  },
  {
    id: "heelflip",
    name: "Heelflip",
    short: "HF",
    difficulty: 2,
    fingers: [
      { finger: "I", x: 68, y: 104 },
      { finger: "M", x: 60, y: 270 },
    ],
    motion: ["M66 88 Q 58 62 24 46"],
    cue: "Pop, slide your index up and flick off the heel-side corner of the nose.",
  },
  {
    id: "pop-shuvit",
    name: "Pop Shuvit",
    short: "PS",
    difficulty: 2,
    fingers: [
      { finger: "I", x: 60, y: 96 },
      { finger: "M", x: 78, y: 268 },
    ],
    motion: ["M86 260 Q 60 296 30 268"],
    cue: "Scoop the tail backward with your middle finger. Lift your index so the deck spins 180° under you.",
  },
  {
    id: "tre-flip",
    name: "Tre Flip",
    short: "3F",
    difficulty: 4,
    fingers: [
      { finger: "I", x: 50, y: 112 },
      { finger: "M", x: 80, y: 270 },
    ],
    motion: ["M88 262 Q 60 300 30 270", "M52 96 Q 60 66 94 48"],
    cue: "Scoop the tail backward while your index flicks a kickflip. 360° shuv plus a flip.",
  },
];

export const DEFAULT_TRICK: TrickId = "ollie";

export function getTrick(id: TrickId): Trick {
  return TRICKS.find((t) => t.id === id) ?? TRICKS[0]!;
}
