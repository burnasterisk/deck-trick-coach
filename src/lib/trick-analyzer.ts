import type { BoardTrackTelemetry } from "./board-tracker";
import { shortestAngleDeltaDeg, type HandKinematics } from "./hand-kinematics";
import { getDeckSetup, type DeckSetupId, type TrackingSensitivity } from "./setup";
import { getTrick, type Trick, type TrickId } from "./tricks";

export interface TipPoint {
  x: number;
  y: number;
}

export interface Tips {
  index: TipPoint;
  middle: TipPoint;
}

export type LandingKind = "clean" | "sketchy" | "primo" | "rocket";
export type PopTimingKind = "crisp" | "early-slide" | "late-flick" | "weak-snap";

export interface CorrectionArrow {
  /** Which tracked element the correction applies to. */
  target: "index" | "middle" | "wrist";
  /** Concise actionable tag rendered next to the arrow on the replay canvas. */
  label: string;
  /** Offset from the target's key-moment position in normalized frame units. */
  fromOffset: TipPoint;
  ctrlOffset: TipPoint;
  toOffset: TipPoint;
  /** Visual accent color token ("hazard" | "primary" | "cyan"). */
  tone: "hazard" | "primary" | "cyan";
}

export interface ReplayFrame {
  /** Milliseconds since attempt pop onset. */
  tMs: number;
  index: TipPoint;
  middle: TipPoint;
  boardPitchDeg: number;
  flipDeg: number;
  wristRotDeg: number;
}

export interface AttemptMetrics {
  /** Highest both fingertips rose above their resting level, as a fraction of frame height. */
  peakPop: number;
  /** Distance between the two fingertips at the top of the pop, fraction of frame width. */
  spread: number;
  /** Horizontal travel of the front (index) finger during the pop, + toward the nose. */
  flick: number;
  /** Vertical difference between the fingertips at the catch — 0 is perfectly level. */
  levelness: number;
  /** Tracked board pitch angle in degrees at catch/landing. */
  boardPitchDeg?: number;
  /** Accumulated flip rotation in degrees tracked while airborne. */
  flipRotationDeg?: number;
  /** Detected landing classification from fingertip + board telemetry. */
  landingKind?: LandingKind;
  /** Peak/net wrist rotation in degrees measured between pop and catch. */
  wristRotationDeg?: number;
  /** Average index finger curl [0..1] during pop & flick. */
  indexCurl?: number;
  /** Average middle finger curl [0..1] during tail snap & catch. */
  middleCurl?: number;
  /** Pop-to-slide timing window classification. */
  popTiming?: PopTimingKind;
  /** Milliseconds between tail/nose snap and front/back slide initiation. */
  popLeadMs?: number;
  /** Milliseconds held steady near apex plateau (for grinds/slides). */
  grindHoldMs?: number;
}

export interface Diagnosis {
  title: string;
  advice: string;
  tip: string;
  /** Detailed mechanical explanation of WHY the attempt failed (or succeeded) on this setup. */
  whyFailed: string;
}

export interface Attempt {
  id: number;
  trickId: string;
  setup?: DeckSetupId;
  metrics: AttemptMetrics;
  score: number;
  diagnosis: Diagnosis;
  /** Whether hand & board motion actually matched the selected trick's signature. */
  trickMatched: boolean;
  /** 0..100 match percentage against the selected trick's expected motion. */
  matchConfidence: number;
  /** Human summary of what the motion resembled (e.g., "Clean Kickflip", "Flat Ollie"). */
  detectedMotionLabel: string;
  /** Specific failure reasons surfaced for coach feedback. */
  failureReasons: string[];
  /** Visual correction vectors overlaid onto the attempt replay canvas. */
  correctionArrows: CorrectionArrow[];
  /** Recorded trajectory frames for interactive post-attempt replay. */
  replayFrames: ReplayFrame[];
}

const DEFAULT_SENSITIVITY: TrackingSensitivity = {
  popTrigger: 0.06,
  landBand: 0.03,
  smoothing: 0.5,
  peakScale: 0.22,
  idealSpread: 0.11,
  surfaceTolerance: 0.18,
};

const LOST_MS = 350;
const COOLDOWN_MS = 1200;
const MAX_AIR_MS = 2500;
const MAX_REPLAY_FRAMES = 72;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function spreadOf(tips: Tips) {
  return Math.hypot(tips.index.x - tips.middle.x, tips.index.y - tips.middle.y);
}

type DiagnosisKey =
  | "DEAD_POP"
  | "PRIMO_LANDING"
  | "ROCKET_OLLIE"
  | "EARLY_SLIDE"
  | "LATE_FLICK"
  | "STIFF_FINGERS"
  | "CLAW_GRIP"
  | "MISSING_WRIST_TURN"
  | "WRIST_TWISTED"
  | "TRICK_MISMATCH"
  | "MISSED_GRIND_LOCK"
  | "SKETCHY_CATCH"
  | "SPLIT_STANCE"
  | "CLEAN_POP"
  | "SLOPPY_SLIDE";

