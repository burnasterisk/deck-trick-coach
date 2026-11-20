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
      className="no-scrollbar drop-hard -mx-1 flex snap-x gap-2 overflow-x-auto px-1.5 pt-1.5 pb-2"
    >
      {TRICKS.map((t) => {
        const active = t.id === value;
        return (
          <Button
            key={t.id}
            role="radio"
            aria-checked={active}
            variant={active ? "tape-hot" : "tape"}
            size="pill"
            onClick={() => onChange(t.id)}
            className="tilt-alt shrink-0 snap-start"
          >
            {t.name}
          </Button>
        );
      })}
    </div>
  );
}
