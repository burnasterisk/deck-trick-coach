import { Button } from "@/components/ui/button";
import { TRICKS, type TrickId } from "@/lib/tricks";

interface TrickSelectorProps {
  value: TrickId;
  onChange: (id: TrickId) => void;
}

export function TrickSelector({ value, onChange }: TrickSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Trick"
      className="no-scrollbar -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1"
    >
      {TRICKS.map((t) => {
        const active = t.id === value;
        return (
          <Button
            key={t.id}
            role="radio"
            aria-checked={active}
            variant={active ? "chip-active" : "chip"}
            size="pill"
            onClick={() => onChange(t.id)}
            className="shrink-0 snap-start font-display tracking-wide"
          >
            {t.name}
          </Button>
        );
      })}
    </div>
  );
}
