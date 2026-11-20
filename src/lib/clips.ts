import { getDeckSetup, type DeckSetupId } from "./setup";
import type { Attempt, CorrectionArrow, TipPoint } from "./trick-analyzer";
import type { TrickId } from "./tricks";

export type ClipPhase = "pre" | "air" | "land";
export type ClipExportState = "encoding" | "ready" | "fallback";
export type PlaybackSpeed = 0.25 | 0.5 | 1;

export interface ClipFrame {
  /** Milliseconds relative to pop takeoff (negative during pre-roll). */
  tMs: number;
  phase: ClipPhase;
  index: TipPoint;
  middle: TipPoint;
  boardPitchDeg: number;
  flipDeg: number;
  wristRotDeg: number;
}

export interface MistakeHighlight {
  /** Exact frame index inside `clip.frames` where the key mistake (or catch) happened. */
  frameIndex: number;
  severity: "mistake" | "clean";
  tag: string;
  detail: string;
  target: "index" | "middle" | "wrist";
  arrows: CorrectionArrow[];
}

export interface SavedClip {
  id: string;
  createdAt: number;
  trickId: TrickId;
  trickName: string;
  setup?: DeckSetupId;
  mirrored: boolean;
  width: number;
  height: number;
  durationMs: number;
  attempt: Attempt;
  frames: ClipFrame[];
  mistake: MistakeHighlight;
  posterUrl: string;
  videoBlob?: Blob;
  videoUrl?: string;
  videoMimeType?: string;
  exportState: ClipExportState;
}

const TONE_COLOR: Record<CorrectionArrow["tone"], string> = {
  hazard: "#DC2626",
  primary: "#8B5CF6",
  cyan: "#38BDF8",
};

const MISTAKE_RED = "#FF2A2A";

/**
 * Gate deciding whether a detected movement was a genuine trick-like pop & flick/scoop
 * rather than casual hand lifting, resting jitter, or empty air drifting.
 */
export function isRealTrickMotion(attempt: Attempt, boardScale = 1): boolean {
  const scale = Math.min(1.75, Math.max(0.55, boardScale));
  const { metrics, replayFrames } = attempt;

  // Must achieve genuine upward pop height above the deck
  if (metrics.peakPop < 0.052 * scale) return false;

  // Reject single-frame spikes or slow drift off camera
  if (replayFrames.length < 4) return false;
  const durationMs = replayFrames[replayFrames.length - 1]?.tMs ?? 0;
  if (durationMs < 85 || durationMs > 2300) return false;

  const hasFlickOrScoop = Math.abs(metrics.flick) >= 0.015 * scale;
  const hasFlipSpin = (metrics.flipRotationDeg ?? 0) >= 35;
  const hasSlideEvent = metrics.popTiming !== undefined;
  const hasStrongPopAndSpread = metrics.peakPop >= 0.095 * scale && metrics.spread >= 0.075 * scale;

  return hasFlickOrScoop || hasFlipSpin || hasSlideEvent || hasStrongPopAndSpread;
}

/**
 * Pinpoints the exact frame index inside the captured clip where the main mistake
 * (e.g., late flick, early slide, early drop, primo/rocket catch, stiff/claw curl)
 * occurred so playback and exports highlight that exact moment in red.
 */
