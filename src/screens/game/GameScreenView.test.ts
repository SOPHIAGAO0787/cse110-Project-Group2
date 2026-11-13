// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameScreenView } from "./GameScreenView";
import { QuestionService } from "../../model/questions/QuestionService";

let view: GameScreenView;

beforeEach(() => {
  view = new GameScreenView(16, 10, () => {}, new QuestionService());
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

it("updates a single timer node, clamps values, and preserves layout on resize", () => {
  const count = view.shopGroup.getChildren().length;
  view.setWaveTimers(9.1, null, false);
  const timer = view.shopGroup
    .find<Konva.Text>("Text")
    .find((text) => text.text().startsWith("Next Wave"))!;
  expect(timer.text()).toBe("Next Wave In: 10s");
  expect(view.startWaveButton.visible()).toBe(false);
  view.setWaveTimers(null, 4.2, false);
  expect(timer.text()).toBe("Last Enemy Spawns In: 5s");
  view.setWaveTimers(-1, null, false);
  expect(timer.text()).toBe("Next Wave In: 0s");
  view.setWaveTimers(NaN, null, false);
  expect(timer.text()).toBe("");
  view.setWaveTimers(null, null, true);
  expect(timer.text()).toBe("");
  expect(view.startWaveButton.visible()).toBe(true);
  view.resize(1200, 800);
  expect(view.shopGroup.x()).toBe(940);
  expect(timer.position()).toEqual({ x: 20, y: 660 });
  expect(view.shopGroup.getChildren()).toHaveLength(count);
});

it("keeps the preparation timer above the relabeled button across resizes", () => {
  view.setWaveTimers(7, null, true);
  const label = view.startWaveButton.findOne<Konva.Text>("Text")!;
  const timer = view.shopGroup
    .find<Konva.Text>("Text")
    .find((text) => text.text().startsWith("Next Wave"))!;
  expect(label.text()).toBe("Start Next Wave");
  expect(view.startWaveButton.visible()).toBe(true);
  expect(timer.text()).toBe("Next Wave In: 7s");
  for (const height of [600, 800]) {
    view.resize(1200, height);
    expect(timer.getAbsolutePosition().y + timer.height()).toBeLessThan(view.startWaveButton.y());
  }
  view.setWaveTimers(null, 2, false);
  expect(view.startWaveButton.visible()).toBe(false);
  expect(timer.text()).toBe("Last Enemy Spawns In: 2s");
  view.setWaveTimers(null, null, true);
  expect(label.text()).toBe("Start Wave");
});
