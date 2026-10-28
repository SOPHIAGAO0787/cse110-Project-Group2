import { describe, expect, it } from "vitest";
import { MAX_DT, toDt } from "./GameLoop";

describe("toDt", () => {
  it("converts frame milliseconds to seconds", () => {
    expect(toDt(16)).toBeCloseTo(0.016);
  });

  it("caps long frames so enemies don't jump after a tab switch", () => {
    expect(toDt(5000)).toBe(MAX_DT);
  });

  it("never returns a negative step", () => {
    expect(toDt(-10)).toBe(0);
  });
});
