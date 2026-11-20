import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  Film,
  Pause,
  Play,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { drawAnnotatedClipFrame, type PlaybackSpeed, type SavedClip } from "@/lib/clips";
import { getDeckSetup } from "@/lib/setup";
import { cn } from "@/lib/utils";

interface ClipsDrawerProps {
  open: boolean;
  clips: SavedClip[];
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onClose: () => void;
  onDeleteClip: (id: string) => void;
  getFrameSource: (clipId: string, frameIndex: number) => HTMLCanvasElement | null;
  exportClipFramePng: (clip: SavedClip, frameIndex: number) => Promise<Blob | null>;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.25, 0.5, 1];

function formatRelativeTime(createdAt: number): string {
  const sec = Math.max(0, Math.round((Date.now() - createdAt) / 1000));
  if (sec < 10) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function fileExtensionFor(mimeType?: string): string {
  if (!mimeType) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Minimal futuristic-graffiti Clips drawer for rewatching auto-captured slow-mo
 * attempts, scrubbing frame-by-frame to inspect red mistake overlays, and exporting/sharing.
 */
export function ClipsDrawer({
  open,
  clips,
  selectedClipId,
  onSelectClip,
  onClose,
  onDeleteClip,
  getFrameSource,
  exportClipFramePng,
}: ClipsDrawerProps) {
  const activeClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? clips[0] ?? null,
    [clips, selectedClipId],
  );

  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(0.25);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashStatus = (msg: string) => {
    setActionStatus(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setActionStatus(null), 2600);
  };

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const activeClipId = activeClip?.id ?? null;

  // Reset scrub position cleanly when switching clips or opening drawer
  useEffect(() => {
    setFrameIndex(0);
    setPlaying(Boolean(activeClipId));
  }, [activeClipId, open]);

  // Keyboard shortcuts while drawer is open: Esc to close, Space play/pause, Left/Right step frame
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (!activeClip) return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        setFrameIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        setFrameIndex((i) => Math.min(activeClip.frames.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, activeClip, onClose]);

  // Advance frames at selected slow-motion speed (with subtle hold on exact mistake frame)
  useEffect(() => {
    if (!open || !playing || !activeClip || activeClip.frames.length < 2) return;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const baseIntervalMs = Math.round(33 / speed);
    const isMistakePause =
      frameIndex === activeClip.mistake.frameIndex &&
      activeClip.mistake.severity === "mistake" &&
      speed < 1;
    const delayMs = isMistakePause ? Math.max(380, baseIntervalMs * 4) : baseIntervalMs;

    const id = setTimeout(() => {
      setFrameIndex((prev) => (prev + 1) % activeClip.frames.length);
    }, delayMs);

    return () => clearTimeout(id);
  }, [open, playing, activeClip, frameIndex, speed]);

  // Draw the current scrubbed frame + visual overlay arrows onto the canvas
  useEffect(() => {
    if (!open || !activeClip) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = activeClip.width;
    canvas.height = activeClip.height;

    const source = getFrameSource(activeClip.id, frameIndex);
    drawAnnotatedClipFrame(ctx, canvas.width, canvas.height, activeClip, frameIndex, source, {
      showHudBadge: false,
      animPhase: frameIndex * 0.25,
    });
  }, [open, activeClip, frameIndex, getFrameSource]);

  if (!open) return null;

  const totalFrames = activeClip?.frames.length ?? 0;
  const currentFrame = activeClip?.frames[frameIndex];
  const mistake = activeClip?.mistake;
  const mistakePct =
    activeClip && totalFrames > 1
      ? Math.min(100, Math.max(0, (activeClip.mistake.frameIndex / (totalFrames - 1)) * 100))
      : 0;
  const isAtMistakeFrame = Boolean(
    mistake && mistake.severity === "mistake" && frameIndex === mistake.frameIndex,
  );

  async function handleDownload() {
    if (!activeClip) return;
    const slug = `${activeClip.trickId}-${activeClip.id.slice(-4)}`;
    if (activeClip.videoBlob) {
      const ext = fileExtensionFor(activeClip.videoMimeType);
      triggerBlobDownload(activeClip.videoBlob, `deckcoach-${slug}.${ext}`);
      flashStatus(`Saved slow-mo .${ext}`);
      return;
    }
    const png = await exportClipFramePng(activeClip, frameIndex);
    if (png) {
      triggerBlobDownload(png, `deckcoach-${slug}-f${frameIndex + 1}.png`);
      flashStatus("Saved annotated frame PNG");
    } else {
      flashStatus("Export unavailable in this browser");
    }
  }

  async function handleShare() {
    if (!activeClip) return;
    const shareTitle = `DeckCoach · ${activeClip.trickName} (${activeClip.attempt.diagnosis.title})`;
    const shareText = `${activeClip.trickName} — Score ${activeClip.attempt.score}/100 · ${activeClip.attempt.diagnosis.advice}`;

    try {
      if (activeClip.videoBlob && typeof navigator.share === "function") {
        const ext = fileExtensionFor(activeClip.videoMimeType);
        const file = new File([activeClip.videoBlob], `deckcoach-${activeClip.trickId}.${ext}`, {
          type: activeClip.videoMimeType ?? "video/webm",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: shareTitle, text: shareText });
          flashStatus("Clip shared");
          return;
        }
      }

      const png = await exportClipFramePng(activeClip, activeClip.mistake.frameIndex);
      if (png && typeof navigator.share === "function") {
        const pngFile = new File([png], `deckcoach-${activeClip.trickId}.png`, {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [pngFile] })) {
          await navigator.share({ files: [pngFile], title: shareTitle, text: shareText });
          flashStatus("Frame shared");
          return;
        }
      }

      if (typeof navigator.share === "function") {
        await navigator.share({ title: shareTitle, text: shareText });
        flashStatus("Summary shared");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      }
      await handleDownload();
      flashStatus("Summary copied + clip saved");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      await handleDownload();
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Saved trick clips"
        className="hud-glass flex h-full w-full max-w-[460px] flex-col border-l border-paper/15 text-paper animate-slap"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-paper/12 px-4 py-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h2 className="font-display text-xl tracking-wide text-paper whitespace-nowrap">
              CLIPS
            </h2>
            <span className="font-mono text-xs tabular-nums text-paper/60 whitespace-nowrap">
              {clips.length} saved
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close clips drawer"
            className="grid size-11 shrink-0 place-items-center rounded-md text-paper/65 transition-colors cursor-pointer hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!activeClip ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center px-4">
              <div className="grid size-12 place-items-center rounded-lg border border-paper/15 bg-black/45 text-primary">
                <Film className="size-5" />
              </div>
              <p className="mt-3 font-marker text-lg text-paper">Auto-Clip Armed</p>
              <p className="mt-1.5 max-w-xs font-mono text-xs leading-relaxed text-paper/65">
                DeckCoach stays silent during idle hands and automatically saves a slow-mo clip with
                red mistake arrows whenever it tracks a real pop and flick.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Video frame canvas stage */}
              <div className="relative overflow-hidden rounded-lg border border-paper/15 bg-black">
                <canvas
                  ref={canvasRef}
                  className="block w-full bg-black object-contain"
                  style={{
                    aspectRatio: `${activeClip.width} / ${activeClip.height}`,
                  }}
                />

                {/* Top-left crisp unboxed status line */}
                <div className="pointer-events-none absolute top-2 left-2.5 flex items-center gap-1.5 font-mono text-[10px] text-paper/90 drop-hard-sm">
                  <span className="font-marker text-xs text-primary">{activeClip.trickName}</span>
                  {activeClip.setup && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{getDeckSetup(activeClip.setup).shortTag}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{activeClip.attempt.score} pts</span>
                </div>

                {/* Top-right exact mistake/clean tag when paused/scrubbed on key frame */}
                {isAtMistakeFrame && mistake && (
                  <div className="pointer-events-none absolute top-2 right-2.5 rounded bg-[#FF2A2A] px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow">
                    {mistake.tag}
                  </div>
                )}
              </div>

              {/* Timeline status & Mistake jump button */}
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
                <span className="text-paper/75">
                  Frame {frameIndex + 1}/{totalFrames}
                  {currentFrame
                    ? ` · ${currentFrame.tMs >= 0 ? "+" : ""}${currentFrame.tMs}ms`
                    : ""}
                </span>

                {mistake && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setFrameIndex(mistake.frameIndex);
                    }}
                    className={cn(
                      "flex min-h-[36px] items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[11px] font-bold transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      mistake.severity === "mistake"
                        ? isAtMistakeFrame
                          ? "bg-[#FF2A2A] text-white"
                          : "border border-[#FF2A2A]/60 bg-[#FF2A2A]/15 text-[#FF6B6B] hover:bg-[#FF2A2A]/25"
                        : "border border-primary/50 bg-primary/15 text-primary",
                    )}
                  >
                    <Crosshair className="size-3.5 shrink-0" />
                    <span className="whitespace-nowrap">
                      {mistake.tag} · f{mistake.frameIndex + 1}
                    </span>
                  </button>
                )}
              </div>

              {/* Frame-by-frame scrubber with visual red mistake notch */}
              <div className="relative flex items-center py-1">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-paper/15"
                >
                  {mistake && mistake.severity === "mistake" && (
                    <span
                      title={`Mistake frame: ${mistake.tag}`}
                      style={{ left: `${mistakePct}%` }}
                      className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#FF2A2A] shadow-[0_0_8px_#FF2A2A]"
                    />
                  )}
                </div>
                <input
                  type="range"
                  aria-label="Scrub clip frames"
                  min={0}
                  max={Math.max(0, totalFrames - 1)}
                  value={frameIndex}
                  onChange={(e) => {
                    setPlaying(false);
                    setFrameIndex(Number(e.target.value));
                  }}
                  className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent accent-primary"
                />
              </div>

              {/* Transport & speed bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Pause clip" : "Play clip"}
                    className="grid size-11 place-items-center rounded-md border border-paper/15 bg-black/45 text-paper transition-colors cursor-pointer press hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setFrameIndex((i) => Math.max(0, i - 1));
                    }}
                    aria-label="Previous frame"
                    title="Previous frame (Left Arrow)"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded-md border border-paper/15 bg-black/45 px-2 font-mono text-[11px] text-paper/85 transition-colors cursor-pointer press hover:border-paper/35 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>1f</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setFrameIndex((i) => Math.min(Math.max(0, totalFrames - 1), i + 1));
                    }}
                    aria-label="Next frame"
                    title="Next frame (Right Arrow)"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded-md border border-paper/15 bg-black/45 px-2 font-mono text-[11px] text-paper/85 transition-colors cursor-pointer press hover:border-paper/35 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span>1f</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>

                {/* Slow-mo speed selector */}
                <div
                  role="group"
                  aria-label="Playback speed"
                  className="flex items-center gap-1 rounded-md border border-paper/12 bg-black/40 p-0.5"
                >
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSpeed(opt)}
                      aria-pressed={speed === opt}
                      className={cn(
                        "min-h-[38px] rounded px-2 font-mono text-[11px] tabular-nums transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        speed === opt
                          ? "bg-primary/20 font-bold text-primary"
                          : "text-paper/65 hover:text-paper",
                      )}
                    >
                      {opt}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Breakdown note */}
              <div className="border-t border-paper/10 pt-2.5">
                <p className="font-mono text-xs font-bold text-hazard">
                  {activeClip.attempt.diagnosis.title}
                </p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-paper/80">
                  {activeClip.attempt.diagnosis.whyFailed}
                </p>
              </div>

              {/* Download / Share / Delete actions */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-3 font-mono text-xs font-bold text-primary whitespace-nowrap transition-colors cursor-pointer press hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Download className="size-3.5 shrink-0" />
                  <span>
                    {activeClip.exportState === "encoding"
                      ? "Preparing…"
                      : activeClip.videoBlob
                        ? "Download"
                        : "Save PNG"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border border-paper/20 bg-black/45 px-3 font-mono text-xs font-bold text-paper whitespace-nowrap transition-colors cursor-pointer press hover:border-paper/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Share2 className="size-3.5 shrink-0" />
                  <span>Share</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteClip(activeClip.id)}
                  aria-label="Delete saved clip"
                  title="Delete clip"
                  className="grid size-11 shrink-0 place-items-center rounded-md border border-paper/15 bg-black/45 text-paper/65 transition-colors cursor-pointer press hover:border-hazard/60 hover:text-hazard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {actionStatus && (
                <p className="font-mono text-[11px] text-primary" role="status">
                  {actionStatus}
                </p>
              )}

              {/* Saved clips list */}
              <div className="border-t border-paper/12 pt-3">
                <p className="font-mono text-[10px] tracking-wider text-paper/55">
                  SAVED SESSION CLIPS
                </p>
                <div className="mt-1.5 divide-y divide-paper/10">
                  {clips.map((c) => {
                    const selected = c.id === activeClip.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectClip(c.id)}
                        className={cn(
                          "flex min-h-[60px] w-full items-center gap-3 py-2 px-1.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          selected ? "bg-primary/10" : "hover:bg-paper/5",
                        )}
                      >
                        <div className="relative h-11 w-18 shrink-0 overflow-hidden rounded border border-paper/15 bg-black">
                          {c.posterUrl ? (
                            <img
                              src={c.posterUrl}
                              alt={`${c.trickName} clip thumbnail`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-paper/40">
                              <Film className="size-4" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate font-mono text-xs font-bold",
                                selected ? "text-primary" : "text-paper",
                              )}
                            >
                              {c.trickName}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] tabular-nums text-paper/75">
                              {c.attempt.score}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-paper/60">
                            <span
                              className={
                                c.mistake.severity === "mistake" ? "text-[#FF6B6B]" : "text-primary"
                              }
                            >
                              {c.mistake.tag}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>{formatRelativeTime(c.createdAt)}</span>
                            {c.exportState === "encoding" && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span>Rendering…</span>
                              </>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
