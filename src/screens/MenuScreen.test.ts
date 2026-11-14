// @vitest-environment jsdom
import type { ScreenSwitcher } from "../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAPS } from "../model/loadContent";
import { COINS_PER_CORRECT_ANSWER, Progress } from "../model/Progress";
import { MenuScreen } from "./MenuScreen";

let progress: Progress;
let screen: MenuScreen;

// The bonus line, or null if it is hidden
function bonusLine(): string | null {
  for (const node of screen.group.find<Konva.Text>("Text")) {
    if (node.text().startsWith("Mini-game bonus") && node.isVisible()) {
      return node.text();
    }
  }
  return null;
}

beforeEach(() => {
  const switchTo = vi.fn<ScreenSwitcher["switchTo"]>();
  progress = new Progress(MAPS);
  screen = new MenuScreen({ switchTo }, progress);
});

describe("MenuScreen bonus coins", () => {
  it("shows no bonus line before any mini-game", () => {
    screen.show();
    expect(bonusLine()).toBeNull();
  });

  it("shows the bonus earned in the mini-game", () => {
    progress.addMiniGameReward(2);
    screen.show();
    expect(bonusLine()).toBe(
      `Mini-game bonus: +${2 * COINS_PER_CORRECT_ANSWER} coins in your next game`,
    );
  });

  it("hides the line again once a game uses the bonus", () => {
    progress.addMiniGameReward(2);
    screen.show();
    progress.useBonusCoins();
    screen.hide();
    screen.show();
    expect(bonusLine()).toBeNull();
  });
});
