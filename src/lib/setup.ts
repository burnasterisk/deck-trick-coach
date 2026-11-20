export type DeckSetupId = "plastic" | "wood";

export interface TrackingSensitivity {
  /** Minimum upward rise (fraction of frame height) by both tips to arm a pop. */
  popTrigger: number;
  /** Return band near rest level (fraction of frame height) to register a catch. */
  landBand: number;
  /** Frame-to-frame smoothing factor (0 = raw, higher = smoother). */
  smoothing: number;
  /** Reference peak pop height for 100% pop score. */
  peakScale: number;
  /** Ideal finger spread for the deck width (fraction of frame width). */
  idealSpread: number;
  /** Max distance from calibrated surface line to arm a trick. */
  surfaceTolerance: number;
}

export interface DeckSetupProfile {
  id: DeckSetupId;
  label: string;
  deckName: string;
  gripName: string;
  shortTag: string;
  sensitivity: TrackingSensitivity;
}

export const DECK_SETUPS: Record<DeckSetupId, DeckSetupProfile> = {
  plastic: {
    id: "plastic",
    label: "Plastic",
    deckName: "Plastic Tech Deck",
    gripName: "Sandpaper Grip",
    shortTag: "Plastic · Sandpaper",
    sensitivity: {
      popTrigger: 0.05,
      landBand: 0.028,
      smoothing: 0.38,
      peakScale: 0.2,
      idealSpread: 0.105,
      surfaceTolerance: 0.18,
    },
  },
  wood: {
    id: "wood",
    label: "Wood",
    deckName: "Pro Wood Deck",
    gripName: "Foam Grip",
    shortTag: "Wood · Foam",
    sensitivity: {
      popTrigger: 0.065,
      landBand: 0.035,
      smoothing: 0.55,
      peakScale: 0.23,
      idealSpread: 0.12,
      surfaceTolerance: 0.19,
    },
  },
};

export const DEFAULT_SETUP: DeckSetupId = "plastic";

export function getDeckSetup(id: DeckSetupId): DeckSetupProfile {
  return DECK_SETUPS[id];
}
