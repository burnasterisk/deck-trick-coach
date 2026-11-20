export interface TipPoint {
  x: number;
  y: number;
}

export interface Tips {
  index: TipPoint;
  middle: TipPoint;
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
}

export interface Diagnosis {
  title: string;
  advice: string;
  tip: string;
}

export interface Attempt {
  id: number;
  trickId: string;
  metrics: AttemptMetrics;
  score: number;
  diagnosis: Diagnosis;
}

/*
 * Detection thresholds, all in normalized video space ([0..1], y grows downward).
 * A trick = both fingertips rise sharply from rest near the surface line, hang,
 * then come back down.
 */
const POP_TRIGGER = 0.06; // both tips must climb 6% of frame height to arm
const LAND_BAND = 0.03; // back within 3% of rest level = caught
const LOST_MS = 350; // tracking lost mid-air this long = aborted attempt
const COOLDOWN_MS = 1200; // ignore chatter right after a landed attempt
const MAX_AIR_MS = 2500; // airborne longer than this = noise, reset

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function spreadOf(tips: Tips) {
  return Math.hypot(tips.index.x - tips.middle.x, tips.index.y - tips.middle.y);
}

export function scoreAttempt(m: AttemptMetrics): { score: number; diagnosis: Diagnosis } {
  const popScore = clamp(m.peakPop / 0.22, 0, 1);
  const levelScore = clamp(1 - m.levelness / 0.1, 0, 1);
  const spreadScore = clamp(1 - Math.abs(m.spread - 0.11) / 0.09, 0, 1);
  const score = Math.round(45 * popScore + 35 * levelScore + 20 * spreadScore);

  if (m.peakPop < 0.075) {
    return {
      score,
      diagnosis: {
        title: "DEAD POP",
        advice: "Barely left the deck — snap the tail down harder, then slide.",
        tip: "Press into the tail until the wheels beg for mercy.",
      },
    };
  }
  if (m.levelness > 0.09) {
    return {
      score,
      diagnosis: {
        title: "ROCKET OLLIE",
        advice: "Rocket Ollie — slide that front finger up to level the deck.",
        tip: "Think 'level out at the top', not 'launch and pray'.",
      },
    };
  }
  if (m.levelness > 0.06) {
    return {
      score,
      diagnosis: {
        title: "SKETCHY CATCH",
        advice: "Sketchy landing — hover for the mid-air catch.",
        tip: "Catch the deck at the knuckles, not the fingertips.",
      },
    };
  }
  if (m.spread > 0.2) {
    return {
      score,
      diagnosis: {
        title: "SPLIT STANCE",
        advice: "Fingers drifted apart mid-air — keep 'em stacked over the bolts.",
        tip: "Pinch the deck between index and middle, don't carry it.",
      },
    };
  }
  if (score >= 78) {
    return {
      score,
      diagnosis: {
        title: "CLEAN POP",
        advice: "Crisp pop, level catch — cooked that one.",
        tip: "Send it bigger — you've got pop to spare.",
      },
    };
  }
  return {
    score,
    diagnosis: {
      title: "SLOPPY SLIDE",
      advice: "Pop's there, form's loose — slide straight up the grip tape.",
      tip: "Slow it down: pop, slide, level, catch.",
    },
  };
}

type Phase = "rest" | "air";

/**
 * Feed it fingertip samples once per frame; it emits a finished Attempt when a
 * pop-up-and-return motion completes. Coordinates are normalized video space;
 * `surfaceY` is the calibrated tape line as a fraction from the top of frame.
 */
export class TrickAnalyzer {
  private phase: Phase = "rest";
  private restY = 0.8;
  private restYAtPop = 0.8;
  private minY = 1;
  private startY = 1;
  private startIdxX = 0;
  private peakSpread = 0;
  private peakTips: Tips | null = null;
  private t0 = 0;
  private lastSeen = 0;
  private lastAttemptAt = -COOLDOWN_MS;
  private nextId = 1;
  private smoothed: Tips | null = null;

  reset() {
    this.phase = "rest";
    this.smoothed = null;
    this.peakTips = null;
  }

  feed(rawTips: Tips | null, surfaceY: number, now: number, mirrored: boolean, trickId: string): Attempt | null {
    if (!rawTips) {
      if (this.phase === "air" && now - this.lastSeen > LOST_MS) this.reset();
      return null;
    }

    // Light smoothing so single noisy frames can't trigger or distort anything.
    const s = this.smoothed;
    const tips: Tips = s
      ? {
          index: { x: s.index.x * 0.5 + rawTips.index.x * 0.5, y: s.index.y * 0.5 + rawTips.index.y * 0.5 },
          middle: { x: s.middle.x * 0.5 + rawTips.middle.x * 0.5, y: s.middle.y * 0.5 + rawTips.middle.y * 0.5 },
        }
      : rawTips;
    this.smoothed = tips;
    this.lastSeen = now;

    const avgY = (tips.index.y + tips.middle.y) / 2;

    if (this.phase === "rest") {
      // Only track the resting level while tips are actually at/below it — a
      // rising pop must not drag the reference line up with it.
      if (avgY >= this.restY - 0.005) this.restY = this.restY * 0.92 + avgY * 0.08;
      const armed = now - this.lastAttemptAt > COOLDOWN_MS;
      const bothUp = tips.index.y < this.restY - POP_TRIGGER && tips.middle.y < this.restY - POP_TRIGGER;
      const nearSurface = Math.abs(this.restY - surfaceY) < 0.18;
      if (armed && nearSurface && bothUp) {
        this.phase = "air";
        this.restYAtPop = this.restY;
        this.minY = avgY;
        this.startY = avgY;
        this.startIdxX = tips.index.x;
        this.peakSpread = spreadOf(tips);
        this.peakTips = tips;
        this.t0 = now;
      }
      return null;
    }

    // Airborne: chase the peak.
    if (avgY < this.minY) {
      this.minY = avgY;
      this.peakSpread = spreadOf(tips);
      this.peakTips = tips;
    }
    if (now - this.t0 > MAX_AIR_MS) {
      this.reset();
      return null;
    }
    // Caught: the middle (tail-popping) finger is back at rest level — the
    // index may legitimately stay high on a nose-high catch.
    if (tips.middle.y < this.restYAtPop - LAND_BAND) return null;

    // Caught: tips are back at rest level.
    this.phase = "rest";
    this.lastAttemptAt = now;

    const peak = this.peakTips ?? tips;
    const flickRaw = peak.index.x - this.startIdxX;
    const metrics: AttemptMetrics = {
      peakPop: Math.max(0, this.restYAtPop - this.minY),
      spread: this.peakSpread,
      flick: mirrored ? -flickRaw : flickRaw,
      levelness: Math.abs(tips.index.y - tips.middle.y),
    };
    const { score, diagnosis } = scoreAttempt(metrics);
    this.peakTips = null;
    return { id: this.nextId++, trickId, metrics, score, diagnosis };
  }
}
