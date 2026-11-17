// @vitest-environment jsdom
import type { ScreenSwitcher } from "../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { GameResult } from "../model/GameResult";
import { ResultScreen } from "./ResultScreen";

const defeat: GameResult = {
  won: false,
  stars: 0,
  elapsedSeconds: 42,
  towersPlaced: 2,
  remainingLives: 0,
  finalCoins: 15,
  questionsSolved: 2,
  enemiesDefeated: 3,
  coinsEarned: 17,
  score: 300,
};

let switchTo: Mock<ScreenSwitcher["switchTo"]>;
let screen: ResultScreen;

// Every line of text on the screen, joined, so tests can look for what the player sees.
function shownText(): string {
  return screen.group
    .find("Text")
    .map((node) => (node as Konva.Text).text())
    .join("\n");
}

beforeEach(() => {
  switchTo = vi.fn<ScreenSwitcher["switchTo"]>();
  screen = new ResultScreen({ switchTo });
});

describe("ResultScreen (So1)", () => {
  it("shows a defeat with its stars and stats", () => {
    screen.show(defeat);

    expect(screen.group.visible()).toBe(true);
    expect(shownText()).toContain("Defeat");
    expect(shownText()).toContain("☆☆☆");
    expect(shownText()).toContain("Time: 0:42");
    expect(shownText()).toContain("Questions Solved: 2");
    expect(shownText()).toContain("Enemies Defeated: 3");
    expect(shownText()).toContain("Final Score: 300");
    expect(shownText()).toContain("Coins Earned: 17");
  });

  it("replaces a defeat with a victory when shown again", () => {
    screen.show(defeat);
    screen.show({ ...defeat, won: true, stars: 3, remainingLives: 20 });

    expect(shownText()).toContain("Victory!");
    expect(shownText().split("\n")[0]).not.toBe("Defeat");
    expect(shownText()).toContain("★★★");
  });

  it("falls back to a plain message when there is no result", () => {
    screen.show(defeat);
    screen.show();

    expect(shownText()).toContain("Game over");
    expect(shownText()).not.toContain("Time:");
  });

  it("goes back to the menu", () => {
    screen.show(defeat);
    const button = screen.group.findOne("Group");
    button!.fire("click");

    expect(switchTo).toHaveBeenCalledWith("menu");
  });

  it("hides", () => {
    screen.show(defeat);
    screen.hide();

    expect(screen.group.visible()).toBe(false);
  });

  it.each([480, 600, 768])("keeps all stats above the menu button at %i px height", (height) => {
    screen.show(defeat);
    screen.resize(800, height);
    const stats = screen.group
      .find("Text")
      .find((node) => (node as Konva.Text).text().includes("Enemies Defeated")) as Konva.Text;
    const button = screen.group.findOne("Group")!;
    const scale = screen.group.scaleY();
    const offset = screen.group.y();

    expect(stats.y() + stats.height()).toBeLessThan(button.y());
    expect(offset + (button.y() + 48) * scale).toBeLessThanOrEqual(height);
  });
});
