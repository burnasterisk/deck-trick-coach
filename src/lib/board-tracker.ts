import type { TipPoint, Tips } from "./trick-analyzer";

export interface RoiRect {
  /** Normalized [0..1] video coordinates of the ROI top-left and size. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowVector {
  /** Normalized [0..1] video coordinate of the block center. */
  x: number;
  y: number;
  /** Flow velocity in normalized [0..1] video space per frame. */
  vx: number;
  vy: number;
}

export interface BoardTrackTelemetry {
  /** Whether a high-contrast board region was detected beneath the fingertips. */
  detected: boolean;
  /** Bounding box of the detected board in normalized [0..1] video space. */
  boundingBox: RoiRect;
  /** Estimated board pitch angle in degrees (-90..90). */
  pitchDeg: number;
  /** Instantaneous flip angular speed estimate in degrees/sec. */
  flipRateDegPerSec: number;
  /** Likelihood [0..1] that the board is on its side rail (primo orientation). */
  primoScore: number;
  /** Normalized apparent thickness ratio (height / width) inside the bounding box. */
  aspectRatio: number;
  /** Sampled optical-flow vectors inside the board ROI. */
  flowVectors: FlowVector[];
  /** Mean optical flow velocity across the board ROI. */
  meanFlow: TipPoint;
}

export const BOARD_ROI_W = 64;
export const BOARD_ROI_H = 40;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Computes the normalized [0..1] ROI directly beneath the resting/moving fingertips
 * where the fingerboard deck sits.
 */
export function computeBoardRoi(tips: Tips, deckLengthNorm = 0.24): RoiRect {
  const midX = (tips.index.x + tips.middle.x) / 2;
  const midY = (tips.index.y + tips.middle.y) / 2;
  const tipSpan = Math.hypot(tips.index.x - tips.middle.x, tips.index.y - tips.middle.y);

  const width = clamp(Math.max(deckLengthNorm * 1.35, tipSpan * 2.1, 0.26), 0.22, 0.65);
  const height = clamp(width * 0.58, 0.14, 0.45);

  const x = clamp(midX - width / 2, 0, 1 - width);
  // Shift ROI center slightly below the fingertip midpoint so the deck body fills the patch.
  const y = clamp(midY + height * 0.18 - height / 2, 0, 1 - height);

  return { x, y, width, height };
}

