import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type HandTrackingStatus = "idle" | "loading" | "ready" | "error";

const MEDIAPIPE_VERSION = "1.2.3";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type { HandLandmarkerResult };

/** Loads the MediaPipe HandLandmarker (WASM + model from Google's public CDN, no API key). */
export async function createHandLandmarker(): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const commonOptions = {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: "VIDEO" as const,
    numHands: 1,
  };

  try {
    return await HandLandmarker.createFromOptions(fileset, {
      ...commonOptions,
      baseOptions: { ...commonOptions.baseOptions, delegate: "GPU" },
    });
  } catch {
    // GPU delegates are not available in every mobile/browser combination.
    return HandLandmarker.createFromOptions(fileset, {
      ...commonOptions,
      baseOptions: { ...commonOptions.baseOptions, delegate: "CPU" },
    });
  }
}