export function detectMistakeHighlight(frames: ClipFrame[], attempt: Attempt): MistakeHighlight {
  if (frames.length === 0) {
    return {
      frameIndex: 0,
      severity: attempt.score >= 78 && attempt.trickMatched ? "clean" : "mistake",
      tag: attempt.diagnosis.title,
      detail: attempt.diagnosis.whyFailed,
      target: "index",
      arrows: attempt.correctionArrows,
    };
  }

  // Locate pop frame (first "air" frame) & apex frame (highest fingertip midpoint = lowest y)
  let popIdx = frames.findIndex((f) => f.phase === "air");
  if (popIdx < 0) popIdx = 0;

  let apexIdx = popIdx;
  let minMidY = Infinity;
  for (let i = popIdx; i < frames.length; i++) {
    const f = frames[i];
    if (!f || f.phase === "land") continue;
    const midY = (f.index.y + f.middle.y) / 2;
    if (midY < minMidY) {
      minMidY = midY;
      apexIdx = i;
    }
  }

  let landIdx = frames.findIndex((f, i) => i > popIdx && f.phase === "land");
  if (landIdx < 0) landIdx = frames.length - 1;

  // Find frame after apex where downward drop velocity is sharpest ("early drop")
  let dropIdx = Math.min(frames.length - 1, Math.max(apexIdx + 1, landIdx - 1));
  let maxDropRate = -Infinity;
  for (let i = apexIdx + 1; i <= landIdx; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    if (!prev || !curr) continue;
    const drop = (curr.index.y + curr.middle.y) / 2 - (prev.index.y + prev.middle.y) / 2;
    if (drop > maxDropRate) {
      maxDropRate = drop;
      dropIdx = i;
    }
  }

  // Find frame after apex where front-finger horizontal velocity peaks ("late flick")
  let lateFlickIdx = Math.min(frames.length - 1, apexIdx + 1);
  let maxFlickVel = -Infinity;
  for (let i = apexIdx; i < landIdx; i++) {
    const prev = frames[i - 1] ?? frames[i];
    const curr = frames[i];
    if (!prev || !curr) continue;
    const vx = Math.abs(curr.index.x - prev.index.x);
    if (vx > maxFlickVel) {
      maxFlickVel = vx;
      lateFlickIdx = i;
    }
  }

  // Find frame pre-pop where front finger started sliding sideways ("early slide")
  let earlySlideIdx = Math.max(0, popIdx - 1);
  const baseIdxX = frames[0]?.index.x ?? 0.5;
  for (let i = 1; i <= popIdx; i++) {
    const f = frames[i];
    if (f && Math.abs(f.index.x - baseIdxX) > 0.015) {
      earlySlideIdx = i;
      break;
    }
  }

  const title = attempt.diagnosis.title;
  const landing = attempt.metrics.landingKind;
  const arrows = attempt.correctionArrows;

  if (attempt.metrics.popTiming === "early-slide" || title === "EARLY SLIDE") {
    return {
      frameIndex: earlySlideIdx,
      severity: "mistake",
      tag: "EARLY SLIDE",
      detail: attempt.failureReasons[0] ?? "Front finger slid before tail snapped.",
      target: "index",
      arrows,
    };
  }

  if (attempt.metrics.popTiming === "late-flick" || title === "LATE FLICK") {
    return {
      frameIndex: lateFlickIdx,
      severity: "mistake",
      tag: "LATE FLICK",
      detail: attempt.failureReasons[0] ?? "Flick fired past apex while dropping.",
      target: "index",
      arrows,
    };
  }

  if (landing === "primo" || title === "PRIMO LANDING") {
    return {
      frameIndex: Math.max(apexIdx + 1, landIdx - 1),
      severity: "mistake",
      tag: "PRIMO CATCH",
      detail: attempt.failureReasons[0] ?? "Caught edge-on before completing rotation.",
      target: "index",
      arrows,
    };
  }

  if (landing === "rocket" || title === "ROCKET OLLIE") {
    return {
      frameIndex: Math.max(apexIdx + 1, landIdx - 1),
      severity: "mistake",
      tag: "ROCKET NOSE",
      detail: attempt.failureReasons[0] ?? "Nose stayed pitched steep on catch.",
      target: "index",
      arrows,
    };
  }

  if (title === "MISSED GRIND LOCK") {
    return {
      frameIndex: dropIdx,
      severity: "mistake",
      tag: "EARLY DROP",
      detail: attempt.failureReasons[0] ?? "Dropped past rail height without locking.",
      target: "index",
      arrows,
    };
  }

  if (title === "MISSING WRIST TURN" || title === "WRIST TWISTED") {
    const midAirIdx = Math.round((popIdx + apexIdx) / 2);
    return {
      frameIndex: midAirIdx,
      severity: "mistake",
      tag: title === "MISSING WRIST TURN" ? "WRIST FROZEN" : "WRIST TWIST",
      detail: attempt.failureReasons[0] ?? attempt.diagnosis.whyFailed,
      target: "wrist",
      arrows,
    };
  }

  if (title === "STIFF FINGERS" || title === "CLAW GRIP") {
    return {
      frameIndex: popIdx,
      severity: "mistake",
      tag: title === "STIFF FINGERS" ? "STIFF ARCH" : "CLAW PINCH",
      detail: attempt.failureReasons[0] ?? attempt.diagnosis.whyFailed,
      target: title === "CLAW GRIP" ? "middle" : "index",
      arrows,
    };
  }

  if (landing === "sketchy" || title === "SKETCHY CATCH") {
    return {
      frameIndex: dropIdx,
      severity: "mistake",
      tag: "EARLY DROP",
      detail: attempt.failureReasons[0] ?? "Dropped early into an off-level catch.",
      target: "index",
      arrows,
    };
  }

  if (
    title === "DEAD POP" ||
    title === "TRICK MISMATCH" ||
    title === "SPLIT STANCE" ||
    title === "SLOPPY SLIDE"
  ) {
    const isDropIssue = attempt.failureReasons.some((r) => /drop|under|half|flip/i.test(r));
    return {
      frameIndex: isDropIssue ? dropIdx : apexIdx,
      severity: "mistake",
      tag: isDropIssue ? "EARLY DROP" : title,
      detail: attempt.failureReasons[0] ?? attempt.diagnosis.whyFailed,
      target: arrows[0]?.target ?? "index",
      arrows,
    };
  }

  return {
    frameIndex: apexIdx,
    severity: "clean",
    tag: "CLEAN CATCH",
    detail: attempt.diagnosis.advice,
    target: "index",
    arrows: [],
  };
}

