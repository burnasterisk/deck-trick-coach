import type { BoardCalibration } from "@/lib/board-calibration";
import { getDeckSetup, type DeckSetupId } from "@/lib/setup";
import { getTrickCue, type Trick } from "@/lib/tricks";

interface StanceGuideProps {
  trick: Trick;
  setup: DeckSetupId;
  boardLock?: BoardCalibration | null;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function StanceGuide({ trick, setup, boardLock = null }: StanceGuideProps) {
  const setupProfile = getDeckSetup(setup);
  const cue = getTrickCue(trick, setup);
  const locked = boardLock !== null;
  const guideScale = locked ? clamp(boardLock.scale, 0.78, 1.18) : 1;
  const guideTilt = locked ? clamp(boardLock.tiltAngleDeg, -24, 24) : 0;

  return (
    <aside
      aria-label={`${trick.name} stance guide`}
      key={`${trick.id}-${setup}`}
      className={
        locked
          ? "pointer-events-none absolute z-20 flex w-36 animate-slap flex-col gap-2 transition-[left,top,transform] duration-200 ease-out sm:w-44"
          : "pointer-events-none absolute top-16 right-3 z-20 flex w-36 animate-slap flex-col gap-2 sm:top-20 sm:right-5 sm:w-44"
      }
      style={
        locked
          ? {
              left: `clamp(5.25rem, ${(boardLock.centerNorm.x * 100).toFixed(1)}%, calc(100% - 5.25rem))`,
              top: `clamp(4.5rem, calc(${(boardLock.centerNorm.y * 100).toFixed(1)}% - ${Math.round(Math.max(135, boardLock.deckLengthPx * 0.65))}px), calc(100% - 14.5rem))`,
              transform: `translate(-50%, -50%) scale(${guideScale.toFixed(3)}) rotate(${guideTilt.toFixed(2)}deg)`,
            }
          : undefined
      }
    >
      <div className="hud-glass rounded-xl p-2.5 text-paper">
        <div className="flex items-center justify-between gap-2">
          <p className="font-marker text-sm leading-none text-primary truncate">{trick.name}</p>
          <p
            className="font-mono text-[9px] tracking-widest text-hazard shrink-0"
            aria-label={`Difficulty ${trick.difficulty} of 5`}
          >
            {"■".repeat(trick.difficulty)}
            <span className="text-paper/20">{"■".repeat(5 - trick.difficulty)}</span>
          </p>
        </div>

        <p className="mt-1 font-mono text-[10px] text-paper/60 truncate">
          {setupProfile.gripName}
          {locked ? ` · ${boardLock.scale.toFixed(2)}×` : ""}
        </p>

        <svg viewBox="0 0 120 320" className="mx-auto my-2 h-36 w-auto sm:h-44" role="img">
          <title>{`${trick.name} finger placement`}</title>
          <rect
            x="18"
            y="10"
            width="84"
            height="300"
            rx="42"
            className={
              setup === "wood" ? "fill-black/75 stroke-paper/45" : "fill-black/60 stroke-paper/35"
            }
            strokeWidth="2.5"
          />
          <line x1="22" y1="58" x2="98" y2="58" className="stroke-paper/20" strokeDasharray="3 4" />
          <line
            x1="22"
            y1="262"
            x2="98"
            y2="262"
            className="stroke-paper/20"
            strokeDasharray="3 4"
          />
          {[74, 246].map((y) => (
            <g key={y} className="fill-paper/45">
              <circle cx="48" cy={y} r="2" />
              <circle cx="72" cy={y} r="2" />
              <circle cx="48" cy={y + 12} r="2" />
              <circle cx="72" cy={y + 12} r="2" />
            </g>
          ))}
          <text
            x="60"
            y="28"
            textAnchor="middle"
            className="fill-paper/65 font-mono text-[9px] font-bold"
          >
            NOSE
          </text>
          <text
            x="60"
            y="300"
            textAnchor="middle"
            className="fill-paper/65 font-mono text-[9px] font-bold"
          >
            TAIL
          </text>

          <defs>
            <marker
              id="dc-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" className="fill-hazard" />
            </marker>
          </defs>
          {trick.motion.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="6 4"
              markerEnd="url(#dc-arrow)"
              className="stroke-hazard animate-dash"
            />
          ))}

          {trick.fingers.map((f) => (
            <g key={f.finger}>
              <circle
                cx={f.x}
                cy={f.y}
                r="13"
                className="fill-primary stroke-ink"
                strokeWidth="2.5"
              />
              <text
                x={f.x}
                y={f.y + 4.5}
                textAnchor="middle"
                className="fill-ink font-marker text-[13px]"
              >
                {f.finger}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex items-center justify-center gap-3 border-t border-paper/10 pt-1.5 font-mono text-[10px] text-paper/75">
          <span>
            <span className="font-bold text-primary">I</span> Index
          </span>
          <span className="text-paper/30" aria-hidden="true">
            ·
          </span>
          <span>
            <span className="font-bold text-primary">M</span> Middle
          </span>
        </div>

        <p className="mt-1.5 hidden font-mono text-[10px] leading-snug text-paper/75 sm:block">
          {cue}
        </p>
      </div>
    </aside>
  );
}