const DIAGNOSIS_BY_SETUP: Record<"default" | DeckSetupId, Record<DiagnosisKey, Diagnosis>> = {
  default: {
    DEAD_POP: {
      title: "DEAD POP",
      advice: "Barely left the deck — snap the tail down harder, then slide.",
      tip: "Press into the tail until the wheels beg for mercy.",
      whyFailed:
        "Vertical rise stayed below launch threshold, so the tail didn't rebound cleanly off the table before your fingers lifted.",
    },
    PRIMO_LANDING: {
      title: "PRIMO LANDING",
      advice: "Caught it primo on the rail — under-rotated the flip.",
      tip: "Commit to a sharper flick off the nose pocket to complete the 360°.",
      whyFailed:
        "Board rotation stalled near 90°/270° and landed edge-on because your catch dropped before the flip finished.",
    },
    ROCKET_OLLIE: {
      title: "ROCKET OLLIE",
      advice: "Rocket Ollie — slide that front finger up to level the deck.",
      tip: "Think 'level out at the top', not 'launch and pray'.",
      whyFailed:
        "Front finger stayed behind the nose bolts or popped too upright, leaving the nose pitched steep at catch.",
    },
    EARLY_SLIDE: {
      title: "EARLY SLIDE",
      advice: "Front finger slid forward before the tail even hit the table.",
      tip: "Click the tail first, then drag or flick a split-second after.",
      whyFailed:
        "Initiating the slide before tail impact kills upward tail rebound, muting pop height and throwing off flip timing.",
    },
    LATE_FLICK: {
      title: "LATE FLICK",
      advice: "Delayed the flick past the apex — board ran out of hang time.",
      tip: "Snap and whip your flick continuously as the nose rises.",
      whyFailed:
        "Waiting too long after pop forces the flick while already descending, causing low, under-rotated catches.",
    },
    STIFF_FINGERS: {
      title: "STIFF FINGERS",
      advice: "Fingers stayed flat and stiff — curl your knuckles slightly to load the pop.",
      tip: "Keep a natural ~30° arch in both index and middle joints.",
      whyFailed:
        "Locked-straight fingers skim flat across grip tape without hooking the concave pocket for leverage.",
    },
    CLAW_GRIP: {
      title: "CLAW GRIP",
      advice: "Over-curled claw grip choked the pop and blocked board clearance.",
      tip: "Relax your palm and catch with the finger pads, not vertical fingernails.",
      whyFailed:
        "Excessive curl drops knuckles straight onto the deck path, pinching rotation and damping rebound.",
    },
    MISSING_WRIST_TURN: {
      title: "MISSING WRIST TURN",
      advice: "Board needed your wrist to rotate cleanly with the trick.",
      tip: "Lead smoothly with your forearm & wrist through the middle of the arc.",
      whyFailed:
        "Your fingers tried to spin the deck alone while your wrist stayed frozen square to the launch line.",
    },
    WRIST_TWISTED: {
      title: "WRIST TWISTED",
      advice: "Wrist twisted off-axis mid-air and pulled the deck crooked.",
      tip: "Keep your knuckles square over the bolts from pop through catch.",
      whyFailed:
        "Unwanted wrist yaw turned a straight trick sideways, forcing an off-line landing.",
    },
    TRICK_MISMATCH: {
      title: "TRICK MISMATCH",
      advice: "Hand motion didn't match the selected trick's flick/scoop path.",
      tip: "Toggle Ghost Deck to trace the exact step-by-step finger separation.",
      whyFailed:
        "Measured flip/scoop motion diverged from the selected trick's required rotation and finger direction.",
    },
    MISSED_GRIND_LOCK: {
      title: "MISSED GRIND LOCK",
      advice: "Dropped straight down without holding a steady rail lock at apex.",
      tip: "Level over the rail line and pause your weight across the trucks.",
      whyFailed:
        "No stable mid-air plateau was detected — trucks grazed past instead of locking onto the obstacle.",
    },
    SKETCHY_CATCH: {
      title: "SKETCHY CATCH",
      advice: "Sketchy landing — hover for the mid-air catch.",
      tip: "Catch the deck at the knuckles, not the fingertips.",
      whyFailed:
        "Fingertips hit off-level or off-rotation at touchdown, wobbling the deck on landing.",
    },
    SPLIT_STANCE: {
      title: "SPLIT STANCE",
      advice: "Fingers drifted apart mid-air — keep 'em stacked over the bolts.",
      tip: "Pinch the deck between index and middle, don't carry it.",
      whyFailed:
        "Excessive finger separation stretched past the nose/tail kicks, losing board control before catch.",
    },
    CLEAN_POP: {
      title: "CLEAN POP",
      advice: "Crisp pop, level catch — cooked that one.",
      tip: "Send it bigger — you've got pop to spare.",
      whyFailed:
        "Tail snap, finger curl arch, timing cadence, and level bolt catch all locked in cleanly.",
    },
    SLOPPY_SLIDE: {
      title: "SLOPPY SLIDE",
      advice: "Pop's there, form's loose — slide straight up the grip tape.",
      tip: "Slow it down: pop, slide, level, catch.",
      whyFailed:
        "Sufficient height, but uneven finger spacing or loose tracking reduced overall precision.",
    },
  },
  plastic: {
    DEAD_POP: {
      title: "DEAD POP",
      advice: "Barely popped the plastic — snap the tail down sharper.",
      tip: "Sandpaper rewards speed over weight — whip the tail fast.",
      whyFailed:
        "Thin plastic has almost zero flex rebound; without a fast whip-snap into the tail, the deck barely leaves the table.",
    },
    PRIMO_LANDING: {
      title: "PRIMO LANDING",
      advice: "Landed primo on the plastic edge — stopped half-flip short.",
      tip: "Flick faster off the sandpaper corner and stay higher above the wheels.",
      whyFailed:
        "Low-inertia plastic loses spin fast when your finger drags the sandpaper edge mid-flip, trapping it sideways on the rail.",
    },
    ROCKET_OLLIE: {
      title: "ROCKET OLLIE",
      advice: "Rocket landing — nose stayed pitched high, drag harder across the sandpaper.",
      tip: "Bite the gritty nose pocket to bone the deck flat.",
      whyFailed:
        "Sandpaper has zero cushion—if your index doesn't drag up into the nose kick immediately after tail pop, the light deck stays nose-high.",
    },
    EARLY_SLIDE: {
      title: "EARLY SLIDE",
      advice: "Dragged across the sandpaper before snapping the plastic tail.",
      tip: "Wait for the crisp plastic click, then immediately bite the grit forward.",
      whyFailed:
        "Gritty sandpaper grabs immediately; sliding early pulls the light deck sideways before the tail bounces off the surface.",
    },
    LATE_FLICK: {
      title: "LATE FLICK",
      advice: "Flicked late on a light plastic deck that already started falling.",
      tip: "Whip the index off the nose edge the instant you hear the tail click.",
      whyFailed:
        "Lightweight plastic drops fast—hesitating past apex leaves zero vertical runway for the sandpaper flick to complete rotation.",
    },
    STIFF_FINGERS: {
      title: "STIFF FINGERS",
      advice: "Flat, stiff fingers skated right across the rough sandpaper.",
      tip: "Arch your knuckles slightly so finger pads dig into the grit pocket.",
      whyFailed:
        "Rough sandpaper demands fingertip pad angle; locked-straight fingers bounce off the grit without catching the nose concave.",
    },
    CLAW_GRIP: {
      title: "CLAW GRIP",
      advice: "Over-curled claw pinned the lightweight plastic deck down.",
      tip: "Lighten your touch — let plastic spin freely under relaxed pads.",
      whyFailed:
        "Heavy downward claw pressure stalls a featherweight plastic deck, choking its pop before the trucks clear.",
    },
    MISSING_WRIST_TURN: {
      title: "MISSING WRIST TURN",
      advice: "Turn your wrist with the spin instead of forcing plastic with fingertips.",
      tip: "Let your forearm pivot smoothly while the light deck spins beneath.",
      whyFailed:
        "Trying to torque a 180°/90° trick purely with finger push on slick plastic shoots the board away instead of rotating under your hand.",
    },
    WRIST_TWISTED: {
      title: "WRIST TWISTED",
      advice: "Extra wrist twist whipped the light plastic deck off-axis.",
      tip: "Lock wrist straight — light plastic magnifies even tiny hand twists.",
      whyFailed:
        "Because plastic decks have low rotational inertia, unwanted wrist yaw spun the nose offline right off the pop.",
    },
    TRICK_MISMATCH: {
      title: "TRICK MISMATCH",
      advice: "Your sandpaper flick didn't produce the selected trick's motion.",
      tip: "Match the Ghost Deck arrow vector — light plastic responds to crisp direction.",
      whyFailed:
        "Measured flip/scoop trajectory matched a different maneuver than the trick you selected.",
    },
    MISSED_GRIND_LOCK: {
      title: "MISSED GRIND LOCK",
      advice: "Slipped straight off the obstacle — plastic trucks need steady centered pressure.",
      tip: "Freeze both pads over the bolts on contact to hold the slick grind.",
      whyFailed:
        "Hard plastic trucks have minimal rail bite, so failing to pause cleanly at lock height let the board slide straight off.",
    },
    SKETCHY_CATCH: {
      title: "SKETCHY CATCH",
      advice: "Sketchy landing — bounced off the hard plastic, soften the catch mid-air.",
      tip: "Meet the deck gently with your finger pads, not stiff tips.",
      whyFailed:
        "Hard plastic + sandpaper doesn't absorb impact; catching unevenly or mid-rotation bounced the deck off-balance.",
    },
    SPLIT_STANCE: {
      title: "SPLIT STANCE",
      advice: "Fingers slipped off the narrow deck — stay stacked over the bolts.",
      tip: "Keep a tighter pinch so the light deck doesn't wander.",
      whyFailed:
        "Narrow ~30mm plastic width leaves tight margin; wide finger drift dropped your tips off the bolt pockets.",
    },
    CLEAN_POP: {
      title: "CLEAN POP",
      advice: "Crisp plastic snap and locked straight onto the sandpaper.",
      tip: "Clean bolts — push the nose further forward for extra height.",
      whyFailed:
        "Fast plastic tail click, clean sandpaper bite, square wrist, and dead-level catch.",
    },
    SLOPPY_SLIDE: {
      title: "SLOPPY SLIDE",
      advice: "Snap is there, slide slipped — bite harder into the grit.",
      tip: "Pop fast, catch the sandpaper grain, and press flat.",
      whyFailed:
        "Solid plastic pop height, though finger spacing drifted slightly along the narrow sandpaper.",
    },
  },
  wood: {
    DEAD_POP: {
      title: "DEAD POP",
      advice: "Didn't load the 5-ply — compress into the foam grip before snapping.",
      tip: "Let your fingertips sink into the foam, then pop through the tail.",
      whyFailed:
        "Heavier 34mm 5-ply maple needs brief downward compression into the foam tape to spring upward off the tail.",
    },
    PRIMO_LANDING: {
      title: "PRIMO LANDING",
      advice: "Caught primo on the 5-ply rail — flip stopped ~90° short.",
      tip: "Snap cleaner and hold your fingers up a beat longer for the full flip.",
      whyFailed:
        "5-ply maple carries real rotational mass; dropping your catch early traps the thick wooden rail edge-on.",
    },
    ROCKET_OLLIE: {
      title: "ROCKET OLLIE",
      advice: "Rocket landing — board pitched nose-high, use the foam traction to drag level.",
      tip: "Roll your index forward into the nose concave at the apex.",
      whyFailed:
        "Foam grip grabs reliably, so a nose-high rocket means your index stalled halfway up the concave instead of driving past the front bolts.",
    },
    EARLY_SLIDE: {
      title: "EARLY SLIDE",
      advice: "Rushed the foam slide before compressing the 5-ply tail down.",
      tip: "Pause 20ms to sink into the foam tail snap, then roll your index forward.",
      whyFailed:
        "Sliding early on plush foam grip absorbs your energy sideways before the maple tail snaps against the surface.",
    },
    LATE_FLICK: {
      title: "LATE FLICK",
      advice: "Delayed the flick after popping the maple — lost upward momentum.",
      tip: "Keep one fluid motion: compress foam, click tail, whip through nose pocket.",
      whyFailed:
        "Heavy 5-ply maple drops quickly once apex passes; late flicking hits the nose after gravity already took over.",
    },
    STIFF_FINGERS: {
      title: "STIFF FINGERS",
      advice: "Flat fingers missed the concave pocket — soften and curl to sink into the foam.",
      tip: "Arch your finger pads so foam grip locks naturally onto your skin.",
      whyFailed:
        "Plush foam tape activates through downward pad arch; stiff straight fingers glide lightly over the top without gripping.",
    },
    CLAW_GRIP: {
      title: "CLAW GRIP",
      advice: "Over-curled claw pinched the foam and killed maple rebound.",
      tip: "Open your finger arch so pads rest plush against the 34mm concave.",
      whyFailed:
        "Digging vertical fingertips too hard into soft foam pins the 5-ply against the table and blocks upward tail spring.",
    },
    MISSING_WRIST_TURN: {
      title: "MISSING WRIST TURN",
      advice: "Rotate your wrist cleanly through the arc so the 5-ply carries with your hand.",
      tip: "Keep foam-pad contact light while pivoting your wrist smoothly around the spin.",
      whyFailed:
        "A 34mm wood deck won't whip around without forearm/wrist follow-through matching the board rotation.",
    },
    WRIST_TWISTED: {
      title: "WRIST TWISTED",
      advice: "Wrist twist pulled the 5-ply sideways off the pop line.",
      tip: "Track both knuckles square over the 34mm bolts while foam levels the deck.",
      whyFailed:
        "Rolling your wrist mid-ollie torqued the high-grip foam sideways instead of leveling straight up the nose.",
    },
    TRICK_MISMATCH: {
      title: "TRICK MISMATCH",
      advice: "Actual hand path & board rotation didn't match the selected trick.",
      tip: "Use Ghost Deck to align your foam scoop/flick path with this trick.",
      whyFailed:
        "Measured board rotation and fingertip travel followed a different trick pattern than requested.",
    },
    MISSED_GRIND_LOCK: {
      title: "MISSED GRIND LOCK",
      advice: "Bounced past the rail — settle gently into the foam to lock both trucks.",
      tip: "Use the foam's cushion to absorb impact right at coping height before sliding.",
      whyFailed:
        "No steady lock hold occurred at apex; continuous up-down motion skipped over the grind zone.",
    },
    SKETCHY_CATCH: {
      title: "SKETCHY CATCH",
      advice: "Sketchy catch — board wobbled on touchdown, meet the foam grip flat.",
      tip: "Give the maple deck a beat to rise into your palm before pressing down.",
      whyFailed:
        "Uneven finger height or off-degree rotation forced an off-center stomp onto the 34mm concave.",
    },
    SPLIT_STANCE: {
      title: "SPLIT STANCE",
      advice: "Stance stretched past the 34mm bolts — stack tighter over the concave.",
      tip: "Guide the board with foam friction instead of spreading apart.",
      whyFailed:
        "Spreading fingers too wide over the nose/tail kicks unbalances the heavier wood deck during catch.",
    },
    CLEAN_POP: {
      title: "CLEAN POP",
      advice: "Bolts! Heavy 5-ply pop with a plush foam-grip catch.",
      tip: "Control is dialed — tweak it higher and hold the mid-air float.",
      whyFailed:
        "Ideal foam compression, crisp maple pop timing, balanced finger arch, and level bolt catch.",
    },
    SLOPPY_SLIDE: {
      title: "SLOPPY SLIDE",
      advice: "Good maple pop, loose drag — let the foam tape carry your index.",
      tip: "Smooth cadence: compress foam, pop tail, glide forward, catch.",
      whyFailed:
        "Strong vertical pop, with minor finger alignment drift across the foam tape at apex.",
    },
  },
};

