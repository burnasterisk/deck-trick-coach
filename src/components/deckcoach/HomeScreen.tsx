import { useState } from "react";
import { ArrowUpRight, BookOpen, Disc3, Layers3, Plus, Trophy } from "lucide-react";

import type { BoardProfile } from "@/lib/board-profiles";
import type { DeckSetupId } from "@/lib/setup";
import { cn } from "@/lib/utils";

import { BoardProfileDialog } from "./BoardProfileDialog";
import { BrickSpot } from "./BrickSpot";

interface HomeScreenProps {
  profiles: BoardProfile[];
  activeProfileId: string | null;
  defaultMaterial: DeckSetupId;
  clipsCount: number;
  challengeTrickName: string;
  challengeRange: string;
  onPlay: (profile: BoardProfile) => void;
  onCreateProfile: (profile: BoardProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onOpenDex: () => void;
  onOpenClips: () => void;
  onOpenChallenge: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function HomeScreen({
  profiles,
  activeProfileId,
  defaultMaterial,
  clipsCount,
  challengeTrickName,
  challengeRange,
  onPlay,
  onCreateProfile,
  onDeleteProfile,
  onOpenDex,
  onOpenClips,
  onOpenChallenge,
}: HomeScreenProps) {
  const [boardFlowOpen, setBoardFlowOpen] = useState(false);

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden text-paper">
      <BrickSpot />

      <header className="relative z-10 flex items-center justify-between px-safe pt-safe">
        <div>
          <p className="font-display text-2xl leading-none tracking-wide text-paper sm:text-3xl">
            DECK<span className="text-primary">COACH</span>
          </p>
          <p className="mt-1 font-mono text-[9px] tracking-[.28em] text-paper/35">FINGERBOARD FIELD NOTES / 001</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_#dc2626]" />
          <span className="font-mono text-[9px] tracking-[.18em] text-paper/45">LOCAL SESSION</span>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-safe py-5">
        <button
          type="button"
          onClick={onOpenChallenge}
          aria-label={`Open weekly challenge: ${challengeTrickName}`}
          className={cn(
            "mb-7 flex w-full max-w-[540px] items-center justify-between gap-3 border-y border-primary/35 bg-black/45 px-3 py-3 text-left backdrop-blur-sm transition-colors hover:border-primary/70 hover:bg-black/65 sm:px-5",
            focusRing,
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Trophy className="size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block font-mono text-[9px] font-bold tracking-[.22em] text-primary">WEEKLY CLIP CHALLENGE</span>
              <span className="mt-0.5 block truncate font-display text-lg leading-tight text-paper">{challengeTrickName}</span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-mono text-[9px] text-paper/55">{challengeRange}</span>
            <ArrowUpRight className="ml-auto mt-1 size-4 text-paper/55" />
          </span>
        </button>

        <div className="relative flex flex-col items-center">
          <span className="mb-3 font-mono text-[9px] tracking-[.34em] text-paper/40">YOUR SESSION STARTS HERE</span>
          <button
            type="button"
            onClick={() => setBoardFlowOpen(true)}
            aria-label="Play — select a board profile"
            className={cn(
              "group relative grid min-h-[142px] min-w-[min(78vw,390px)] place-items-center border-y border-paper/20 bg-black/35 px-8 py-5 text-center backdrop-blur-sm transition-all duration-200 hover:border-primary/65 hover:bg-primary/5 active:scale-[.985] sm:min-h-[176px] sm:min-w-[420px]",
              focusRing,
            )}
          >
            <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            <span className="font-display text-[clamp(3.5rem,13vw,7.5rem)] leading-[.83] tracking-tight text-paper transition-colors group-hover:text-white">
              SKATE
            </span>
            <span className="mt-3 flex items-center gap-2 font-mono text-[10px] font-bold tracking-[.26em] text-primary">
              SELECT YOUR BOARD <ArrowUpRight className="size-3.5" />
            </span>
            <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-uv/70 to-transparent" />
          </button>
          <p className="mt-3 max-w-[300px] text-center font-mono text-[9px] leading-relaxed text-paper/35">
            CAMERA ONLY STARTS AFTER YOU PICK A BOARD AND ENTER THE SESSION
          </p>
        </div>

        <div className="mt-8 grid w-full max-w-[540px] grid-cols-2 gap-2 sm:mt-10">
          <button
            type="button"
            onClick={() => setBoardFlowOpen(true)}
            className={cn("group flex min-h-[76px] items-center gap-3 border border-paper/12 bg-black/40 px-3 text-left transition-colors hover:border-primary/50 hover:bg-black/65 sm:px-4", focusRing)}
          >
            <Layers3 className="size-5 shrink-0 text-uv" />
            <span className="min-w-0">
              <span className="block font-display text-base text-paper">BOARD LOCKER</span>
              <span className="block truncate font-mono text-[9px] text-paper/45">{profiles.length ? `${profiles.length} saved profile${profiles.length === 1 ? "" : "s"}` : "Create your first deck"}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenDex}
            className={cn("group flex min-h-[76px] items-center gap-3 border border-paper/12 bg-black/40 px-3 text-left transition-colors hover:border-primary/50 hover:bg-black/65 sm:px-4", focusRing)}
          >
            <BookOpen className="size-5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block font-display text-base text-paper">TRICK LIBRARY</span>
              <span className="block truncate font-mono text-[9px] text-paper/45">Tricks · tutorials · warmups</span>
            </span>
          </button>
        </div>
      </main>

      <nav aria-label="DeckCoach shortcuts" className="relative z-10 flex items-center justify-between border-t border-paper/10 bg-black/55 px-safe py-2 pb-safe backdrop-blur-md">
        <span className="font-mono text-[9px] tracking-[.18em] text-paper/35">NO SERVER / NO ACCOUNT / ON DEVICE</span>
        <button
          type="button"
          onClick={onOpenClips}
          className={cn("flex min-h-10 items-center gap-2 px-2 text-left transition-colors hover:text-primary", focusRing)}
        >
          <Disc3 className={cn("size-5", clipsCount ? "text-primary" : "text-paper/50")} />
          <span className="font-mono text-[10px] font-bold text-paper/75">CLIPS <span className="text-primary">{clipsCount}</span></span>
          <Plus className="size-3 text-paper/35" />
        </button>
      </nav>

      {boardFlowOpen && (
        <BoardProfileDialog
          open={true}
          profiles={profiles}
          activeProfileId={activeProfileId}
          defaultMaterial={defaultMaterial}
          onClose={() => setBoardFlowOpen(false)}
          onStart={(profile) => {
            setBoardFlowOpen(false);
            onPlay(profile);
          }}
          onCreate={onCreateProfile}
          onDelete={onDeleteProfile}
        />
      )}
    </div>
  );
}
