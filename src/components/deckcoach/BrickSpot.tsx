import { cn } from "@/lib/utils";

/** Four-point Y2K sparkle. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" />
    </svg>
  );
}

/** Gothic spiderweb-thorn corner, drawn for the top-left; mirror it with CSS for other corners. */
export function WebCorner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 72"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path d="M2 2H70M2 2L62 28M2 2L44 44M2 2L28 62M2 2V70" strokeWidth="1.4" />
      <path
        d="M2 18Q18 18 18 2M2 34Q34 34 34 2M2 50Q50 50 50 2M2 66Q66 66 66 2"
        strokeWidth="1"
        opacity="0.75"
      />
      <path d="M2 2L14 -4M2 2L-4 14M70 2L76 6" strokeWidth="2.2" />
    </svg>
  );
}

/** A fingerboard standing on its tail, leaning on the wall. */
function LeaningBoard({
  className,
  hue,
}: {
  className?: string;
  hue: "crimson" | "uv" | "chrome";
}) {
  const fill = hue === "crimson" ? "#7f1d1d" : hue === "uv" ? "#4c1d95" : "#3f3f46";
  const accent = hue === "crimson" ? "#dc2626" : hue === "uv" ? "#8b5cf6" : "#e4e4e7";
  return (
    <svg viewBox="0 0 60 210" aria-hidden="true" className={className}>
      <g strokeLinejoin="round">
        <rect x="16" y="4" width="28" height="198" rx="14" fill={fill} stroke="#08080a" strokeWidth="2" />
        <path d="M22 46L38 70M38 46L22 70" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <circle cx="30" cy="112" r="9" fill="none" stroke={accent} strokeWidth="3" />
        <path d="M20 150H40M20 160H40" stroke={accent} strokeWidth="2" opacity="0.7" />
        <rect x="11" y="38" width="38" height="7" rx="2" fill="#a1a1aa" />
        <rect x="11" y="158" width="38" height="7" rx="2" fill="#a1a1aa" />
        {[8, 52].flatMap((x) =>
          [41, 161].map((y) => (
            <rect key={`${x}-${y}`} x={x} y={y - 8} width="5" height="16" rx="2.5" fill="#e4e4e7" />
          )),
        )}
      </g>
    </svg>
  );
}

interface BrickSpotProps {
  /** Leaning boards, wall tag and drips. Turn off behind the live camera frame. */
  scenery?: boolean;
  className?: string;
}

/**
 * Dim-lit underground skatepark wall: dark brick, UV and crimson light pools,
 * dripping tags, leaning fingerboards and film grain. Pure CSS/SVG, no assets.
 */
export function BrickSpot({ scenery = true, className }: BrickSpotProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-background", className)}
      aria-hidden="true"
    >
      <div className="brick-wall absolute inset-0" />
      <div className="brick-offset absolute inset-0 opacity-90" />
      <div className="spot-light absolute inset-0" />

      {scenery && (
        <>
          {/* Wall tag with paint runs */}
          <p className="absolute top-[22%] -left-2 -rotate-6 font-display text-[22vw] leading-none text-uv/25 select-none sm:text-[14vw] lg:text-[10vw]">
            DECK
          </p>
          <svg
            viewBox="0 0 200 120"
            className="absolute top-[34%] left-[2%] h-28 w-[46%] max-w-md"
          >
            {[18, 46, 84, 118, 152, 178].map((x, i) => (
              <g key={x} style={{ transformOrigin: `${x}px 0px`, animation: `drip ${3 + i * 0.7}s ease-in-out infinite` }}>
                <rect x={x} y="0" width="3" height={30 + ((i * 23) % 70)} fill="#dc2626" opacity="0.5" />
                <circle cx={x + 1.5} cy={30 + ((i * 23) % 70)} r="3.2" fill="#dc2626" opacity="0.5" />
              </g>
            ))}
          </svg>

          {/* Floor falloff + leaning boards */}
          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black via-black/80 to-transparent" />
          <LeaningBoard hue="uv" className="absolute bottom-[-3%] left-[3%] h-[34%] -rotate-[11deg]" />
          <LeaningBoard hue="crimson" className="absolute bottom-[-4%] left-[11%] h-[30%] rotate-[7deg]" />
          <LeaningBoard hue="chrome" className="absolute right-[5%] bottom-[-3%] h-[32%] rotate-[10deg]" />
        </>
      )}

      {/* Vignette + grain */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(8_8_10/0.85)_100%)]" />
      <div className="film-grain absolute inset-0" />
    </div>
  );
}