export function classifyLanding(
  m: AttemptMetrics,
  scale = 1,
  primoScore = 0,
  targetPitchDeg = 0,
): LandingKind {
  const flipMod180 = m.flipRotationDeg !== undefined ? ((m.flipRotationDeg % 180) + 180) % 180 : 0;
  const nearQuarterFlip =
    m.flipRotationDeg !== undefined && m.flipRotationDeg > 45 && Math.abs(flipMod180 - 90) < 26;

  if (primoScore >= 0.62 || nearQuarterFlip) {
    return "primo";
  }

  // Allow intentional pitch for tricks like 5-0 Grind (+18°) or Crooked (-16°).
  const rawPitch = m.boardPitchDeg ?? 0;
  const effectivePitch =
    targetPitchDeg !== 0 ? Math.abs(rawPitch - targetPitchDeg) : Math.abs(rawPitch);

  if (targetPitchDeg === 0 && (m.levelness > 0.09 * scale || effectivePitch >= 18)) {
    return "rocket";
  }
  if (targetPitchDeg !== 0 && effectivePitch >= 22) {
    return "rocket";
  }

  const flipMod360 = m.flipRotationDeg !== undefined ? ((m.flipRotationDeg % 360) + 360) % 360 : 0;
  const underOverFlipped =
    m.flipRotationDeg !== undefined &&
    m.flipRotationDeg > 60 &&
    Math.min(flipMod360, 360 - flipMod360) > 35;

  if (
    (targetPitchDeg === 0 && m.levelness > 0.06 * scale) ||
    effectivePitch >= 10 ||
    underOverFlipped
  ) {
    return "sketchy";
  }
  return "clean";
}

