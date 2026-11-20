import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ClipsDrawer } from "@/components/deckcoach/ClipsDrawer";
import { CoachSticker } from "@/components/deckcoach/CoachSticker";
import { ControlBar, type CalibrationState } from "@/components/deckcoach/ControlBar";
import { FingertipOverlay } from "@/components/deckcoach/FingertipOverlay";
import { GhostDeck } from "@/components/deckcoach/GhostDeck";
import { HomeScreen } from "@/components/deckcoach/HomeScreen";
import { SessionBanner } from "@/components/deckcoach/SessionBanner";
import {
  SessionsDrawer,
  type ActiveTutorialState,
  type SessionsTab,
} from "@/components/deckcoach/SessionsDrawer";
import { StanceGuide } from "@/components/deckcoach/StanceGuide";
import { SurfaceOverlay } from "@/components/deckcoach/SurfaceOverlay";
import { TopBar } from "@/components/deckcoach/TopBar";
import { Viewfinder } from "@/components/deckcoach/Viewfinder";
import { useBoardTracking } from "@/hooks/use-board-tracking";
import { useCamera } from "@/hooks/use-camera";
import { useClipRecorder } from "@/hooks/use-clip-recorder";
import { useHandTracking } from "@/hooks/use-hand-tracking";
import {
  averageHandLandmarks,
  calculateBoardCalibration,
  type HandBoardLandmarks,
  type ViewportSize,
} from "@/lib/board-calibration";
import {
  DAILY_WARMUP_PLAN,
  evaluateTutorialAttempt,
  evaluateWarmupAttempt,
  getTrickOfTheDay,
  getTutorial,
  getWeeklyChallenge,
  isPhysicsAttemptSuccess,
  loadChallengeSubmissions,
  loadCompletedTutorials,
  loadDailyCompletions,
  loadSessionHistory,
  recordCompletedDrillHistory,
  saveChallengeSubmission,
  saveCompletedTutorials,
  saveDailyCompletion,
  saveSessionHistory,
  upsertTrickHistoryEntry,
  type ChallengeSubmission,
  type GuidedTutorial,
  type SessionHistoryEntry,
  type WarmupProgress,
} from "@/lib/sessions";
import { DEFAULT_SETUP, getDeckSetup, type DeckSetupId } from "@/lib/setup";
import { loadBoardProfiles, saveBoardProfiles, type BoardProfile } from "@/lib/board-profiles";
import { TrickAnalyzer, type Attempt } from "@/lib/trick-analyzer";
import { DEFAULT_TRICK, getTrick, type TrickId } from "@/lib/tricks";

const LOCK_SAMPLE_COUNT = 10;
const AUTO_HIDE_IDLE_MS = 4000;
const AUTO_HIDE_ACTIVE_HAND_MS = 1600;

