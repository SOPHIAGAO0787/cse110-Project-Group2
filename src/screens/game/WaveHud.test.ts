// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, expect, it, vi } from "vitest";
import { GameLoop } from "../../core/GameLoop";
import { GameModel } from "../../model/GameModel";
import { GameScreenController } from "./GameScreenController";

let screen: GameScreenController | undefined;

afterEach(() => {
  screen?.hide();
  screen?.group.destroy();
  vi.restoreAllMocks();
});

it("Start Wave updates the real HUD through the model and existing events across waves", () => {
  vi.spyOn(GameLoop.prototype, "start").mockImplementation(() => {});
  const start = vi.spyOn(GameModel.prototype, "startNextWave");
  screen = new GameScreenController({ switchTo: vi.fn() });
  screen.show();
  const texts = screen.group.find<Konva.Text>("Text");
  const button = texts.find((text) => text.text() === "Start Wave")!.getParent()!;
  const hud = texts.find((text) => text.text().startsWith("Coins:"))!;
  expect(hud.text()).toContain("Wave: 0/2   ·   Enemies Remaining: 0");

  button.fire("click");
  expect(start).toHaveBeenCalledTimes(1);
  const game = start.mock.contexts[0];
  if (!(game instanceof GameModel)) throw new Error("Start Wave did not call the game model");
  expect(hud.text()).toContain("Wave: 1/2   ·   Enemies Remaining: 5");
  game.tick(5);
  expect(game.enemies).toHaveLength(5);
  const [first, ...rest] = game.enemies;
  game.events.emit("enemyKilled", { enemyId: first.id, reward: first.def.reward });
  expect(hud.text()).toContain(`Coins: ${100 + first.def.reward}`);
  expect(hud.text()).toContain("Enemies Remaining: 4");
  for (const enemy of rest) game.events.emit("enemyLeaked", { enemyId: enemy.id });
  expect(hud.text()).toContain("Wave: 1/2   ·   Enemies Remaining: 0");

  button.fire("click");
  expect(hud.text()).toContain("Wave: 2/2   ·   Enemies Remaining: 8");
  game.tick(7);
  for (const enemy of game.enemies.slice(5)) {
    game.events.emit("enemyLeaked", { enemyId: enemy.id });
  }
  expect(hud.text()).toContain("Wave: 2/2   ·   Enemies Remaining: 0");
  button.fire("click");
  expect(hud.text()).toContain("Wave: 2/2   ·   Enemies Remaining: 0");
});