interface MotionEval {
  trickMatched: boolean;
  matchConfidence: number;
  detectedMotionLabel: string;
  failureReasons: string[];
  primaryFault: DiagnosisKey | null;
  correctionArrows: CorrectionArrow[];
}

function evaluateTrickMatch(
  m: AttemptMetrics,
  trick: Trick,
  landingKind: LandingKind,
  scale: number,
  hasBoardTelemetry: boolean,
): MotionEval {
  const sig = trick.signature;
  const failureReasons: string[] = [];
  const correctionArrows: CorrectionArrow[] = [];
  let matchScore = 100;
  let primaryFault: DiagnosisKey | null = null;

  // 1. Pop timing check
  if (m.popTiming === "early-slide") {
    matchScore -= 18;
    failureReasons.push(
      `Front finger slid ${Math.abs(Math.round(m.popLeadMs ?? 20))}ms before tail snap`,
    );
    primaryFault = "EARLY_SLIDE";
    correctionArrows.push(
      {
        target: sig.popOrigin === "nose" ? "index" : "middle",
        label: "SNAP FIRST",
        fromOffset: { x: 0, y: -0.02 },
        ctrlOffset: { x: -0.01, y: 0.04 },
        toOffset: { x: 0, y: 0.07 },
        tone: "hazard",
      },
      {
        target: sig.popOrigin === "nose" ? "middle" : "index",
        label: "DELAY SLIDE",
        fromOffset: { x: 0, y: 0 },
        ctrlOffset: { x: 0.02, y: -0.05 },
        toOffset: { x: 0.07, y: -0.06 },
        tone: "cyan",
      },
    );
  } else if (m.popTiming === "late-flick") {
    matchScore -= 14;
    failureReasons.push(`Delayed flick ${Math.round(m.popLeadMs ?? 130)}ms after tail snap`);
    primaryFault = "LATE_FLICK";
    correctionArrows.push({
      target: "index",
      label: "FLICK EARLIER",
      fromOffset: { x: 0, y: 0 },
      ctrlOffset: { x: 0.04, y: -0.08 },
      toOffset: { x: 0.09, y: -0.05 },
      tone: "primary",
    });
  }

  // 2. Finger curl check (if MediaPipe kinematics present)
  const [minCurl, maxCurl] = sig.idealCurlRange;
  if (m.indexCurl !== undefined && m.middleCurl !== undefined) {
    const avgCurl = (m.indexCurl + m.middleCurl) / 2;
    if (avgCurl < minCurl - 0.04 || m.indexCurl < minCurl - 0.06) {
      matchScore -= 16;
      failureReasons.push(
        `Fingers too straight (${Math.round(avgCurl * 100)}% curl; aim ${Math.round(minCurl * 100)}–${Math.round(maxCurl * 100)}%)`,
      );
      if (!primaryFault) primaryFault = "STIFF_FINGERS";
      correctionArrows.push({
        target: "index",
        label: "CURL ARCH +20°",
        fromOffset: { x: -0.02, y: -0.03 },
        ctrlOffset: { x: 0.02, y: -0.08 },
        toOffset: { x: 0.05, y: 0.01 },
        tone: "cyan",
      });
    } else if (avgCurl > maxCurl + 0.09) {
      matchScore -= 16;
      failureReasons.push(
        `Over-curled claw grip (${Math.round(avgCurl * 100)}% curl pinched deck)`,
      );
      if (!primaryFault) primaryFault = "CLAW_GRIP";
      correctionArrows.push({
        target: "middle",
        label: "RELAX CLAW",
        fromOffset: { x: 0, y: 0 },
        ctrlOffset: { x: -0.02, y: -0.05 },
        toOffset: { x: -0.05, y: -0.08 },
        tone: "hazard",
      });
    }
  }

  // 3. Wrist rotation check (if kinematics present)
  if (m.wristRotationDeg !== undefined) {
    const absWrist = Math.abs(m.wristRotationDeg);
    if (sig.minWristTurnDeg > 0 && absWrist < sig.minWristTurnDeg * 0.65) {
      matchScore -= 26;
      failureReasons.push(
        `Wrist rotated only ${Math.round(absWrist)}° (needed ~${sig.minWristTurnDeg}°+ for ${trick.name})`,
      );
      if (!primaryFault) primaryFault = "MISSING_WRIST_TURN";
      correctionArrows.push({
        target: "wrist",
        label: `TURN WRIST ${sig.minWristTurnDeg}°`,
        fromOffset: { x: -0.05, y: -0.01 },
        ctrlOffset: { x: 0, y: -0.08 },
        toOffset: { x: 0.07, y: -0.01 },
        tone: "primary",
      });
    } else if (sig.minWristTurnDeg === 0 && absWrist > sig.maxWristTurnDeg) {
      matchScore -= 18;
      failureReasons.push(
        `Unintended ${Math.round(absWrist)}° wrist twist pulled the board crooked`,
      );
      if (!primaryFault) primaryFault = "WRIST_TWISTED";
      correctionArrows.push({
        target: "wrist",
        label: "KEEP WRIST SQUARE",
        fromOffset: { x: -0.05, y: 0 },
        ctrlOffset: { x: 0, y: 0 },
        toOffset: { x: 0.06, y: 0 },
        tone: "cyan",
      });
    }
  }

  // 4. Flip / Scoop trick matching
  const absExpectedFlip = Math.abs(sig.expectedFlipDeg);
  const absExpectedShuv = Math.abs(sig.expectedShuvDeg);
  const flipObserved = m.flipRotationDeg ?? 0;

  let detectedMotionLabel = trick.name;

  if (hasBoardTelemetry && absExpectedFlip >= 360) {
    const minFlipThreshold = absExpectedFlip >= 720 ? 450 : 190;
    if (flipObserved < minFlipThreshold) {
      matchScore -= 32;
      failureReasons.push(
        `Tracked only ${Math.round(flipObserved)}° flip rotation out of ${absExpectedFlip}° required`,
      );
      if (!primaryFault) {
        primaryFault = landingKind === "primo" ? "PRIMO_LANDING" : "TRICK_MISMATCH";
      }
      detectedMotionLabel = flipObserved < 80 ? "Flat / Non-Flip Pop" : "Under-Rotated Flip";
      correctionArrows.push({
        target: "index",
        label: sig.flickKind === "toe-flick" ? "WHIP HEEL EDGE" : "FLICK NOSE POCKET",
        fromOffset: { x: 0, y: 0 },
        ctrlOffset: { x: 0.05, y: -0.08 },
        toOffset: { x: 0.11, y: -0.03 },
        tone: "primary",
      });
    }
  } else if (
    hasBoardTelemetry &&
    absExpectedFlip === 0 &&
    absExpectedShuv === 0 &&
    flipObserved > 200
  ) {
    matchScore -= 24;
    failureReasons.push(
      `Board accidentally flipped ~${Math.round(flipObserved)}° on a non-flip trick`,
    );
    if (!primaryFault) primaryFault = "TRICK_MISMATCH";
    detectedMotionLabel = "Accidental Flip";
    correctionArrows.push({
      target: "index",
      label: "SLIDE CENTER",
      fromOffset: { x: 0, y: 0 },
      ctrlOffset: { x: 0.04, y: -0.05 },
      toOffset: { x: 0.08, y: -0.02 },
      tone: "cyan",
    });
  }

  // Also check directional flick/scoop travel even without flip CV
  if ((sig.flickKind === "scoop-bs" || sig.flickKind === "scoop-fs") && m.spread < 0.06 * scale) {
    matchScore -= 16;
    failureReasons.push("Tail scoop sweep was too narrow to swing full spin");
    if (!primaryFault) primaryFault = "TRICK_MISMATCH";
    correctionArrows.push({
      target: "middle",
      label: sig.flickKind === "scoop-fs" ? "PUSH TAIL FWD" : "SCOOP TAIL BACK",
      fromOffset: { x: 0, y: 0 },
      ctrlOffset: { x: -0.04, y: 0.05 },
      toOffset: { x: -0.09, y: 0.01 },
      tone: "hazard",
    });
  }

  // 5. Grind hold check
  if (sig.isGrind && m.grindHoldMs !== undefined && m.grindHoldMs < 95) {
    matchScore -= 24;
    failureReasons.push(
      `Apex lock held only ${Math.round(m.grindHoldMs)}ms (need steady >=100ms rail pause)`,
    );
    if (!primaryFault) primaryFault = "MISSED_GRIND_LOCK";
    detectedMotionLabel = "No Rail Lock (Quick Pop)";
    correctionArrows.push({
      target: "index",
      label: "HOLD RAIL LOCK",
      fromOffset: { x: -0.03, y: -0.04 },
      ctrlOffset: { x: 0.02, y: -0.04 },
      toOffset: { x: 0.07, y: -0.04 },
      tone: "primary",
    });
  }

  // 6. Landing arrows if sketchy/rocket/primo didn't already get an arrow
  if (landingKind === "rocket" && correctionArrows.length < 2) {
    failureReasons.push("Nose pitched high at catch — front finger stayed behind front bolts");
    correctionArrows.push({
      target: "index",
      label: "BONE NOSE LEVEL",
      fromOffset: { x: 0, y: -0.05 },
      ctrlOffset: { x: 0.05, y: -0.03 },
      toOffset: { x: 0.08, y: 0.04 },
      tone: "hazard",
    });
  } else if (landingKind === "primo" && correctionArrows.length === 0) {
    failureReasons.push("Deck stopped sideways on its rail at ~90° rotation");
    correctionArrows.push({
      target: "index",
      label: "FLICK FASTER",
      fromOffset: { x: 0, y: 0 },
      ctrlOffset: { x: 0.05, y: -0.08 },
      toOffset: { x: 0.1, y: -0.02 },
      tone: "primary",
    });
  } else if (landingKind === "sketchy" && correctionArrows.length === 0) {
    failureReasons.push("Off-level or uneven catch height at touchdown");
    correctionArrows.push({
      target: "index",
      label: "CATCH BOLTS EVEN",
      fromOffset: { x: 0, y: -0.04 },
      ctrlOffset: { x: 0.02, y: 0.01 },
      toOffset: { x: 0.03, y: 0.05 },
      tone: "cyan",
    });
  }

  const matchConfidence = clamp(Math.round(matchScore), 0, 100);
  const trickMatched = matchConfidence >= 65;

  if (!trickMatched && detectedMotionLabel === trick.name) {
    detectedMotionLabel = primaryFault === "EARLY_SLIDE" ? "Rushed Slide" : "Incomplete Form";
  }

  return {
    trickMatched,
    matchConfidence,
    detectedMotionLabel,
    failureReasons,
    primaryFault,
    correctionArrows: correctionArrows.slice(0, 2),
  };
}

