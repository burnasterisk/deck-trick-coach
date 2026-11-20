import type { Trick } from "@/lib/tricks";

export function StanceGuide({ trick }: { trick: Trick }) {
  return (
    <aside
      aria-label={`${trick.name} stance guide`}
      key={trick.id}
      className="pointer-events-none absolute top-20 right-3 z-20 flex w-40 animate-float-in flex-col items-center gap-2 sm:top-24 sm:right-6 sm:w-52"
    >
      <div className="hud-glass w-full rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="hud-label text-primary">Stance</p>
          <p className="hud-label text-muted-foreground">
            {"●".repeat(trick.difficulty)}
            <span className="opacity-30">{"●".repeat(5 - trick.difficulty)}</span>
          </p>
        </div>

        <svg viewBox="0 0 120 320" className="mx-auto h-48 w-auto sm:h-64" role="img">
          <title>{`${trick.name} finger placement`}</title>
          {/* Deck */}
          <rect
            x="18"
            y="10"
            width="84"
            height="300"
            rx="42"
            className="fill-secondary/80 stroke-hud-border"
            strokeWidth="1.5"
          />
          <line x1="22" y1="58" x2="98" y2="58" className="stroke-hud-border" strokeDasharray="3 4" />
          <line x1="22" y1="262" x2="98" y2="262" className="stroke-hud-border" strokeDasharray="3 4" />
          {/* Truck bolts */}
          {[74, 246].map((y) => (
            <g key={y} className="fill-muted-foreground/50">
              <circle cx="48" cy={y} r="2" />
              <circle cx="72" cy={y} r="2" />
              <circle cx="48" cy={y + 12} r="2" />
              <circle cx="72" cy={y + 12} r="2" />
            </g>
          ))}
          <text x="60" y="28" textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            NOSE
          </text>
          <text x="60" y="300" textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            TAIL
          </text>

          {/* Motion */}
          <defs>
            <marker id="dc-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="fill-primary" />
            </marker>
          </defs>
          {trick.motion.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="6 4"
              markerEnd="url(#dc-arrow)"
              className="stroke-primary animate-dash"
            />
          ))}

          {/* Fingers */}
          {trick.fingers.map((f) => (
            <g key={f.finger}>
              <circle cx={f.x} cy={f.y} r="14" className="fill-primary/20 stroke-primary" strokeWidth="2" />
              <text
                x={f.x}
                y={f.y + 4}
                textAnchor="middle"
                className="fill-primary font-display text-[12px] font-bold"
              >
                {f.finger}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-2 flex justify-center gap-3">
          <p className="hud-label text-muted-foreground">
            <span className="text-primary">I</span> Index
          </p>
          <p className="hud-label text-muted-foreground">
            <span className="text-primary">M</span> Middle
          </p>
        </div>
      </div>

      <p className="hud-glass hidden rounded-2xl px-3 py-2 text-xs leading-snug text-muted-foreground sm:block">
        <span className="font-display font-semibold text-foreground">{trick.name}: </span>
        {trick.cue}
      </p>
    </aside>
  );
}
