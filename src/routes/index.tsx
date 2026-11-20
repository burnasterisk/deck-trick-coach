import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ControlBar, type CalibrationState } from "@/components/deckcoach/ControlBar";
import { GhostDeck } from "@/components/deckcoach/GhostDeck";
import { StanceGuide } from "@/components/deckcoach/StanceGuide";
import { SurfaceOverlay } from "@/components/deckcoach/SurfaceOverlay";
import { TopBar } from "@/components/deckcoach/TopBar";
import { Viewfinder } from "@/components/deckcoach/Viewfinder";
import { useCamera } from "@/hooks/use-camera";
import { DEFAULT_TRICK, getTrick, type TrickId } from "@/lib/tricks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DeckCoach — Fingerboard Training Camera" },
      {
        name: "description",
        content:
          "Live camera coaching for Tech Deck fingerboarding. Pick a trick, calibrate your surface and follow the stance guide.",
      },
      { property: "og:title", content: "DeckCoach — Fingerboard Training Camera" },
      {
        property: "og:description",
        content: "Live camera coaching for Tech Deck ollies, kickflips, heelflips, shuvits and tre flips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SCAN_MS = 2400;

function Index() {
  const camera = useCamera();
  const [trickId, setTrickId] = useState<TrickId>(DEFAULT_TRICK);
  const [calibration, setCalibration] = useState<CalibrationState>("idle");
  const [stanceGuide, setStanceGuide] = useState(true);
  const [ghostDeck, setGhostDeck] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trick = getTrick(trickId);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function calibrate() {
    setCalibration("scanning");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCalibration("locked"), SCAN_MS);
  }

  return (
    <main className="app-viewport relative w-full overflow-hidden bg-background text-foreground">
      <h1 className="sr-only">DeckCoach fingerboard training camera</h1>
      <Viewfinder
        videoRef={camera.videoRef}
        status={camera.status}
        error={camera.error}
        info={camera.info}
        onRetry={camera.retry}
      />
      <SurfaceOverlay state={calibration} />
      {ghostDeck && <GhostDeck />}
      {stanceGuide && <StanceGuide trick={trick} />}
      <TopBar
        status={camera.status}
        info={camera.info}
        trick={trick}
        canFlip={camera.canFlip}
        onFlip={camera.flip}
      />
      <ControlBar
        trick={trickId}
        onTrickChange={setTrickId}
        calibration={calibration}
        onCalibrate={calibrate}
        stanceGuide={stanceGuide}
        onStanceGuideChange={setStanceGuide}
        ghostDeck={ghostDeck}
        onGhostDeckChange={setGhostDeck}
      />
    </main>
  );
}