export function scoreAttempt(
  m: AttemptMetrics,
  setup?: DeckSetupId,
  boardScale = 1,
  primoScore = 0,
  trickId: TrickId = "ollie",
  hasBoardTelemetry = false,
): {
  score: number;
  diagnosis: Diagnosis;
  landingKind: LandingKind;
  evalResult: MotionEval;
} {
  const trick = getTrick(trickId);
  const sens = setup ? getDeckSetup(setup).sensitivity : DEFAULT_SENSITIVITY;
  const scale = clamp(boardScale, 0.55, 1.75);
  const popScore = clamp(m.peakPop / (sens.peakScale * scale), 0, 1);
  const levelScore = clamp(1 - m.levelness / (0.1 * scale), 0, 1);
  const spreadScore = clamp(
    1 - Math.abs(m.spread - sens.idealSpread * scale) / (0.09 * scale),
    0,
    1,
  );
  const landingKind =
    m.landingKind ?? classifyLanding(m, scale, primoScore, trick.signature.targetCatchPitchDeg);
  const evalResult = evaluateTrickMatch(m, trick, landingKind, scale, hasBoardTelemetry);

  let penalty = 0;
  if (landingKind === "primo") penalty += 22;
  else if (landingKind === "rocket") penalty += 12;
  else if (landingKind === "sketchy") penalty += 8;

  if (!evalResult.trickMatched) penalty += 14;
  else if (evalResult.matchConfidence < 85) penalty += 5;

  const score = clamp(
    Math.round(45 * popScore + 35 * levelScore + 20 * spreadScore) - penalty,
    0,
    100,
  );

  const copy = DIAGNOSIS_BY_SETUP[setup ?? "default"];

  if (m.peakPop < (sens.popTrigger + 0.015) * scale) {
    return {
      score,
      diagnosis: copy.DEAD_POP,
      landingKind,
      evalResult: {
        ...evalResult,
        failureReasons:
          evalResult.failureReasons.length > 0
            ? evalResult.failureReasons
            : ["Low peak height off the tail snap"],
        correctionArrows:
          evalResult.correctionArrows.length > 0
            ? evalResult.correctionArrows
            : [
                {
                  target: "middle",
                  label: "SNAP HARDER",
                  fromOffset: { x: 0, y: -0.02 },
                  ctrlOffset: { x: -0.01, y: 0.05 },
                  toOffset: { x: 0, y: 0.08 },
                  tone: "hazard",
                },
              ],
      },
    };
  }
  if (landingKind === "primo") {
    return { score, diagnosis: copy.PRIMO_LANDING, landingKind, evalResult };
  }
  if (landingKind === "rocket") {
    return { score, diagnosis: copy.ROCKET_OLLIE, landingKind, evalResult };
  }
  if (evalResult.primaryFault && copy[evalResult.primaryFault]) {
    return { score, diagnosis: copy[evalResult.primaryFault], landingKind, evalResult };
  }
  if (landingKind === "sketchy") {
    return { score, diagnosis: copy.SKETCHY_CATCH, landingKind, evalResult };
  }
  if (m.spread > 0.2 * scale) {
    return {
      score,
      diagnosis: copy.SPLIT_STANCE,
      landingKind,
      evalResult: {
        ...evalResult,
        failureReasons: [...evalResult.failureReasons, "Index & middle drifted too wide at apex"],
        correctionArrows: [
          {
            target: "index",
            label: "STACK OVER BOLTS",
            fromOffset: { x: 0.05, y: -0.02 },
            ctrlOffset: { x: 0, y: -0.03 },
            toOffset: { x: -0.04, y: 0 },
            tone: "cyan",
          },
        ],
      },
    };
  }
  if (score >= 78 && evalResult.trickMatched) {
    return { score, diagnosis: copy.CLEAN_POP, landingKind, evalResult };
  }
  return { score, diagnosis: copy.SLOPPY_SLIDE, landingKind, evalResult };
}

