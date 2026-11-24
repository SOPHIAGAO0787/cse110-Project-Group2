// @vitest-environment jsdom
import type { ScreenSwitcher } from "../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { GameResult } from "../model/GameResult";
import { BUTTON_HEIGHT } from "./button";
import { CARD_HEIGHT, CARD_WIDTH } from "./Page";
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

// The button group that has this label
function buttonWithLabel(label: string): Konva.Group {
  for (const node of screen.group.find("Text")) {
    const button = node.getParent();
    if ((node as Konva.Text).text() === label && button instanceof Konva.Group) {
      return button;
    }
  }
  throw new Error(`${label} button is missing from the screen`);
}

function clickButton(label: string): void {
  buttonWithLabel(label).fire("click");
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
    expect(shownText().split("\n")).not.toContain("Defeat");
    expect(shownText()).toContain("★★★");
  });

  it("falls back to a plain message when there is no result", () => {
    screen.show(defeat);
    screen.show();

    expect(shownText()).toContain("Game over");
    expect(shownText()).not.toContain("Time:");
    expect(shownText()).not.toContain("Tower Shop coins");
  });

  it.each([
    [false, 0, 10],
    [true, 1, 25],
    [true, 2, 50],
    [true, 3, 75],
  ] as const)("shows the shop reward for won=%s, stars=%i", (won, stars, reward) => {
    screen.show({ ...defeat, won, stars });
    expect(shownText()).toContain(`+${reward} Tower Shop coins`);
    const rewardText = screen.group
      .find<Konva.Text>("Text")
      .find((node) => node.text().includes("Tower Shop coins"))!;
    expect(rewardText.y() + rewardText.height()).toBeLessThan(buttonWithLabel("Back to menu").y());
  });

  it("goes back to the menu", () => {
    screen.show(defeat);
    clickButton("Back to menu");

    expect(switchTo).toHaveBeenCalledWith("menu");
  });

  it("goes to the map choice", () => {
    screen.show(defeat);
    clickButton("Choose a map");

    expect(switchTo).toHaveBeenCalledWith("maps");
  });

  it("hides", () => {
    screen.show(defeat);
    screen.hide();

    expect(screen.group.visible()).toBe(false);
  });

  it("keeps all stats above the buttons, and the buttons inside the card", () => {
    screen.show(defeat);
    const stats = screen.group
      .find("Text")
      .find((node) => (node as Konva.Text).text().includes("Enemies Defeated")) as Konva.Text;
    const button = buttonWithLabel("Back to menu");

    expect(stats.y() + stats.height()).toBeLessThan(button.y());
    expect(button.y() + BUTTON_HEIGHT).toBeLessThan(CARD_HEIGHT);
  });

  it.each([
    [800, 480],
    [1456, 827],
    [1920, 1080],
  ])("fits the whole card into a %i x %i window", (width, height) => {
    screen.resize(width, height);
    const content = screen.group.findOne("Group") as Konva.Group;
    const scale = content.scaleY();

    expect(content.x()).toBeGreaterThanOrEqual(0);
    expect(content.x() + CARD_WIDTH * scale).toBeLessThanOrEqual(width);
    expect(content.y() + CARD_HEIGHT * scale).toBeLessThanOrEqual(height);
  });
});
