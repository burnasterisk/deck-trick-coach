import { useRef, useState } from "react";
import { Check, ChevronRight, ImagePlus, Plus, Trash2, X } from "lucide-react";

import type { BoardProfile, BoardGrip, BoardShape, BoardWidth } from "@/lib/board-profiles";
import { getBoardProfileLabel, getBoardWidthLabel } from "@/lib/board-profiles";
import type { DeckSetupId } from "@/lib/setup";
import { cn } from "@/lib/utils";

interface BoardProfileDialogProps {
  open: boolean;
  profiles: BoardProfile[];
  activeProfileId: string | null;
  defaultMaterial: DeckSetupId;
  onClose: () => void;
  onStart: (profile: BoardProfile) => void;
  onCreate: (profile: BoardProfile) => void;
  onDelete: (profileId: string) => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const MATERIALS: { id: DeckSetupId; title: string; detail: string }[] = [
  { id: "plastic", title: "Plastic", detail: "Lighter snap · usually sandpaper" },
  { id: "wood", title: "Wood", detail: "Damped feel · often foam grip" },
];

async function prepareBoardPhoto(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read this image."));
    });

    const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Downsampled PNGs keep the profile local and reasonably light. Background removal
    // is intentionally a simple edge-connected colour cutout, not an AI segmentation claim.
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = pixels;
    const sample = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
    };
    const corners = [sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1)];
    const background = [0, 1, 2].map(
      (channel) => corners.reduce((sum, colour) => sum + (colour[channel] ?? 0), 0) / corners.length,
    );
    const closeToBackground = (index: number) => {
      const dr = (data[index] ?? 0) - (background[0] ?? 0);
      const dg = (data[index + 1] ?? 0) - (background[1] ?? 0);
      const db = (data[index + 2] ?? 0) - (background[2] ?? 0);
      return Math.sqrt(dr * dr + dg * dg + db * db) < 62;
    };

    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let read = 0;
    let write = 0;
    const add = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pixel = y * width + x;
      if (visited[pixel]) return;
      visited[pixel] = 1;
      if (closeToBackground(pixel * 4)) queue[write++] = pixel;
    };

    // Seed the cutout from all four edges so enclosed holes in the board are preserved.
    for (let x = 0; x < width; x += 1) {
      add(x, 0);
      add(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
      add(0, y);
      add(width - 1, y);
    }
    while (read < write) {
      const pixel = queue[read++]!;
      data[pixel * 4 + 3] = 0;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      add(x - 1, y);
      add(x + 1, y);
      add(x, y - 1);
      add(x, y + 1);
    }
    context.putImageData(pixels, 0, 0);
    const webp = canvas.toDataURL("image/webp", 0.82);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function ProfileThumb({ profile }: { profile: BoardProfile }) {
  if (profile.photoDataUrl) {
    return <img src={profile.photoDataUrl} alt="" className="h-full w-full object-contain p-2" />;
  }
  return (
    <svg viewBox="0 0 80 112" aria-hidden="true" className="h-full w-full p-3">
      <rect x="24" y="4" width="32" height="104" rx="16" fill={profile.material === "wood" ? "#a87950" : "#5d5b65"} stroke="#e4e4e7" strokeOpacity=".55" />
      <path d="M28 23H52M28 89H52" stroke="#dc2626" strokeWidth="3" />
      <path d="M31 43L49 61M49 43L31 61" stroke="#8b5cf6" strokeWidth="2" />
      <circle cx="40" cy="76" r="5" fill="#08080a" stroke="#e4e4e7" strokeOpacity=".7" />
    </svg>
  );
}

export function BoardProfileDialog({
  open,
  profiles,
  activeProfileId,
  defaultMaterial,
  onClose,
  onStart,
  onCreate,
  onDelete,
}: BoardProfileDialogProps) {
  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState("");
  const [material, setMaterial] = useState<DeckSetupId>(defaultMaterial);
  const [grip, setGrip] = useState<BoardGrip>(defaultMaterial === "wood" ? "foam" : "sandpaper");
  const [width, setWidth] = useState<BoardWidth>("standard");
  const [shape, setShape] = useState<BoardShape>("popsicle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  async function handlePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file.");
      return;
    }
    setProcessingPhoto(true);
    setPhotoError(null);
    try {
      setPhotoDataUrl(await prepareBoardPhoto(file));
    } catch {
      setPhotoError("Could not process that photo. Try another image.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  function createProfile() {
    const profileName = name.trim() || `${material === "wood" ? "Wood" : "Plastic"} deck`;
    const now = Date.now();
    const profile: BoardProfile = {
      id: `board-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name: profileName,
      material,
      grip,
      width,
      shape,
      ...(photoDataUrl ? { photoDataUrl } : {}),
      createdAt: now,
      updatedAt: now,
    };
    onCreate(profile);
    onStart(profile);
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-md sm:p-6"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-profiles-title"
        className="hud-glass relative my-auto w-full max-w-2xl overflow-hidden border border-paper/15 bg-[#0b090e]/95 p-4 shadow-[0_24px_90px_rgb(0_0_0/.7)] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close board profiles"
          className={cn("absolute right-3 top-3 grid size-10 place-items-center text-paper/65 hover:text-paper", focusRing)}
        >
          <X className="size-4" />
        </button>
        <div className="mb-5 pr-10">
          <p className="font-mono text-[10px] font-bold tracking-[.24em] text-primary">DECK SETUP / 01</p>
          <h2 id="board-profiles-title" className="mt-1 font-display text-3xl tracking-wide text-paper sm:text-4xl">
            Pick your board.
          </h2>
          <p className="mt-1 max-w-lg text-xs leading-relaxed text-paper/55">
            Profiles keep your deck material and setup attached to every session. No measuring tools needed.
          </p>
        </div>

        {!creating && profiles.length > 0 && (
          <div className="grid max-h-[42vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={cn(
                  "group flex min-h-[112px] items-center gap-3 border p-3 transition-colors",
                  profile.id === activeProfileId
                    ? "border-primary/70 bg-primary/10"
                    : "border-paper/10 bg-black/30 hover:border-paper/25",
                )}
              >
                <div className="grid size-[76px] shrink-0 place-items-center bg-[#17121a]">
                  <ProfileThumb profile={profile} />
                </div>
                <button type="button" onClick={() => onStart(profile)} className={cn("min-w-0 flex-1 text-left", focusRing)}>
                  <span className="block truncate font-display text-lg text-paper">{profile.name}</span>
                  <span className="mt-0.5 block text-[10px] font-mono text-paper/60">{getBoardProfileLabel(profile)}</span>
                  <span className="mt-1 block text-[10px] text-paper/40">{getBoardWidthLabel(profile.width)} · {profile.shape.replace("-", " ")}</span>
                </button>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  {profile.id === activeProfileId && <Check className="size-4 text-primary" />}
                  <button
                    type="button"
                    onClick={() => onDelete(profile.id)}
                    aria-label={`Delete ${profile.name}`}
                    className="grid size-8 place-items-center text-paper/30 hover:text-primary"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!creating && profiles.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn("mt-3 flex min-h-11 w-full items-center justify-center gap-2 border border-dashed border-paper/20 text-xs font-bold tracking-wide text-paper/70 hover:border-primary/60 hover:text-paper", focusRing)}
          >
            <Plus className="size-4" /> ADD A BOARD PROFILE
          </button>
        )}

        {creating && (
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold tracking-[.16em] text-paper/55">PROFILE NAME</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. my 32mm DK deck"
                  maxLength={36}
                  className="h-11 w-full border border-paper/15 bg-black/35 px-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-primary/70"
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-[10px] font-bold tracking-[.16em] text-paper/55">DECK MATERIAL</legend>
                <div className="grid grid-cols-2 gap-2">
                  {MATERIALS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setMaterial(option.id);
                        if (option.id === "wood" && grip === "sandpaper") setGrip("foam");
                        if (option.id === "plastic" && grip === "foam") setGrip("sandpaper");
                      }}
                      className={cn("min-h-[66px] border px-3 py-2 text-left", material === option.id ? "border-primary/70 bg-primary/10" : "border-paper/15 bg-black/25", focusRing)}
                    >
                      <span className="block font-display text-lg text-paper">{option.title}</span>
                      <span className="block text-[10px] text-paper/50">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-[.14em] text-paper/55">GRIP</span>
                  <select value={grip} onChange={(event) => setGrip(event.target.value as BoardGrip)} className="h-10 w-full border border-paper/15 bg-[#151019] px-2 text-xs text-paper outline-none focus:border-primary/70">
                    <option value="sandpaper">Sandpaper</option>
                    <option value="foam">Foam</option>
                    <option value="silicone">Silicone</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-[.14em] text-paper/55">WIDTH</span>
                  <select value={width} onChange={(event) => setWidth(event.target.value as BoardWidth)} className="h-10 w-full border border-paper/15 bg-[#151019] px-2 text-xs text-paper outline-none focus:border-primary/70">
                    <option value="narrow">Narrow · 26–30</option>
                    <option value="standard">Standard · 31–33</option>
                    <option value="wide">Wide · 34–36</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-[.14em] text-paper/55">SHAPE</span>
                  <select value={shape} onChange={(event) => setShape(event.target.value as BoardShape)} className="h-10 w-full border border-paper/15 bg-[#151019] px-2 text-xs text-paper outline-none focus:border-primary/70">
                    <option value="popsicle">Popsicle</option>
                    <option value="old-school">Old school</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
              </div>

              <p className="text-[10px] leading-relaxed text-paper/40">
                Width is a rough setup category, not a measurement. The trainer currently adjusts its physics profile by deck material; grip, width and shape are saved as reference details.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn("relative grid min-h-[176px] flex-1 place-items-center overflow-hidden border border-dashed border-paper/20 bg-[#17121a] text-center hover:border-primary/60", focusRing)}
              >
                {photoDataUrl ? (
                  <img src={photoDataUrl} alt="Board profile preview cutout" className="absolute inset-0 h-full w-full object-contain p-3" />
                ) : (
                  <span className="flex flex-col items-center gap-2 px-3 text-paper/55">
                    <ImagePlus className="size-7 text-uv" />
                    <span className="font-mono text-[10px] font-bold">ADD TRUCK / DECK PHOTO</span>
                    <span className="text-[9px]">Use a plain background for cleaner cutout</span>
                  </span>
                )}
                {processingPhoto && <span className="absolute inset-0 grid place-items-center bg-black/70 text-[10px] text-paper">PROCESSING…</span>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void handlePhoto(event.target.files?.[0])} />
              {photoDataUrl && (
                <button type="button" onClick={() => setPhotoDataUrl(undefined)} className="flex items-center justify-center gap-1 text-[10px] text-paper/45 hover:text-primary">
                  <X className="size-3" /> REMOVE PHOTO
                </button>
              )}
              {photoError && <p className="text-[10px] text-primary">{photoError}</p>}
              <p className="text-[9px] leading-relaxed text-paper/35">The browser removes a plain, edge-connected background locally. Busy backgrounds may remain; no photo is uploaded anywhere.</p>
            </div>
          </div>
        )}

        {creating && (
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-paper/10 pt-4 sm:flex-row sm:justify-between">
            {profiles.length > 0 ? (
              <button type="button" onClick={() => setCreating(false)} className="min-h-11 px-4 text-xs text-paper/50 hover:text-paper">BACK TO PROFILES</button>
            ) : <span />}
            <button type="button" onClick={createProfile} disabled={processingPhoto} className={cn("flex min-h-11 items-center justify-center gap-2 bg-primary px-5 text-xs font-bold tracking-wide text-white hover:brightness-110 disabled:opacity-50", focusRing)}>
              CREATE PROFILE & PLAY <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