export type AnalyzerPhase = "rest" | "air";

interface RestSample {
  now: number;
  tips: Tips;
  wristYawDeg: number | undefined;
}

/**
 * Feed it fingertip samples + optional board CV telemetry & MediaPipe kinematics each frame;
 * detects trick matching, wrist rotation, finger curl, pop timing, sketchy/primo/rocket catches,
 * setup-tailored failure explanations, and recorded replay frames with visual correction arrows.
 */
export class TrickAnalyzer {
  private phase: AnalyzerPhase = "rest";
  private restY = 0.8;
  private restYAtPop = 0.8;
  private minY = 1;
  private startIdxX = 0;
  private peakSpread = 0;
  private peakTips: Tips | null = null;
  private t0 = 0;
  private lastSeen = 0;
  private lastBoardSampleAt = 0;
  private flipDegAccum = 0;
  private maxPrimoAir = 0;
  private lastPitchDeg = 0;
  private lastAttemptAt = -COOLDOWN_MS;
  private nextId = 1;
  private smoothed: Tips | null = null;
  private setup: DeckSetupId | undefined;

  // Upgraded kinematics & timing state
  private restBuffer: RestSample[] = [];
  private popSnapAt = 0;
  private slideStartAt = 0;
  private hasSlideMoved = false;
  private startWristYaw: number | null = null;
  private startWristRoll: number | null = null;
  private peakWristRotDeg = 0;
  private indexCurlSum = 0;
  private middleCurlSum = 0;
  private curlSamples = 0;
  private grindStreakMs = 0;
  private maxGrindHoldMs = 0;
  private lastAirTickAt = 0;
  private replayFrames: ReplayFrame[] = [];