/** Converts RGBA pixels (width * height * 4) to luminance grayscale [0..255] Float32Array. */
export function rgbaToGray(rgba: Uint8ClampedArray | number[], length: number): Float32Array {
  const gray = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const idx = i * 4;
    const r = rgba[idx] ?? 0;
    const g = rgba[idx + 1] ?? 0;
    const b = rgba[idx + 2] ?? 0;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * Runs high-contrast bounding-box segmentation, PCA pitch estimation, and block-matching
 * optical flow on a small grayscale ROI buffer beneath the fingertips.
 */
export function analyzeBoardPatch(
  currGray: Float32Array,
  prevGray: Float32Array | null,
  roi: RoiRect,
  dtMs: number,
  width = BOARD_ROI_W,
  height = BOARD_ROI_H,
): BoardTrackTelemetry {
  const n = width * height;
  const grad = new Float32Array(n);

  let sumGrad = 0;
  let sumGradSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = Math.abs((currGray[i + 1] ?? 0) - (currGray[i - 1] ?? 0));
      const gy = Math.abs((currGray[i + width] ?? 0) - (currGray[i - width] ?? 0));
      const g = gx + gy;
      grad[i] = g;
      sumGrad += g;
      sumGradSq += g * g;
      count++;
    }
  }

  const mean = count > 0 ? sumGrad / count : 0;
  const variance = count > 0 ? Math.max(0, sumGradSq / count - mean * mean) : 0;
  const stdDev = Math.sqrt(variance);
  const threshold = Math.max(22, mean + stdDev * 1.15);

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let weightSum = 0;
  let sumX = 0;
  let sumY = 0;
  let activeCount = 0;

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const i = y * width + x;
      const g = grad[i] ?? 0;
      if (g < threshold) continue;
      activeCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      weightSum += g;
      sumX += x * g;
      sumY += y * g;
    }
  }

  const detected = activeCount >= 12 && maxX > minX + 3 && maxY > minY + 1;

  if (!detected || weightSum <= 0) {
    return {
      detected: false,
      boundingBox: {
        x: roi.x + roi.width * 0.15,
        y: roi.y + roi.height * 0.25,
        width: roi.width * 0.7,
        height: roi.height * 0.45,
      },
      pitchDeg: 0,
      flipRateDegPerSec: 0,
      primoScore: 0,
      aspectRatio: 0.35,
      flowVectors: [],
      meanFlow: { x: 0, y: 0 },
    };
  }

  const cx = sumX / weightSum;
  const cy = sumY / weightSum;

  // 2nd-order central moments for board pitch orientation.
  let mu20 = 0;
  let mu02 = 0;
  let mu11 = 0;
  let upperEnergy = 0;
  let lowerEnergy = 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const g = grad[y * width + x] ?? 0;
      if (g < threshold) continue;
      const dx = x - cx;
      const dy = y - cy;
      mu20 += dx * dx * g;
      mu02 += dy * dy * g;
      mu11 += dx * dy * g;
      if (dy < 0) upperEnergy += g;
      else lowerEnergy += g;
    }
  }

  const rawAngleRad = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
  let pitchDeg = (rawAngleRad * 180) / Math.PI;
  if (pitchDeg > 90) pitchDeg -= 180;
  if (pitchDeg < -90) pitchDeg += 180;

  const boxW = Math.max(4, maxX - minX + 1);
  const boxH = Math.max(2, maxY - minY + 1);
  const aspectRatio = boxH / boxW;

  // Primo heuristic: when a board flips onto its side rail, vertical spread (mu02) rises
  // sharply relative to horizontal spread (mu20) and aspectRatio approaches ~0.65+ while
  // edge energy distributes evenly top-to-bottom.
  const eigenRatio = mu20 > 1e-3 ? Math.sqrt(mu02 / mu20) : 0;
  const balance =
    upperEnergy + lowerEnergy > 0
      ? 1 - Math.abs(upperEnergy - lowerEnergy) / (upperEnergy + lowerEnergy)
      : 0;
  const primoScore = clamp(
    (aspectRatio - 0.48) * 1.8 * 0.6 + (eigenRatio - 0.52) * 1.4 * 0.4 * balance,
    0,
    1,
  );

  const boundingBox: RoiRect = {
    x: roi.x + (minX / width) * roi.width,
    y: roi.y + (minY / height) * roi.height,
    width: (boxW / width) * roi.width,
    height: (boxH / height) * roi.height,
  };

  // Lightweight block-matching optical flow inside the bounding box.
  const flowVectors: FlowVector[] = [];
  let sumVx = 0;
  let sumVy = 0;
  let curlSum = 0;
  let flowSamples = 0;

  if (prevGray && prevGray.length === currGray.length) {
    const cols = 4;
    const rows = 2;
    const searchRadius = 3;
    const patchR = 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = Math.round(minX + ((c + 0.5) / cols) * boxW);
        const by = Math.round(minY + ((r + 0.5) / rows) * boxH);
        if (
          bx < patchR + searchRadius ||
          bx >= width - patchR - searchRadius ||
          by < patchR + searchRadius ||
          by >= height - patchR - searchRadius
        ) {
          continue;
        }

        let pMin = 255;
        let pMax = 0;
        for (let py = -patchR; py <= patchR; py++) {
          const row = (by + py) * width;
          for (let px = -patchR; px <= patchR; px++) {
            const v = currGray[row + bx + px] ?? 0;
            if (v < pMin) pMin = v;
            if (v > pMax) pMax = v;
          }
        }
        // Flat low-contrast patches (e.g. uniform grip/table) lack trackable texture.
        if (pMax - pMin < 18) continue;

        let bestDx = 0;
        let bestDy = 0;
        let bestCost = Infinity;

        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            let sad = 0;
            for (let py = -patchR; py <= patchR; py++) {
              const currRow = (by + py) * width;
              const prevRow = (by + py - dy) * width;
              for (let px = -patchR; px <= patchR; px++) {
                sad += Math.abs(
                  (currGray[currRow + bx + px] ?? 0) - (prevGray[prevRow + bx + px - dx] ?? 0),
                );
              }
            }
            const cost = sad + (dx * dx + dy * dy) * 0.05;
            if (cost < bestCost) {
              bestCost = cost;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }

        const normVx = (bestDx / width) * roi.width;
        const normVy = (bestDy / height) * roi.height;
        flowVectors.push({
          x: roi.x + (bx / width) * roi.width,
          y: roi.y + (by / height) * roi.height,
          vx: normVx,
          vy: normVy,
        });
        sumVx += normVx;
        sumVy += normVy;

        // Cross-product torque + vertical shear across the deck profile indicates flip/spin rate.
        const relX = bx - cx;
        const relY = by - cy;
        const rSq = Math.max(4, relX * relX + relY * relY);
        curlSum += (relX * bestDy - relY * bestDx) / rSq;
        flowSamples++;
      }
    }
  }

  const dtSec = Math.max(0.01, dtMs / 1000);
  const meanVx = flowSamples > 0 ? sumVx / flowSamples : 0;
  const meanVy = flowSamples > 0 ? sumVy / flowSamples : 0;

  // Combine rotational optical flow curl + vertical shear (flipping deck flashes top/bottom edges).
  let verticalFlipShear = 0;
  if (flowVectors.length >= 2) {
    let topVy = 0;
    let botVy = 0;
    let topN = 0;
    let botN = 0;
    const midBoxY = boundingBox.y + boundingBox.height / 2;
    for (const fv of flowVectors) {
      if (fv.y < midBoxY) {
        topVy += fv.vy;
        topN++;
      } else {
        botVy += fv.vy;
        botN++;
      }
    }
    if (topN > 0 && botN > 0) {
      verticalFlipShear = Math.abs(topVy / topN - botVy / botN) / Math.max(0.05, roi.height);
    }
  }

  const avgCurl = flowSamples > 0 ? Math.abs(curlSum / flowSamples) : 0;
  const flipRateDegPerSec = clamp(
    ((avgCurl * 180) / Math.PI + verticalFlipShear * 520) / dtSec,
    0,
    3600,
  );

  return {
    detected,
    boundingBox,
    pitchDeg,
    flipRateDegPerSec,
    primoScore,
    aspectRatio,
    flowVectors,
    meanFlow: { x: meanVx, y: meanVy },
  };
}
