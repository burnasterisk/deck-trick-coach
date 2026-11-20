import type { Trick } from "@/lib/tricks";

export function StanceGuide({ trick }: { trick: Trick }) {
  return (
    <aside
      aria-label={`${trick.name} stance guide`}
      key={trick.id}
      className="pointer-events-none absolute top-24 right-3 z-20 flex w-40 animate-slap flex-col items-center gap-3 sm:top-28 sm:right-6 sm:w-52"
    >
      {/* Wheatpasted poster */}
      <div className="relative w-full rotate-2 drop-hard">
        <span className="tape-tab -top-2 left-1/2 z-10 -translate-x-1/2 -rotate-3" />
        <div className="torn-paper bg-paper grain px-3 pt-4 pb-3 text-paper-foreground">
          <div className="mb-1 flex items-end justify-between">
            <p className="font-display text-xl leading-none">STANCE</p>
            <p className="hud-label text-hazard">
              {"■".repeat(trick.difficulty)}
              <span className="text-paper-foreground/25">{"■".repeat(5 - trick.difficulty)}</span>
            </p>
          </div>
          <p className="mb-2 font-marker text-base leading-none text-hazard">{trick.name}</p>

          <svg viewBox="0 0 120 320" className="mx-auto h-48 w-auto sm:h-60" role="img">
            <title>{`${trick.name} finger placement`}</title>
            {/* Deck with grip tape */}
            <rect x="18" y="10" width="84" height="300" rx="42" className="fill-asphalt stroke-ink" strokeWidth="3" />
            <line x1="22" y1="58" x2="98" y2="58" className="stroke-paper/30" strokeDasharray="3 4" />
            <line x1="22" y1="262" x2="98" y2="262" className="stroke-paper/30" strokeDasharray="3 4" />
            {[74, 246].map((y) => (
              <g key={y} className="fill-tape">
                <circle cx="48" cy={y} r="2" />
                <circle cx="72" cy={y} r="2" />
                <circle cx="48" cy={y + 12} r="2" />
                <circle cx="72" cy={y + 12} r="2" />
              </g>
            ))}
            <text x="60" y="28" textAnchor="middle" className="fill-paper font-mono text-[9px] font-bold">
              NOSE
            </text>
            <text x="60" y="300" textAnchor="middle" className="fill-paper font-mono text-[9px] font-bold">
              TAIL
            </text>

            <defs>
              <marker id="dc-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
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
                <circle cx={f.x} cy={f.y} r="14" className="fill-primary stroke-ink" strokeWidth="3" />
                <text
                  x={f.x}
                  y={f.y + 5}
                  textAnchor="middle"
                  className="fill-ink font-marker text-[14px]"
                >
                  {f.finger}
                </text>
              </g>
            ))}
          </svg>

          <div className="mt-2 flex justify-center gap-3">
            <p className="hud-label">
              <span className="text-hazard">I</span> Index
            </p>
            <p className="hud-label">
              <span className="text-hazard">M</span> Middle
            </p>
          </div>
        </div>
      </div>

      <div className="hidden w-full -rotate-1 drop-hard sm:block">
        <p className="torn-paper bg-paper grain px-3 py-2.5 text-xs leading-snug text-paper-foreground">
          <span className="font-marker text-sm text-hazard">{trick.name}: </span>
          {trick.cue}
        </p>
      </div>
    </aside>
  );
}
