import { getDeckSetup, type DeckSetupId } from "@/lib/setup";
import { cn } from "@/lib/utils";

interface SetupToggleProps {
  value: DeckSetupId;
  onChange: (setup: DeckSetupId) => void;
}

const SETUP_ORDER: DeckSetupId[] = ["plastic", "wood"];

export function SetupToggle({ value, onChange }: SetupToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Deck setup"
      className="inline-flex shrink-0 items-center rounded-md border border-paper/15 bg-black/50 p-0.5"
    >
      {SETUP_ORDER.map((id) => {
        const profile = getDeckSetup(id);
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${profile.deckName} (${profile.gripName})`}
            onClick={() => onChange(id)}
            className={cn(
              "flex min-h-[38px] items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[11px] whitespace-nowrap shrink-0 transition-colors cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary text-primary-foreground font-bold"
                : "text-paper/70 hover:text-paper",
            )}
          >
            <span>{profile.label}</span>
            <span
              className={cn(
                "hidden text-[10px] sm:inline",
                active ? "text-primary-foreground/80" : "text-paper/45",
              )}
            >
              · {id === "plastic" ? "Sandpaper" : "Foam"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
