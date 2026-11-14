// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameScreenView } from "./GameScreenView";
import { QuestionService } from "../../model/questions/QuestionService";

let view: GameScreenView;

beforeEach(() => {
  view = new GameScreenView(
    16,
    10,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    new QuestionService(),
  );
});

afterEach(() => {
  view.prompt.cancel();
  view.group.destroy();
});

describe("GameScreenView HUD", () => {
  it.each([
    [100, 20, 0, 2, 0], // before the first wave
    [0, 20, 1, 2, 5], // no coins
    [50, 0, 1, 2, 3], // no lives
    [125, 19, 1, 2, 0], // cleared wave
    [150, 18, 2, 2, 8], // final wave
    [0, 0, 0, 0, 0], // empty wave list
  ])("renders coins=%i, lives=%i, wave=%i/%i, enemies=%i", (coins, lives, wave, total, enemies) => {
    view.setHud(coins, lives, wave, total, enemies);

    const hud = view.group
      .getChildren()
      .find((node) => node instanceof Konva.Text && node.text().startsWith("Coins:"));
    expect(hud).toBeInstanceOf(Konva.Text);
    expect((hud as Konva.Text).text()).toBe(
      `Coins: ${coins}   ·   Lives: ${lives}   ·   Wave: ${wave}/${total}   ·   Enemies Remaining: ${enemies}`,
    );
  });

  it("replaces previous values, including zeros, without adding HUD nodes", () => {
    const childCount = view.group.getChildren().length;
    view.setHud(100, 20, 1, 2, 5);
    view.setHud(0, 0, 2, 2, 0);

    const texts = view.group
      .getChildren()
      .filter((node) => node instanceof Konva.Text && node.text().startsWith("Coins:"));
    expect(texts).toHaveLength(1);
    expect((texts[0] as Konva.Text).text()).toBe(
      "Coins: 0   ·   Lives: 0   ·   Wave: 2/2   ·   Enemies Remaining: 0",
    );
    expect(view.group.getChildren()).toHaveLength(childCount);
  });
});
