import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ControlBar, type CalibrationState } from "@/components/deckcoach/ControlBar";
import { CoachSticker } from "@/components/deckcoach/CoachSticker";
import { FingertipOverlay } from "@/components/deckcoach/FingertipOverlay";
import { GhostDeck } from "@/components/deckcoach/GhostDeck";
import { StanceGuide } from "@/components/deckcoach/StanceGuide";
import { SurfaceOverlay } from "@/components/deckcoach/SurfaceOverlay";
import { TopBar } from "@/components/deckcoach/TopBar";
import { Viewfinder } from "@/components/deckcoach/Viewfinder";
import { useCamera } from "@/hooks/use-camera";
import { useHandTracking } from "@/hooks/use-hand-tracking";
import { TrickAnalyzer, type Attempt } from "@/lib/trick-analyzer";
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
  const [tipTracking, setTipTracking] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const handTracking = useHandTracking(camera.videoRef, tipTracking, camera.status === "live");
  const analyzerRef = useRef<TrickAnalyzer>(new TrickAnalyzer());
  const mirrored = camera.info?.mirrored ?? false;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trick = getTrick(trickId);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Feed tracked tips to the analyzer each time they update; a completed
  // pop-up-and-return slaps the coach sticker onto the screen.
  const lastTipsRef = useRef(handTracking.tips);
  useEffect(() => {
    if (!tipTracking || calibration !== "locked") return;
    if (handTracking.tips === lastTipsRef.current) return;
    lastTipsRef.current = handTracking.tips;
    const surfaceY = 0.68; // calibrated tape line sits at ~68% down the frame
    const result = analyzerRef.current.feed(
      handTracking.tips,
      surfaceY,
      performance.now(),
      mirrored,
      trickId,
    );
    if (result) setAttempt(result);
  }, [handTracking.tips, tipTracking, calibration, mirrored, trickId]);

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
      {tipTracking && (
        <FingertipOverlay tips={handTracking.tips} mirrored={camera.info?.mirrored ?? false} />
      )}
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
        tipTracking={tipTracking}
        onTipTrackingChange={setTipTracking}
      />
      {attempt && (
        <CoachSticker
          attempt={attempt}
          trickName={getTrick(attempt.trickId as TrickId).name}
          onDismiss={() => setAttempt(null)}
        />
      )}
    </main>
  );
}