export function App() {
  const mainRef = useRef<HTMLElement | null>(null);
  const [screen, setScreen] = useState<"home" | "skate">("home");
  const onSkate = screen === "skate";
  // Camera (and its permission prompt) only starts once the skater enters a session.
  const camera = useCamera(onSkate);
  const [trickId, setTrickId] = useState<TrickId>(DEFAULT_TRICK);
  const [setup, setSetup] = useState<DeckSetupId>(DEFAULT_SETUP);
  const [boardProfiles, setBoardProfiles] = useState<BoardProfile[]>([]);
  const [boardProfilesHydrated, setBoardProfilesHydrated] = useState(false);
  const [activeBoardProfileId, setActiveBoardProfileId] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState>("idle");
  const [lockedPose, setLockedPose] = useState<{
    landmarks: HandBoardLandmarks;
    mirrored: boolean;
  } | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 1280, height: 720 });
  const [sampleCount, setSampleCount] = useState(0);
  const [stanceGuide, setStanceGuide] = useState(true);
  const [ghostDeck, setGhostDeck] = useState(false);
  const [showTipVisuals, setShowTipVisuals] = useState(true);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [clipsOpen, setClipsOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionsTab, setSessionsTab] = useState<SessionsTab>("presets");
  const [warmup, setWarmup] = useState<WarmupProgress>({
    active: false,
    stepIndex: 0,
    repsCompleted: 0,
    completed: false,
    lastFeedback: null,
  });
  const [activeTutorial, setActiveTutorial] = useState<ActiveTutorialState | null>(null);
  const [completedTutorialIds, setCompletedTutorialIds] = useState<string[]>([]);
  const [warmupDoneToday, setWarmupDoneToday] = useState(false);
  const [totdDoneToday, setTotdDoneToday] = useState(false);
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);
  const [hudHidden, setHudHidden] = useState(false);
  const [lastInteractionAt, setLastInteractionAt] = useState(() => Date.now());

  const mirrored = camera.info?.mirrored ?? false;
  const cameraLive = camera.status === "live";

  // Keep MediaPipe hand tracking running silently in the background whenever camera is live.
  const handTracking = useHandTracking(camera.videoRef, true, cameraLive);
  const clipRecorder = useClipRecorder(camera.videoRef, cameraLive);
  const analyzerRef = useRef<TrickAnalyzer>(new TrickAnalyzer(DEFAULT_SETUP));
  const samplesRef = useRef<HandBoardLandmarks[]>([]);
  const trick = getTrick(trickId);
  const activeBoardProfile = boardProfiles.find((profile) => profile.id === activeBoardProfileId);

  const totdInfo = useMemo(() => getTrickOfTheDay(), []);
  const weeklyChallenge = useMemo(() => getWeeklyChallenge(), []);

  useEffect(() => {
    const profiles = loadBoardProfiles();
    setBoardProfiles(profiles);
    setBoardProfilesHydrated(true);
    let storedActiveId: string | null = null;
    try {
      storedActiveId = localStorage.getItem("deckcoach.active-board-profile.v1");
    } catch {
      // Profiles still load in-memory when browser storage is unavailable.
    }
    const activeProfile = profiles.find((profile) => profile.id === storedActiveId) ?? profiles[0];
    if (activeProfile) {
      setActiveBoardProfileId(activeProfile.id);
      setSetup(activeProfile.material);
    }
  }, []);

  useEffect(() => {
    if (boardProfilesHydrated) saveBoardProfiles(boardProfiles);
  }, [boardProfiles, boardProfilesHydrated]);

  useEffect(() => {
    setCompletedTutorialIds(loadCompletedTutorials());
    const daily = loadDailyCompletions(totdInfo.dateKey);
    setWarmupDoneToday(daily.warmupDone);
    setTotdDoneToday(daily.totdDone);
    setSubmissions(loadChallengeSubmissions());
    setSessionHistory(loadSessionHistory());
  }, [totdInfo.dateKey]);

  // Track viewport size so board scale, center point, and angles stay accurate on resize/rotate.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const update = () => {
      setViewport({
        width: el.clientWidth || window.innerWidth,
        height: el.clientHeight || window.innerHeight,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const boardLock = useMemo(() => {
    if (calibration !== "locked" || !lockedPose) return null;
    return calculateBoardCalibration(lockedPose.landmarks, viewport, lockedPose.mirrored);
  }, [calibration, lockedPose, viewport]);

  // Lightweight real-time CV board tracking beneath the fingertips.
  const boardTrackState = useBoardTracking(
    camera.videoRef,
    handTracking.tips,
    cameraLive,
    mirrored,
    boardLock?.deckLengthNorm,
  );
  const liveFlipRef = useRef(boardTrackState.liveFlipDeg);
  liveFlipRef.current = boardTrackState.liveFlipDeg;

  const wakeHud = useCallback(() => {
    setHudHidden(false);
    setLastInteractionAt(Date.now());
  }, []);

  const bumpInteraction = useCallback(() => {
    setLastInteractionAt(Date.now());
  }, []);

  // Keep analyzer sensitivity & coaching copy synced to the chosen Plastic vs Wood setup.
  useEffect(() => {
    analyzerRef.current.setSetup(setup);
  }, [setup]);

  // Collect hand landmark samples (5, 8, 9, 12) while scanning to lock onto the real board.
  useEffect(() => {
    if (calibration !== "scanning") return;
    const pose = handTracking.handPose;
    if (!pose) return;

    samplesRef.current.push(pose);
    const count = samplesRef.current.length;
    setSampleCount(count);

    if (count >= LOCK_SAMPLE_COUNT) {
      const avg = averageHandLandmarks(samplesRef.current);
      if (avg) {
        setLockedPose({ landmarks: avg, mirrored });
        setCalibration("locked");
        samplesRef.current = [];
        setSampleCount(0);
        setLastInteractionAt(Date.now());
      }
    }
  }, [calibration, handTracking.handPose, mirrored]);

  // Auto-hide non-essential menus while skating (locked onto board or active hand overlays).
  const hasActiveTips = handTracking.tips !== null;
  const skatingActive =
    calibration === "locked" || (hasActiveTips && (showTipVisuals || ghostDeck));

  useEffect(() => {
    if (
      !onSkate ||
      !skatingActive ||
      hudHidden ||
      clipsOpen ||
      sessionsOpen ||
      camera.status === "error"
    )
      return;
    const delay = hasActiveTips ? AUTO_HIDE_ACTIVE_HAND_MS : AUTO_HIDE_IDLE_MS;
    const id = setTimeout(() => {
      setHudHidden(true);
    }, delay);
    return () => clearTimeout(id);
  }, [
    onSkate,
    skatingActive,
    hasActiveTips,
    hudHidden,
    clipsOpen,
    sessionsOpen,
    camera.status,
    lastInteractionAt,
  ]);

  // Keyboard shortcut (H / Escape) to toggle or wake HUD.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!onSkate || clipsOpen || sessionsOpen) return;
      if (e.key === "Escape" && hudHidden) {
        wakeHud();
      } else if (e.key.toLowerCase() === "h" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setHudHidden((prev) => {
          if (prev) setLastInteractionAt(Date.now());
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSkate, clipsOpen, sessionsOpen, hudHidden, wakeHud]);

  // Feed tracked tips + real-time board CV telemetry + hand kinematics to the analyzer silently.
  const lastTipsRef = useRef(handTracking.tips);
  const boardTelemetryRef = useRef(boardTrackState.telemetry);
  const handKinematicsRef = useRef(handTracking.kinematics);
  boardTelemetryRef.current = boardTrackState.telemetry;
  handKinematicsRef.current = handTracking.kinematics;

  const syncSampleRef = useRef(clipRecorder.syncSample);
  syncSampleRef.current = clipRecorder.syncSample;

  const activeTutorialRef = useRef(activeTutorial);
  activeTutorialRef.current = activeTutorial;
  const warmupRef = useRef(warmup);
  warmupRef.current = warmup;
  const totdDateRef = useRef(totdInfo);
  totdDateRef.current = totdInfo;

  const drillRunStatsRef = useRef({
    id: "",
    attempts: 0,
    landedCount: 0,
    bestScore: 0,
  });
  const warmupRunStatsRef = useRef({
    id: "",
    attempts: 0,
    landedCount: 0,
    bestScore: 0,
  });
  const trickBlockRef = useRef<{
    trickId: TrickId;
    setup: DeckSetupId;
    blockId: string;
  }>({
    trickId: DEFAULT_TRICK,
    setup: DEFAULT_SETUP,
    blockId: `trick-${DEFAULT_TRICK}-${DEFAULT_SETUP}-${Date.now()}`,
  });

  useEffect(() => {
    if (trickBlockRef.current.trickId !== trickId || trickBlockRef.current.setup !== setup) {
      trickBlockRef.current = {
        trickId,
        setup,
        blockId: `trick-${trickId}-${setup}-${Date.now()}`,
      };
    }
  }, [trickId, setup]);

  useEffect(() => {
    if (!cameraLive) return;
    if (handTracking.tips === lastTipsRef.current) return;
    lastTipsRef.current = handTracking.tips;
    const now = performance.now();
    const surfaceY = boardLock?.surfaceY ?? 0.68;
    const boardScale = boardLock?.scale ?? 1;
    const prevPhase = analyzerRef.current.getPhase();
    const result = analyzerRef.current.feed(
      handTracking.tips,
      surfaceY,
      now,
      mirrored,
      trickId,
      setup,
      boardScale,
      boardTelemetryRef.current,
      handKinematicsRef.current,
    );
    const nextPhase = analyzerRef.current.getPhase();

    syncSampleRef.current({
      now,
      prevPhase,
      nextPhase,
      attempt: result,
      tips: handTracking.tips,
      mirrored,
      trickId,
      trickName: trick.name,
      setup,
      boardScale,
      boardTelemetry: boardTelemetryRef.current,
      liveFlipDeg: liveFlipRef.current,
      wristRotDeg: Math.round(handKinematicsRef.current?.wristYawDeg ?? 0),
    });

    if (result) {
      setAttempt(result);
      const attemptSuccess = isPhysicsAttemptSuccess(result);

      // Verify phase-by-phase interactive drill if active
      const curTut = activeTutorialRef.current;
      if (curTut && !curTut.completed) {
        const tutDef = getTutorial(curTut.tutorialId);
        if (tutDef) {
          const stats = drillRunStatsRef.current;
          stats.attempts += 1;
          if (attemptSuccess) stats.landedCount += 1;
          stats.bestScore = Math.max(stats.bestScore, result.score);

          const evalTut = evaluateTutorialAttempt(tutDef, curTut.stepIndex, result, boardScale);
          setActiveTutorial({
            tutorialId: curTut.tutorialId,
            stepIndex: evalTut.nextStepIndex,
            completed: evalTut.completed,
            lastFeedback: evalTut.feedback,
          });
          if (evalTut.completed) {
            setCompletedTutorialIds((prev) => {
              if (prev.includes(tutDef.id)) return prev;
              const next = [...prev, tutDef.id];
              saveCompletedTutorials(next);
              return next;
            });
            setSessionHistory((prev) => {
              const next = recordCompletedDrillHistory(prev, {
                id: stats.id || `drill-${tutDef.id}-${Date.now()}`,
                kind: "drill",
                title: tutDef.title,
                trickId: tutDef.trickId,
                setup,
                attempts: stats.attempts,
                landedCount: stats.landedCount,
                bestScore: stats.bestScore,
                lastScore: result.score,
                lastVerdict: result.diagnosis.title,
              });
              saveSessionHistory(next);
              return next;
            });
          }
        }
      } else if (warmupRef.current.active && !warmupRef.current.completed) {
        // Advance Daily Warmup reps & tricks automatically
        const curWarmup = warmupRef.current;
        const wStats = warmupRunStatsRef.current;
        wStats.attempts += 1;
        if (attemptSuccess) wStats.landedCount += 1;
        wStats.bestScore = Math.max(wStats.bestScore, result.score);

        const nextWarmup = evaluateWarmupAttempt(curWarmup, result);
        setWarmup(nextWarmup);
        const nextTarget = DAILY_WARMUP_PLAN[nextWarmup.stepIndex];
        if (nextTarget && nextWarmup.stepIndex !== curWarmup.stepIndex) {
          setTrickId(nextTarget.trickId);
        }
        if (nextWarmup.completed) {
          setWarmupDoneToday(true);
          saveDailyCompletion("warmup", totdDateRef.current.dateKey);
          setSessionHistory((prev) => {
            const next = recordCompletedDrillHistory(prev, {
              id: wStats.id || `warmup-${Date.now()}`,
              kind: "warmup",
              title: "Daily Warmup",
              setup,
              attempts: wStats.attempts,
              landedCount: wStats.landedCount,
              bestScore: wStats.bestScore,
              lastScore: result.score,
              lastVerdict: result.diagnosis.title,
            });
            saveSessionHistory(next);
            return next;
          });
        }
      } else {
        // Free-skate / standalone trick attempts: log & update live physics success rate
        const blockId = trickBlockRef.current.blockId;
        const attemptedTrickName = getTrick(result.trickId as TrickId).name;
        setSessionHistory((prev) => {
          const next = upsertTrickHistoryEntry(prev, result, blockId, attemptedTrickName);
          saveSessionHistory(next);
          return next;
        });
      }

      // Mark Trick of the Day completed on solid matched make
      if (
        result.trickId === totdDateRef.current.trick.id &&
        result.trickMatched &&
        result.score >= 70
      ) {
        setTotdDoneToday(true);
        saveDailyCompletion("totd", totdDateRef.current.dateKey);
      }
    }
  }, [handTracking.tips, cameraLive, boardLock, mirrored, trickId, trick.name, setup]);

  function handleCreateBoardProfile(profile: BoardProfile) {
    setBoardProfiles((prev) => [profile, ...prev.filter((item) => item.id !== profile.id)]);
  }

  function handleDeleteBoardProfile(profileId: string) {
    setBoardProfiles((prev) => prev.filter((profile) => profile.id !== profileId));
    if (activeBoardProfileId === profileId) {
      setActiveBoardProfileId(null);
      try {
        localStorage.removeItem("deckcoach.active-board-profile.v1");
      } catch {
        // The active in-memory selection is still cleared if storage is unavailable.
      }
    }
  }

  function startWithBoardProfile(profile: BoardProfile) {
    setActiveBoardProfileId(profile.id);
    try {
      localStorage.setItem("deckcoach.active-board-profile.v1", profile.id);
    } catch {
      // The in-memory profile remains usable when browser storage is unavailable.
    }
    setSetup(profile.material);
    setHudHidden(false);
    setLastInteractionAt(Date.now());
    setScreen("skate");
  }

  function startLockBoard() {
    wakeHud();
    samplesRef.current = [];
    setSampleCount(0);
    if (handTracking.handPose) {
      samplesRef.current.push(handTracking.handPose);
      setSampleCount(1);
    }
    setCalibration("scanning");
  }

  function cancelLockBoard() {
    samplesRef.current = [];
    setSampleCount(0);
    setCalibration(lockedPose ? "locked" : "idle");
    bumpInteraction();
  }

  function toggleHud() {
    setHudHidden((prev) => {
      if (prev) setLastInteractionAt(Date.now());
      return !prev;
    });
  }

  function goHome() {
    samplesRef.current = [];
    setSampleCount(0);
    setCalibration("idle");
    setLockedPose(null);
    setAttempt(null);
    setScreen("home");
  }

  function handleFlipCamera() {
    samplesRef.current = [];
    setSampleCount(0);
    if (calibration !== "idle") {
      setCalibration("idle");
      setLockedPose(null);
    }
    camera.flip();
  }

  return (
    <main
      ref={mainRef}
      className="app-viewport relative w-full overflow-hidden bg-background text-foreground"
      onPointerDown={() => {
        if (hudHidden) wakeHud();
      }}
    >
      <h1 className="sr-only">DeckCoach fingerboard training camera</h1>
      {onSkate && (
        <>
      <Viewfinder
        videoRef={camera.videoRef}
        status={camera.status}
        error={camera.error}
        info={camera.info}
        onRetry={camera.retry}
      />
      <SurfaceOverlay
        state={calibration}
        boardLock={boardLock}
        handDetected={handTracking.handPose !== null}
        sampleProgress={sampleCount / LOCK_SAMPLE_COUNT}
      />
      {(showTipVisuals || calibration === "scanning") && (
        <FingertipOverlay
          tips={handTracking.tips}
          handPose={handTracking.handPose}
          boardLock={boardLock}
          boardTrack={boardTrackState.telemetry}
          liveFlipDeg={boardTrackState.liveFlipDeg}
          trick={trick}
          showVisuals={showTipVisuals}
          scanning={calibration === "scanning"}
          mirrored={mirrored}
        />
      )}
      {ghostDeck && (
        <GhostDeck
          trick={trick}
          setup={setup}
          tips={handTracking.tips}
          handPose={handTracking.handPose}
          boardLock={boardLock}
          viewport={viewport}
          mirrored={mirrored}
        />
      )}
      {stanceGuide && <StanceGuide trick={trick} setup={setup} boardLock={boardLock} />}
      <TopBar
        status={camera.status}
        trick={trick}
        setup={setup}
        {...(activeBoardProfile ? { boardName: activeBoardProfile.name } : {})}
        canFlip={camera.canFlip}
        onFlip={handleFlipCamera}
        hudHidden={hudHidden}
        onToggleHud={toggleHud}
        onHome={goHome}
      />
      <SessionBanner
        activeTutorial={activeTutorial}
        warmup={warmup}
        onOpenSessions={() => {
          wakeHud();
          setSessionsTab("presets");
          setSessionsOpen(true);
        }}
        onDismiss={() => {
          setActiveTutorial(null);
          setWarmup((w) => ({ ...w, active: false }));
          bumpInteraction();
        }}
      />
      <ControlBar
        trick={trickId}
        onTrickChange={(id) => {
          setTrickId(id);
          bumpInteraction();
        }}
        setup={setup}
        onSetupChange={(next) => {
          setSetup(next);
          bumpInteraction();
        }}
        calibration={calibration}
        onLockBoard={startLockBoard}
        onCancelLock={cancelLockBoard}
        stanceGuide={stanceGuide}
        onStanceGuideChange={(on) => {
          setStanceGuide(on);
          bumpInteraction();
        }}
        ghostDeck={ghostDeck}
        onGhostDeckChange={(on) => {
          setGhostDeck(on);
          bumpInteraction();
        }}
        tipTracking={showTipVisuals}
        onTipTrackingChange={(on) => {
          setShowTipVisuals(on);
          bumpInteraction();
        }}
        trackingStatus={handTracking.status}
        clipsCount={clipRecorder.clips.length}
        recordingClip={clipRecorder.recordingAir}
        onOpenClips={() => {
          wakeHud();
          setSessionsOpen(false);
          setClipsOpen(true);
        }}
        sessionActive={Boolean(activeTutorial || warmup.active)}
        onOpenSessions={() => {
          wakeHud();
          setClipsOpen(false);
          setSessionsOpen(true);
        }}
        hidden={hudHidden}
        onReveal={wakeHud}
        onInteract={bumpInteraction}
      />
      {attempt &&
        !clipsOpen &&
        !sessionsOpen &&
        (() => {
          const savedClipId = clipRecorder.clips.find((c) => c.attempt.id === attempt.id)?.id;
          return (
            <CoachSticker
              attempt={attempt}
              trickName={getTrick(attempt.trickId as TrickId).name}
              mirrored={mirrored}
              {...(savedClipId ? { savedClipId } : {})}
              onOpenClip={(clipId) => {
                setSelectedClipId(clipId);
                setClipsOpen(true);
                setAttempt(null);
              }}
              onDismiss={() => setAttempt(null)}
            />
          );
        })()}
        </>
      )}
      {!onSkate && (
        <HomeScreen
          profiles={boardProfiles}
          activeProfileId={activeBoardProfileId}
          defaultMaterial={setup}
          clipsCount={clipRecorder.clips.length}
          challengeTrickName={weeklyChallenge.trick.name}
          challengeRange={weeklyChallenge.dateRangeLabel}
          onPlay={startWithBoardProfile}
          onCreateProfile={handleCreateBoardProfile}
          onDeleteProfile={handleDeleteBoardProfile}
          onOpenDex={() => {
            setSessionsTab("presets");
            setSessionsOpen(true);
          }}
          onOpenClips={() => setClipsOpen(true)}
          onOpenChallenge={() => {
            setSessionsTab("challenge");
            setSessionsOpen(true);
          }}
        />
      )}
      <ClipsDrawer
        open={clipsOpen}
        clips={clipRecorder.clips}
        selectedClipId={selectedClipId}
        onSelectClip={setSelectedClipId}
        onClose={() => {
          setClipsOpen(false);
          bumpInteraction();
        }}
        onDeleteClip={clipRecorder.deleteClip}
        getFrameSource={clipRecorder.getFrameSource}
        exportClipFramePng={clipRecorder.exportClipFramePng}
      />
      <SessionsDrawer
        open={sessionsOpen}
        initialTab={sessionsTab}
        setup={setup}
        clips={clipRecorder.clips}
        warmup={warmup}
        activeTutorial={activeTutorial}
        completedTutorialIds={completedTutorialIds}
        warmupDoneToday={warmupDoneToday}
        totdDoneToday={totdDoneToday}
        submissions={submissions}
        history={sessionHistory}
        onClose={() => {
          setSessionsOpen(false);
          bumpInteraction();
        }}
        onStartWarmup={() => {
          setActiveTutorial(null);
          setTrickId(DAILY_WARMUP_PLAN[0]!.trickId);
          warmupRunStatsRef.current = {
            id: `warmup-${Date.now()}`,
            attempts: 0,
            landedCount: 0,
            bestScore: 0,
          };
          setWarmup({
            active: true,
            stepIndex: 0,
            repsCompleted: 0,
            completed: false,
            lastFeedback: null,
          });
          setAttempt(null);
          bumpInteraction();
        }}
        onStopWarmup={() => {
          setWarmup((w) => ({ ...w, active: false }));
          bumpInteraction();
        }}
        onPracticeTotd={(id) => {
          setActiveTutorial(null);
          setWarmup((w) => ({ ...w, active: false }));
          setTrickId(id);
          setGhostDeck(true);
          setAttempt(null);
          bumpInteraction();
        }}
        onStartTutorial={(tut: GuidedTutorial) => {
          setWarmup((w) => ({ ...w, active: false }));
          setTrickId(tut.trickId);
          setGhostDeck(true);
          setStanceGuide(true);
          drillRunStatsRef.current = {
            id: `drill-${tut.id}-${Date.now()}`,
            attempts: 0,
            landedCount: 0,
            bestScore: 0,
          };
          setActiveTutorial({
            tutorialId: tut.id,
            stepIndex: 0,
            completed: false,
            lastFeedback: null,
          });
          setAttempt(null);
          bumpInteraction();
        }}
        onStopTutorial={() => {
          setActiveTutorial(null);
          bumpInteraction();
        }}
        onClearHistory={() => {
          setSessionHistory([]);
          saveSessionHistory([]);
          trickBlockRef.current = {
            trickId,
            setup,
            blockId: `trick-${trickId}-${setup}-${Date.now()}`,
          };
          bumpInteraction();
        }}
        onPracticeChallengeTrick={(id) => {
          setActiveTutorial(null);
          setWarmup((w) => ({ ...w, active: false }));
          setTrickId(id);
          setShowTipVisuals(true);
          setAttempt(null);
          bumpInteraction();
        }}
        onSubmitChallengeClip={({ clip, handle }) => {
          const entry: ChallengeSubmission = {
            id: `sub-${Date.now()}`,
            weekKey: weeklyChallenge.weekKey,
            trickId: weeklyChallenge.trickId,
            trickName: weeklyChallenge.trick.name,
            clipId: clip.id,
            score: clip.attempt.score,
            handle,
            setupLabel: getDeckSetup(setup).label,
            posterUrl: clip.posterUrl,
            submittedAt: Date.now(),
          };
          const updated = saveChallengeSubmission(entry);
          setSubmissions(updated);
          return entry;
        }}
      />
    </main>
  );
}
