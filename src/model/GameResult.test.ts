import { describe, expect, it } from "vitest";
import { MAX_STARS, starRating } from "./GameResult";

describe("starRating (So1)", () => {
  it("gives 0 stars for a defeat, whatever the lives", () => {
    expect(starRating(false, 0, 20)).toBe(0);
    expect(starRating(false, 20, 20)).toBe(0);
  });

  it("gives 3 stars for a victory with no lives lost", () => {
    expect(starRating(true, 20, 20)).toBe(MAX_STARS);
  });

  it.each([
    [19, 2],
    [10, 2], // exactly half still earns 2
    [9, 1],
    [1, 1],
  ])("gives a victory with %i of 20 lives left %i stars", (lives, stars) => {
    expect(starRating(true, lives, 20)).toBe(stars);
  });

  it("gives 3 stars when the map starts with no lives to lose", () => {
    expect(starRating(true, 0, 0)).toBe(MAX_STARS);
  });
});
