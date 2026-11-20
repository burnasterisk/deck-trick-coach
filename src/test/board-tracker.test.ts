import { describe, expect, it } from "vitest";

import { analyzeBoardPatch, BOARD_ROI_H, BOARD_ROI_W, computeBoardRoi } from "@/lib/board-tracker";

function makeDeckBuffer(opts: {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  slope?: number;
  shiftX?: number;
  shiftY?: number;
}) {
  const { cx, cy, halfW, halfH, slope = 0, shiftX = 0, shiftY = 0 } = opts;
  const buf = new Float32Array(BOARD_ROI_W * BOARD_ROI_H);
  buf.fill(25);
  for (let y = 0; y < BOARD_ROI_H; y++) {
    for (let x = 0; x < BOARD_ROI_W; x++) {
      const dx = x - (cx + shiftX);
      const dy = y - (cy + shiftY + dx * slope);
      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
        buf[y * BOARD_ROI_W + x] = 220;
      }
    }
  }
  return buf;
}

describe("board tracker CV", () => {
  it("computes ROI beneath fingertips", () => {
    const roi = computeBoardRoi({ index: { x: 0.56, y: 0.6 }, middle: { x: 0.44, y: 0.6 } }, 0.24);
    expect(roi.width).toBeGreaterThan(0.25);
    expect(roi.x).toBeLessThan(0.44);
    expect(roi.x + roi.width).toBeGreaterThan(0.56);
    expect(roi.y + roi.height).toBeGreaterThan(0.6);
  });

  it("segments high-contrast bounding box and detects flat vs pitched board", () => {
    const roi = { x: 0.25, y: 0.45, width: 0.4, height: 0.25 };
    const flatGray = makeDeckBuffer({ cx: 32, cy: 20, halfW: 18, halfH: 4, slope: 0 });
    const pitchedGray = makeDeckBuffer({ cx: 32, cy: 20, halfW: 18, halfH: 4, slope: 0.45 });

    const flatRes = analyzeBoardPatch(flatGray, null, roi, 16);
    const pitchedRes = analyzeBoardPatch(pitchedGray, null, roi, 16);

    expect(flatRes.detected).toBe(true);
    expect(Math.abs(flatRes.pitchDeg)).toBeLessThan(8);
    expect(pitchedRes.detected).toBe(true);
    expect(pitchedRes.pitchDeg).toBeGreaterThan(15);
  });

  it("flags high primoScore when board profile stands on its rail edge", () => {
    const roi = { x: 0.25, y: 0.45, width: 0.4, height: 0.25 };
    const flatGray = makeDeckBuffer({ cx: 32, cy: 20, halfW: 20, halfH: 3 });
    const primoGray = makeDeckBuffer({ cx: 32, cy: 20, halfW: 13, halfH: 10 });

    const flatRes = analyzeBoardPatch(flatGray, null, roi, 16);
    const primoRes = analyzeBoardPatch(primoGray, null, roi, 16);

    expect(primoRes.primoScore).toBeGreaterThan(flatRes.primoScore);
    expect(primoRes.primoScore).toBeGreaterThan(0.45);
  });

  it("computes optical flow vectors across shifting frames", () => {
    const roi = { x: 0.25, y: 0.45, width: 0.4, height: 0.25 };
    const prev = makeDeckBuffer({ cx: 32, cy: 20, halfW: 16, halfH: 4 });
    const curr = makeDeckBuffer({ cx: 32, cy: 20, halfW: 16, halfH: 4, shiftX: 2, shiftY: -1 });

    const res = analyzeBoardPatch(curr, prev, roi, 16);

    expect(res.detected).toBe(true);
    expect(res.flowVectors.length).toBeGreaterThan(0);
    expect(res.meanFlow.x).toBeGreaterThan(0);
    expect(res.meanFlow.y).toBeLessThan(0);
  });
});