  constructor(setup?: DeckSetupId) {
    this.setup = setup;
  }

  getPhase(): AnalyzerPhase {
    return this.phase;
  }

  setSetup(setup: DeckSetupId) {
    if (this.setup !== setup) {
      this.setup = setup;
      this.reset();
    }
  }

  getSetup(): DeckSetupId | undefined {
    return this.setup;
  }

  reset() {
    this.phase = "rest";
    this.smoothed = null;
    this.peakTips = null;
    this.flipDegAccum = 0;
    this.maxPrimoAir = 0;
    this.lastPitchDeg = 0;
    this.lastBoardSampleAt = 0;
    this.restBuffer = [];
    this.popSnapAt = 0;
    this.slideStartAt = 0;
    this.hasSlideMoved = false;
    this.startWristYaw = null;
    this.startWristRoll = null;
    this.peakWristRotDeg = 0;
    this.indexCurlSum = 0;
    this.middleCurlSum = 0;
    this.curlSamples = 0;
    this.grindStreakMs = 0;
    this.maxGrindHoldMs = 0;
    this.lastAirTickAt = 0;
    this.replayFrames = [];
  }

  private pushReplayFrame(
    now: number,
    tips: Tips,
    boardPitchDeg: number,
    flipDeg: number,
    wristRotDeg: number,
  ) {
    if (this.replayFrames.length >= MAX_REPLAY_FRAMES) {
      // Thin older middle samples softly if a hang exceeds 72 frames
      this.replayFrames = this.replayFrames.filter((_, i) => i === 0 || i % 2 === 1);
    }
    this.replayFrames.push({
      tMs: Math.max(0, Math.round(now - this.t0)),
      index: { x: tips.index.x, y: tips.index.y },
      middle: { x: tips.middle.x, y: tips.middle.y },
      boardPitchDeg,
      flipDeg,
      wristRotDeg,
    });
  }

