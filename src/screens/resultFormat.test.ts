import { describe, expect, it } from "vitest";
import type { GameResult } from "../model/GameResult";
import { formatStars, formatTime, resultSubtitle, resultTitle, statLines } from "./resultFormat";

const result: GameResult = {
  won: true,
  stars: 2,
  elapsedSeconds: 75.9,
  towersPlaced: 3,
  remainingLives: 12,
  finalCoins: 40,
  questionsSolved: 4,
};

describe("formatTime (So1)", () => {
  it.each([
    [0, "0:00"],
    [59.9, "0:59"], // partial seconds are dropped, never rounded up
    [61, "1:01"],
    [3600, "60:00"],
  ])("shows %f seconds as %s", (seconds, text) => {
    expect(formatTime(seconds)).toBe(text);
  });

  it.each([-5, Number.NaN, Number.POSITIVE_INFINITY])("shows bad input %f as 0:00", (seconds) => {
    expect(formatTime(seconds)).toBe("0:00");
  });
});

describe("formatStars (So1)", () => {
  it.each([
    [0, "☆☆☆"],
    [2, "★★☆"],
    [3, "★★★"],
  ])("shows %i stars as %s", (stars, text) => {
    expect(formatStars(stars)).toBe(text);
  });

  it("clamps out-of-range ratings", () => {
    expect(formatStars(-1)).toBe("☆☆☆");
    expect(formatStars(5)).toBe("★★★");
  });
});

describe("result text (So1)", () => {
  it("names the outcome", () => {
    expect(resultTitle(true)).toBe("Victory!");
    expect(resultTitle(false)).toBe("Defeat");
    expect(resultSubtitle(true)).not.toBe(resultSubtitle(false));
  });

  it("lists every stat in order", () => {
    expect(statLines(result)).toEqual([
      "Time: 1:15",
      "Towers Placed: 3",
      "Questions Solved: 4",
      "Lives Left: 12",
      "Coins Left: 40",
    ]);
  });

  it("still shows stats that are zero", () => {
    const lines = statLines({ ...result, towersPlaced: 0, questionsSolved: 0 });
    expect(lines).toContain("Towers Placed: 0");
    expect(lines).toContain("Questions Solved: 0");
  });
});
