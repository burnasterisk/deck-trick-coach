import { describe, expect, it } from "vitest";

import { buildVideoConstraints, detectMobile, flipFacing, getDefaultFacing } from "@/lib/camera";
import { getTricksByCategory, TRICK_CATEGORIES, TRICKS } from "@/lib/tricks";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("camera defaults", () => {
  it("uses the rear camera on mobile", () => {
    expect(detectMobile(IPHONE, 5)).toBe(true);
    expect(getDefaultFacing(true)).toBe("environment");
  });

  it("uses the standard webcam (no facing mode) on desktop", () => {
    expect(detectMobile(MAC_CHROME, 0)).toBe(false);
    const video = buildVideoConstraints({ facing: getDefaultFacing(false) }).video;
    expect(typeof video === "object" && "facingMode" in video).toBe(false);
  });

  it("flip switches between rear and front", () => {
    expect(flipFacing("environment")).toBe("user");
    expect(flipFacing("user")).toBe("environment");
  });
});

describe("trick selector", () => {
  it("organizes all fingerboard tricks into 4 clean categories", () => {
    expect(TRICK_CATEGORIES.map((c) => c.label)).toEqual([
      "Basics",
      "Flips",
      "Scoops/Spins",
      "Grinds/Slides",
    ]);

    expect(getTricksByCategory("basics").map((t) => t.name)).toEqual([
      "Ollie",
      "Boned Ollie",
      "Nollie",
      "Fakie Ollie",
      "Switch Ollie",
    ]);
    expect(getTricksByCategory("flips").map((t) => t.name)).toEqual([
      "Kickflip",
      "Heelflip",
      "Varial Kickflip",
      "Varial Heelflip",
      "Hardflip",
      "Inward Heelflip",
      "Double Kickflip",
    ]);
    expect(getTricksByCategory("spins").map((t) => t.name)).toEqual([
      "Pop Shuvit",
      "FS Shuvit",
      "360 Shuvit",
      "Tre Flip",
      "Laser Flip",
      "Bigspin",
      "Gazelle Flip",
      "Impossible",
    ]);
    expect(getTricksByCategory("grinds").map((t) => t.name)).toEqual([
      "50-50 Grind",
      "5-0 Grind",
      "Boardslide",
      "Smith Grind",
      "Crooked Grind",
    ]);
    expect(TRICKS).toHaveLength(25);
  });
});
