import type { DeckSetupId } from "./setup";

export type BoardGrip = "sandpaper" | "foam" | "silicone";
export type BoardWidth = "narrow" | "standard" | "wide";
export type BoardShape = "popsicle" | "old-school" | "custom";

export interface BoardProfile {
  id: string;
  name: string;
  material: DeckSetupId;
  grip: BoardGrip;
  width: BoardWidth;
  shape: BoardShape;
  photoDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "deckcoach.board-profiles.v1";

function isBoardProfile(value: unknown): value is BoardProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<BoardProfile>;
  return (
    typeof profile.id === "string" &&
    typeof profile.name === "string" &&
    (profile.material === "plastic" || profile.material === "wood") &&
    (profile.grip === "sandpaper" || profile.grip === "foam" || profile.grip === "silicone") &&
    (profile.width === "narrow" || profile.width === "standard" || profile.width === "wide") &&
    (profile.shape === "popsicle" || profile.shape === "old-school" || profile.shape === "custom") &&
    typeof profile.createdAt === "number" &&
    typeof profile.updatedAt === "number"
  );
}

export function loadBoardProfiles(): BoardProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isBoardProfile) : [];
  } catch {
    return [];
  }
}

export function saveBoardProfiles(profiles: BoardProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // If photo data fills localStorage, preserve the setup details without the images.
    try {
      const withoutPhotos = profiles.map(({ photoDataUrl: _photo, ...profile }) => profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutPhotos));
    } catch {
      // The app remains usable in-memory when storage is unavailable.
    }
  }
}

export function getBoardProfileLabel(profile: BoardProfile): string {
  const material = profile.material === "wood" ? "Wood" : "Plastic";
  const grip = profile.grip === "foam" ? "Foam" : profile.grip === "silicone" ? "Silicone" : "Sandpaper";
  return `${material} · ${grip}`;
}

export function getBoardWidthLabel(width: BoardWidth): string {
  switch (width) {
    case "narrow":
      return "Narrow · 26–30 mm";
    case "wide":
      return "Wide · 34–36 mm";
    default:
      return "Standard · 31–33 mm";
  }
}