function mapPt(nx: number, ny: number, w: number, h: number, mirrored: boolean): [number, number] {
  return [(mirrored ? 1 - nx : nx) * w, ny * h];
}

/**
 * Renders a single frame of a saved clip onto a 2D canvas, complete with:
 * - Source video frame
 * - Fingertip trails & deck bar
 * - Red target highlight + correction arrows right on the exact mistake frame
 * - Clean HUD telemetry footer
 */
export function drawAnnotatedClipFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clip: Pick<SavedClip, "frames" | "mistake" | "mirrored" | "trickName" | "setup" | "attempt">,
  frameIdx: number,
  sourceImage: CanvasImageSource | null,
  options: { showHudBadge?: boolean; animPhase?: number } = {},
) {
  const frames = clip.frames;
  const clampedIdx = Math.max(0, Math.min(frames.length - 1, frameIdx));
  const frame = frames[clampedIdx];
  if (!frame) return;

  const { mirrored, mistake } = clip;
  const isKeyFrame = clampedIdx === mistake.frameIndex;
  const showMistakeCue =
    mistake.severity === "mistake" &&
    (isKeyFrame || clampedIdx === mistake.frameIndex + 1 || clampedIdx === mistake.frameIndex - 1);

  ctx.clearRect(0, 0, w, h);

  // 1. Video frame (mirrored horizontally if recorded from front-facing camera)
  if (sourceImage) {
    ctx.save();
    if (mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sourceImage, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#0B0B0B";
    ctx.fillRect(0, 0, w, h);
  }

  // Subtle top/bottom contrast scrim
  const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.24);
  topGrad.addColorStop(0, "rgba(0,0,0,0.68)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, h * 0.24);

  const botGrad = ctx.createLinearGradient(0, h * 0.72, 0, h);
  botGrad.addColorStop(0, "rgba(0,0,0,0)");
  botGrad.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // Red border flash when hitting the exact mistake frame
  if (isKeyFrame && mistake.severity === "mistake") {
    ctx.save();
    ctx.strokeStyle = MISTAKE_RED;
    ctx.lineWidth = Math.max(3, w * 0.008);
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    ctx.fillStyle = "rgba(255, 42, 42, 0.09)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 2. Fingertip motion trails up to current frame
  const trailStart = Math.max(0, clampedIdx - 14);
  const drawTrail = (pick: (f: ClipFrame) => TipPoint, color: string) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = trailStart; i <= clampedIdx; i++) {
      const f = frames[i];
      if (!f) continue;
      const [px, py] = mapPt(pick(f).x, pick(f).y, w, h, mirrored);
      if (i === trailStart) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  };
  drawTrail((f) => f.index, "rgba(139,92,246, 0.72)");
  drawTrail((f) => f.middle, "rgba(220,38,38, 0.72)");

  // 3. Deck connector & active I/M fingertip markers
  const [ix, iy] = mapPt(frame.index.x, frame.index.y, w, h, mirrored);
  const [mx, my] = mapPt(frame.middle.x, frame.middle.y, w, h, mirrored);
  const r = Math.max(6, Math.min(10, w * 0.017));

  ctx.save();
  ctx.strokeStyle = "rgba(244, 242, 237, 0.85)";
  ctx.lineWidth = Math.max(2, w * 0.005);
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(ix, iy);
  ctx.stroke();
  ctx.setLineDash([]);

  const drawTip = (x: number, y: number, fill: string, text: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0B0B0B";
    ctx.font = `700 ${Math.round(r * 1.15)}px "Space Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 0.5);
  };
  drawTip(ix, iy, "#8B5CF6", "I");
  drawTip(mx, my, "#DC2626", "M");
  ctx.restore();

  // 4. Red mistake target highlight + directional correction arrows
  const anchorFrame = frames[mistake.frameIndex] ?? frame;
  const targetCoord = (target: MistakeHighlight["target"]): [number, number] => {
    if (target === "index") {
      return mapPt(anchorFrame.index.x, anchorFrame.index.y, w, h, mirrored);
    }
    if (target === "middle") {
      return mapPt(anchorFrame.middle.x, anchorFrame.middle.y, w, h, mirrored);
    }
    return mapPt(
      (anchorFrame.index.x + anchorFrame.middle.x) / 2,
      (anchorFrame.index.y + anchorFrame.middle.y) / 2,
      w,
      h,
      mirrored,
    );
  };

  if (showMistakeCue) {
    const [tx, ty] = targetCoord(mistake.target);
    const pulse = 1 + 0.14 * Math.sin((options.animPhase ?? 0) * 6);
    ctx.save();
    ctx.strokeStyle = MISTAKE_RED;
    ctx.lineWidth = 2.6;
    ctx.shadowColor = MISTAKE_RED;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(tx, ty, r * 2.15 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair ticks
    const tick = r * 2.8;
    ctx.beginPath();
    ctx.moveTo(tx - tick, ty);
    ctx.lineTo(tx - r * 1.6, ty);
    ctx.moveTo(tx + r * 1.6, ty);
    ctx.lineTo(tx + tick, ty);
    ctx.stroke();

    // Red pill-less fault tag directly above target point
    const fontSize = Math.max(10, Math.round(w * 0.024));
    ctx.font = `700 ${fontSize}px "Space Mono", monospace`;
    const padX = 7;
    const textW = ctx.measureText(mistake.tag).width;
    const boxW = textW + padX * 2;
    const boxH = fontSize + 8;
    const bx = Math.max(8, Math.min(w - boxW - 8, tx - boxW / 2));
    const by = Math.max(28, ty - r * 3.1 - boxH);

    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.fillStyle = MISTAKE_RED;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 0;
    ctx.fillText(mistake.tag, bx + padX, by + boxH / 2 + 0.5);
    ctx.restore();
  } else if (isKeyFrame && mistake.severity === "clean") {
    const [tx, ty] = targetCoord(mistake.target);
    ctx.save();
    ctx.strokeStyle = "#8B5CF6";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(tx, ty, r * 2.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw directional correction arrows from the mistake frame onward
  if (mistake.arrows.length > 0 && clampedIdx >= Math.max(0, mistake.frameIndex - 1)) {
    const rawSign = mirrored ? -1 : 1;
    for (const arrow of mistake.arrows) {
      const anchorNorm =
        arrow.target === "index"
          ? anchorFrame.index
          : arrow.target === "middle"
            ? anchorFrame.middle
            : {
                x: (anchorFrame.index.x + anchorFrame.middle.x) / 2,
                y: (anchorFrame.index.y + anchorFrame.middle.y) / 2,
              };

      const p0 = mapPt(
        anchorNorm.x + arrow.fromOffset.x * rawSign,
        anchorNorm.y + arrow.fromOffset.y,
        w,
        h,
        mirrored,
      );
      const p1 = mapPt(
        anchorNorm.x + arrow.ctrlOffset.x * rawSign,
        anchorNorm.y + arrow.ctrlOffset.y,
        w,
        h,
        mirrored,
      );
      const p2 = mapPt(
        anchorNorm.x + arrow.toOffset.x * rawSign,
        anchorNorm.y + arrow.toOffset.y,
        w,
        h,
        mirrored,
      );

      const color =
        mistake.severity === "mistake" && arrow === mistake.arrows[0]
          ? MISTAKE_RED
          : TONE_COLOR[arrow.tone];

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(2.2, w * 0.0052);
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 6;
      ctx.setLineDash([7, 4]);
      ctx.lineDashOffset = -((options.animPhase ?? 0) * 32);

      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
      ctx.stroke();

      ctx.setLineDash([]);
      const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      const head = Math.max(8, w * 0.018);
      ctx.beginPath();
      ctx.moveTo(p2[0], p2[1]);
      ctx.lineTo(
        p2[0] - head * Math.cos(angle - Math.PI / 6),
        p2[1] - head * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        p2[0] - head * Math.cos(angle + Math.PI / 6),
        p2[1] - head * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();

      const labelFont = Math.max(9.5, Math.round(w * 0.022));
      ctx.font = `700 ${labelFont}px "Space Mono", monospace`;
      const lx = Math.min(w - 8, Math.max(8, p2[0]));
      const ly = Math.min(h - 24, Math.max(18, p2[1] - 10));
      ctx.textAlign = p2[0] > w * 0.65 ? "right" : p2[0] < w * 0.35 ? "left" : "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(arrow.label, lx, ly);
      ctx.restore();
    }
  }

  // 5. Optional HUD header/footer baked cleanly into exported video frames
  if (options.showHudBadge) {
    const setupTag = clip.setup ? getDeckSetup(clip.setup).shortTag : "";
    const hudFont = Math.max(10, Math.round(w * 0.022));
    ctx.save();
    ctx.font = `700 ${hudFont}px "Space Mono", monospace`;
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#8B5CF6";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${clip.trickName}${setupTag ? ` · ${setupTag}` : ""} · ${clip.attempt.diagnosis.title}`,
      12,
      10,
    );

    ctx.fillStyle = isKeyFrame && mistake.severity === "mistake" ? MISTAKE_RED : "#F4F2ED";
    ctx.textAlign = "right";
    ctx.fillText(`0.35x SLOW-MO · ${frame.tMs >= 0 ? "+" : ""}${frame.tMs}ms`, w - 12, 10);
    ctx.restore();
  }
}

