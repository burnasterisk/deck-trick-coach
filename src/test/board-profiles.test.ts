import {
  getBoardProfileLabel,
  getBoardWidthLabel,
  loadBoardProfiles,
  saveBoardProfiles,
  type BoardProfile,
} from "@/lib/board-profiles";

const sampleProfile: BoardProfile = {
  id: "board-test-1",
  name: "My wooden deck",
  material: "wood",
  grip: "foam",
  width: "wide",
  shape: "popsicle",
  createdAt: 100,
  updatedAt: 100,
};

describe("board profile storage", () => {
  beforeEach(() => localStorage.clear());

  it("starts with no profiles", () => {
    expect(loadBoardProfiles()).toEqual([]);
  });

  it("saves and restores board profiles locally", () => {
    saveBoardProfiles([sampleProfile]);
    expect(loadBoardProfiles()).toEqual([sampleProfile]);
  });

  it("ignores malformed profile data", () => {
    localStorage.setItem("deckcoach.board-profiles.v1", JSON.stringify([sampleProfile, { id: 4 }]));
    expect(loadBoardProfiles()).toEqual([sampleProfile]);
  });

  it("describes the saved setup and approximate width", () => {
    expect(getBoardProfileLabel(sampleProfile)).toBe("Wood · Foam");
    expect(getBoardWidthLabel("wide")).toBe("Wide · 34–36 mm");
  });
});