  feed(
    rawTips: Tips | null,
    surfaceY: number,
    now: number,
    mirrored: boolean,
    trickId: string,
    setupOverride?: DeckSetupId,
    boardScale = 1,
    boardTelemetry?: BoardTrackTelemetry | null,
    kinematics?: HandKinematics | null,
  ): Attempt | null {
    const activeSetup = setupOverride ?? this.setup;
    const sens = activeSetup ? getDeckSetup(activeSetup).sensitivity : DEFAULT_SENSITIVITY;
    const scale = clamp(boardScale, 0.55, 1.75);
    const trick = getTrick(trickId as TrickId);

    if (!rawTips) {
      if (this.phase === "air" && now - this.lastSeen > LOST_MS) this.reset();
      return null;
    }

    const s = this.smoothed;
    const alpha = sens.smoothing;
    const beta = 1 - alpha;
    const tips: Tips = s
      ? {
          index: {
            x: s.index.x * alpha + rawTips.index.x * beta,
            y: s.index.y * alpha + rawTips.index.y * beta,
          },
          middle: {
            x: s.middle.x * alpha + rawTips.middle.x * beta,
            y: s.middle.y * alpha + rawTips.middle.y * beta,
          },
        }
      : rawTips;
    this.smoothed = tips;
    this.lastSeen = now;

    const avgY = (tips.index.y + tips.middle.y) / 2;

    if (this.phase === "rest") {
      if (avgY >= this.restY - 0.005) this.restY = this.restY * 0.92 + avgY * 0.08;

      this.restBuffer.push({
        now,
        tips,
        wristYawDeg: kinematics?.wristYawDeg,
      });
      if (this.restBuffer.length > 10) this.restBuffer.shift();

      const armed = now - this.lastAttemptAt > COOLDOWN_MS;
      const popTrigger = sens.popTrigger * scale;
      const bothUp =
        tips.index.y < this.restY - popTrigger && tips.middle.y < this.restY - popTrigger;
      const nearSurface = Math.abs(this.restY - surfaceY) < sens.surfaceTolerance * scale;

      if (armed && nearSurface && bothUp) {
        this.phase = "air";
        this.restYAtPop = this.restY;
        this.minY = avgY;
        this.startIdxX = tips.index.x;
        this.peakSpread = spreadOf(tips);
        this.peakTips = tips;
        this.t0 = now;
        this.lastAirTickAt = now;
        this.lastBoardSampleAt = now;
        this.flipDegAccum = 0;
        this.maxPrimoAir = 0;
        this.lastPitchDeg = boardTelemetry?.detected ? boardTelemetry.pitchDeg : 0;

        // Analyze pre-pop buffer for snap vs slide timing
        const isNosePop = trick.signature.popOrigin === "nose";
        let maxPopY = -1;
        let popAt = now;
        let firstSlideAt = now;
        const firstRest = this.restBuffer[0]?.tips ?? tips;
        const baseSlideX = isNosePop ? firstRest.middle.x : firstRest.index.x;

        for (const rs of this.restBuffer) {
          const popY = isNosePop ? rs.tips.index.y : rs.tips.middle.y;
          if (popY >= maxPopY - 0.002) {
            if (popY > maxPopY) maxPopY = popY;
            popAt = rs.now;
          }
          const slideX = isNosePop ? rs.tips.middle.x : rs.tips.index.x;
          if (firstSlideAt === now && Math.abs(slideX - baseSlideX) > 0.018 * scale) {
            firstSlideAt = rs.now;
          }
        }
        this.popSnapAt = popAt;
        this.hasSlideMoved = firstSlideAt < now;
        this.slideStartAt = firstSlideAt;

        this.startWristYaw = kinematics ? kinematics.wristYawDeg : null;
        this.startWristRoll = kinematics ? kinematics.wristRollDeg : null;
        this.peakWristRotDeg = 0;
        this.indexCurlSum = kinematics ? kinematics.indexCurl : 0;
        this.middleCurlSum = kinematics ? kinematics.middleCurl : 0;
        this.curlSamples = kinematics ? 1 : 0;
        this.grindStreakMs = 0;
        this.maxGrindHoldMs = 0;
        this.replayFrames = [];

        // Seed replay with pre-pop takeoff anchor
        const seedSample = this.restBuffer[Math.max(0, this.restBuffer.length - 3)];
        if (seedSample) {
          this.replayFrames.push({
            tMs: 0,
            index: seedSample.tips.index,
            middle: seedSample.tips.middle,
            boardPitchDeg: 0,
            flipDeg: 0,
            wristRotDeg: 0,
          });
        }
        this.pushReplayFrame(now, tips, this.lastPitchDeg, 0, 0);
      }
      return null;
    }

    // Airborne phase
    const dtAirMs = Math.max(0, now - this.lastAirTickAt);
    this.lastAirTickAt = now;

    if (avgY < this.minY) {
      this.minY = avgY;
      this.peakSpread = spreadOf(tips);
      this.peakTips = tips;
      this.grindStreakMs = 0;
    } else if (
      Math.abs(avgY - this.minY) < 0.025 * scale &&
      this.restYAtPop - this.minY > 0.06 * scale
    ) {
      this.grindStreakMs += dtAirMs;
      if (this.grindStreakMs > this.maxGrindHoldMs) this.maxGrindHoldMs = this.grindStreakMs;
    }

    if (!this.hasSlideMoved && Math.abs(tips.index.x - this.startIdxX) > 0.022 * scale) {
      this.hasSlideMoved = true;
      this.slideStartAt = now;
    }

    if (boardTelemetry?.detected) {
      const dtSec = clamp((now - this.lastBoardSampleAt) / 1000, 0, 0.12);
      this.flipDegAccum += boardTelemetry.flipRateDegPerSec * dtSec;
      this.lastPitchDeg = boardTelemetry.pitchDeg;
      if (boardTelemetry.primoScore > this.maxPrimoAir) {
        this.maxPrimoAir = boardTelemetry.primoScore;
      }
    }
    this.lastBoardSampleAt = now;

    let currentWristRot = 0;
    if (kinematics) {
      if (this.startWristYaw !== null && this.startWristRoll !== null) {
        const yawDelta = Math.abs(
          shortestAngleDeltaDeg(this.startWristYaw, kinematics.wristYawDeg),
        );
        const rollDelta = Math.abs(
          shortestAngleDeltaDeg(this.startWristRoll, kinematics.wristRollDeg),
        );
        currentWristRot = Math.max(yawDelta, rollDelta * 0.75);
        if (currentWristRot > this.peakWristRotDeg) {
          this.peakWristRotDeg = currentWristRot;
        }
      }
      this.indexCurlSum += kinematics.indexCurl;
      this.middleCurlSum += kinematics.middleCurl;
      this.curlSamples++;
    }

    this.pushReplayFrame(
      now,
      tips,
      this.lastPitchDeg,
      Math.round(this.flipDegAccum),
      Math.round(currentWristRot),
    );

    if (now - this.t0 > MAX_AIR_MS) {
      this.reset();
      return null;
    }

    if (tips.middle.y < this.restYAtPop - sens.landBand * scale) return null;

    // Caught: tips are back at rest level.
    this.phase = "rest";
    this.lastAttemptAt = now;

    const peak = this.peakTips ?? tips;
    const flickRaw = peak.index.x - this.startIdxX;
    const landingPrimo = boardTelemetry?.detected ? boardTelemetry.primoScore : this.maxPrimoAir;
    const pitchAtCatch = boardTelemetry?.detected ? boardTelemetry.pitchDeg : this.lastPitchDeg;

    const popLeadMs = this.hasSlideMoved ? Math.round(this.slideStartAt - this.popSnapAt) : 0;
    let popTiming: PopTimingKind = "crisp";
    if (this.hasSlideMoved && popLeadMs < -18) popTiming = "early-slide";
    else if (this.hasSlideMoved && popLeadMs > 125) popTiming = "late-flick";

    const hasBoard = boardTelemetry !== undefined;
    const hasKinematics = this.curlSamples > 0;

    const metrics: AttemptMetrics = {
      peakPop: Math.max(0, this.restYAtPop - this.minY),
      spread: this.peakSpread,
      flick: mirrored ? -flickRaw : flickRaw,
      levelness: Math.abs(tips.index.y - tips.middle.y),
      ...(hasBoard && {
        boardPitchDeg: Math.round(pitchAtCatch * 10) / 10,
        flipRotationDeg: Math.round(this.flipDegAccum),
      }),
      ...(hasKinematics && {
        wristRotationDeg: Math.round(this.peakWristRotDeg),
        indexCurl: Math.round((this.indexCurlSum / this.curlSamples) * 100) / 100,
        middleCurl: Math.round((this.middleCurlSum / this.curlSamples) * 100) / 100,
      }),
      ...(this.hasSlideMoved && { popTiming, popLeadMs }),
      ...(trick.signature.isGrind && { grindHoldMs: Math.round(this.maxGrindHoldMs) }),
    };

    const { score, diagnosis, landingKind, evalResult } = scoreAttempt(
      metrics,
      activeSetup,
      scale,
      landingPrimo,
      trick.id,
      hasBoard,
    );
    metrics.landingKind = landingKind;

    const recordedFrames = [...this.replayFrames];

    this.peakTips = null;
    this.flipDegAccum = 0;
    this.maxPrimoAir = 0;
    this.replayFrames = [];
    this.restBuffer = [];

    return {
      id: this.nextId++,
      trickId,
      ...(activeSetup ? { setup: activeSetup } : {}),
      metrics,
      score,
      diagnosis,
      trickMatched: evalResult.trickMatched,
      matchConfidence: evalResult.matchConfidence,
      detectedMotionLabel: evalResult.detectedMotionLabel,
      failureReasons: evalResult.failureReasons,
      correctionArrows: evalResult.correctionArrows,
      replayFrames: recordedFrames,
    };
  }
}