export function pickSupportedVideoMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

/**
 * Generates a slow-motion downloadable & shareable video file (`.webm` / `.mp4`)
 * with visual overlay arrows & red mistake-frame freeze highlight baked onto the video.
 */
export async function encodeSlowMoClipVideo(
  clip: Pick<
    SavedClip,
    "frames" | "mistake" | "mirrored" | "trickName" | "setup" | "attempt" | "width" | "height"
  >,
  getFrameSource: (index: number) => CanvasImageSource | null,
): Promise<{ blob: Blob; mimeType: string } | null> {
  if (typeof document === "undefined" || clip.frames.length < 2) return null;
  const mimeType = pickSupportedVideoMimeType();
  if (!mimeType) return null;

  const canvas = document.createElement("canvas");
  canvas.width = clip.width;
  canvas.height = clip.height;
  if (typeof canvas.captureStream !== "function") return null;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const stream = canvas.captureStream(30);
  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1_800_000,
    });
  } catch {
    return null;
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<{ blob: Blob; mimeType: string } | null>((resolve) => {
    recorder.onstop = () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
    };
    recorder.onerror = () => resolve(null);
  });

  // Render first frame before starting recorder so stream starts cleanly
  drawAnnotatedClipFrame(ctx, canvas.width, canvas.height, clip, 0, getFrameSource(0), {
    showHudBadge: true,
    animPhase: 0,
  });

  recorder.start();

  const waitMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const stepMs = 82; // ~3x slow motion vs 30fps

  for (let i = 0; i < clip.frames.length; i++) {
    const isMistakeHold = i === clip.mistake.frameIndex && clip.mistake.severity === "mistake";
    const subSteps = isMistakeHold ? 7 : 1;
    for (let s = 0; s < subSteps; s++) {
      drawAnnotatedClipFrame(ctx, canvas.width, canvas.height, clip, i, getFrameSource(i), {
        showHudBadge: true,
        animPhase: i * 0.12 + s * 0.15,
      });
      await waitMs(stepMs);
    }
  }

  try {
    recorder.stop();
  } catch {
    return null;
  }
  stream.getTracks().forEach((t) => t.stop());

  return done;
}

/**
 * Renders the annotated mistake frame (with red reticle + arrows) as a crisp thumbnail data URL.
 */
export function renderMistakePosterDataUrl(
  clip: Pick<
    SavedClip,
    "frames" | "mistake" | "mirrored" | "trickName" | "setup" | "attempt" | "width" | "height"
  >,
  getFrameSource: (index: number) => CanvasImageSource | null,
): string {
  if (typeof document === "undefined" || clip.frames.length === 0) return "";
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(320, clip.width);
  canvas.height = Math.round((canvas.width / Math.max(1, clip.width)) * clip.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  drawAnnotatedClipFrame(
    ctx,
    canvas.width,
    canvas.height,
    clip,
    clip.mistake.frameIndex,
    getFrameSource(clip.mistake.frameIndex),
    { showHudBadge: false, animPhase: 0 },
  );
  return canvas.toDataURL("image/jpeg", 0.78);
}
