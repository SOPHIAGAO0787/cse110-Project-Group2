// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { describe, expect, it } from "vitest";
import { CARD_HEIGHT, CARD_WIDTH, Page } from "./Page";

describe("Page", () => {
  it("shows the game's name in the header", () => {
    const page = new Page();
    const texts = page.group.find<Konva.Text>("Text");
    expect(texts.length).toBe(1);
    expect(texts[0].text()).toBe("Geometry Tower Defense");
  });

  it("shrinks the card to fit a narrow window and centers it below the header", () => {
    const page = new Page();
    // The card can use 800 - 2 × 32 = 736 of the width, so the width decides the scale
    page.resize(800, 1000);
    const scale = 736 / CARD_WIDTH;
    expect(page.content.scaleX()).toBeCloseTo(scale);
    expect(page.content.scaleY()).toBeCloseTo(scale);
    expect(page.content.x()).toBeCloseTo(32);
    // 832 tall space below the header and margins: 104 + 32 = 136 down to 968
    expect(page.content.y()).toBeCloseTo(136 + (832 - CARD_HEIGHT * scale) / 2);
  });

  it("shrinks the card to fit a short window and centers it sideways", () => {
    const page = new Page();
    // The card can use 500 - 104 - 2 × 32 = 332 of the height, so the height decides the scale
    page.resize(2000, 500);
    const scale = 332 / CARD_HEIGHT;
    expect(page.content.scaleX()).toBeCloseTo(scale);
    expect(page.content.x()).toBeCloseTo(32 + (1936 - CARD_WIDTH * scale) / 2);
    expect(page.content.y()).toBeCloseTo(136);
  });
});
