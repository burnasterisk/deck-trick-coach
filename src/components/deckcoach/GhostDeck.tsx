export function GhostDeck() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center"
    >
      <div className="flex w-[84%] max-w-2xl animate-slap flex-col items-center gap-2">
        <svg
          viewBox="0 0 640 210"
          className="ghost-glow w-full"
          role="img"
          aria-label="Side view of a fingerboard deck outline to line up your board against"
        >
          {/* Ground reference under the wheels */}
          <line
            x1="50"
            y1="182"
            x2="590"
            y2="182"
            className="stroke-paper/40"
            strokeWidth="2"
            strokeDasharray="6 4"
          />

          {/* Deck side profile: tail kick, flat body, nose kick */}
          <path
            d="M38 78 Q 60 80 95 98 Q 130 112 170 113 L 470 113 Q 510 112 545 98 Q 580 80 602 78 L 606 90 Q 570 96 535 114 Q 505 126 468 126 L 172 126 Q 135 126 105 114 Q 70 96 34 90 Z"
            className="fill-primary/10 stroke-primary"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeDasharray="6 4"
          />

          {/* Trucks */}
          <line x1="220" y1="126" x2="220" y2="142" className="stroke-primary/70" strokeWidth="6" />
          <line x1="420" y1="126" x2="420" y2="142" className="stroke-primary/70" strokeWidth="6" />

          {/* Wheels */}
          <circle cx="220" cy="160" r="18" className="fill-primary/10 stroke-primary" strokeWidth="3" strokeDasharray="6 4" />
          <circle cx="420" cy="160" r="18" className="fill-primary/10 stroke-primary" strokeWidth="3" strokeDasharray="6 4" />

          {/* Nose / tail tags */}
          <text x="52" y="56" textAnchor="middle" className="fill-primary/70 font-mono text-[13px] font-bold tracking-widest">
            TAIL
          </text>
          <text x="588" y="56" textAnchor="middle" className="fill-primary/70 font-mono text-[13px] font-bold tracking-widest">
            NOSE
          </text>
        </svg>

        <p className="hud-label torn-tape bg-tape grain px-4 py-1 text-tape-foreground drop-hard-sm">
          Ghost deck · side view
        </p>
      </div>
    </div>
  );
}
