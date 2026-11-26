// @vitest-environment jsdom
import type { ScreenSwitcher } from "../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Sound } from "../core/Sound";
import { MAPS } from "../model/loadContent";
import { COINS_PER_CORRECT_ANSWER, Progress } from "../model/Progress";
import { MenuScreen } from "./MenuScreen";

let switchTo: Mock<ScreenSwitcher["switchTo"]>;
let progress: Progress;
let sound: Sound;
let screen: MenuScreen;
let onReset: Mock<() => void>;

// The bonus line, or null if it is hidden
function bonusLine(): string | null {
  for (const node of screen.group.find<Konva.Text>("Text")) {
    if (node.text().startsWith("Mini-game bonus") && node.isVisible()) {
      return node.text();
    }
  }
  return null;
}

// True if some text on the screen reads `label`
function hasText(label: string): boolean {
  for (const node of screen.group.find<Konva.Text>("Text")) {
    if (node.text() === label) {
      return true;
    }
  }
  return false;
}

// Clicks the button whose label is `label`
function clickButton(label: string): void {
  for (const node of screen.group.find<Konva.Text>("Text")) {
    if (node.text() === label) {
      const button = node.getParent() as Konva.Group;
      button.fire("click");
      return;
    }
  }
  throw new Error(`No "${label}" button`);
}

beforeEach(() => {
  switchTo = vi.fn<ScreenSwitcher["switchTo"]>();
  progress = new Progress(MAPS);
  // jsdom has no real audio
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  sound = new Sound();
  onReset = vi.fn<() => void>();
  screen = new MenuScreen({ switchTo }, progress, sound, onReset);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MenuScreen buttons", () => {
  it("opens the map selection with Play", () => {
    clickButton("Play");
    expect(switchTo).toHaveBeenCalledWith("maps");
  });

  it("opens the tower shop with Tower Shop", () => {
    clickButton("Tower Shop");
    expect(switchTo).toHaveBeenCalledWith("shop");
  });

  it("opens the mini-game with Mini-game", () => {
    clickButton("Mini-game");
    expect(switchTo).toHaveBeenCalledWith("minigame");
  });
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

describe("MenuScreen music switch", () => {
  it("shows the music as on at first", () => {
    expect(hasText("Music: On")).toBe(true);
  });

  it("switches the music off and on again", () => {
    clickButton("Music: On");
    expect(sound.musicOn).toBe(false);
    expect(hasText("Music: Off")).toBe(true);

    clickButton("Music: Off");
    expect(sound.musicOn).toBe(true);
    expect(hasText("Music: On")).toBe(true);
  });

  it("shows a change made in a game's settings when the menu opens again", () => {
    screen.hide();
    sound.toggleMusic();
    screen.show();
    expect(hasText("Music: Off")).toBe(true);
  });
});

describe("MenuScreen Reset progress", () => {
  // True if the "Reset all progress?" panel is showing
  function confirmShowing(): boolean {
    for (const node of screen.group.find<Konva.Text>("Text")) {
      if (node.text() === "Reset all progress?") {
        return node.isVisible();
      }
    }
    return false;
  }

  it("asks first instead of resetting right away", () => {
    clickButton("Reset progress");
    expect(confirmShowing()).toBe(true);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("resets and closes the panel with Reset", () => {
    clickButton("Reset progress");
    clickButton("Reset");
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(confirmShowing()).toBe(false);
  });

  it("closes the panel without resetting on Cancel", () => {
    clickButton("Reset progress");
    clickButton("Cancel");
    expect(onReset).not.toHaveBeenCalled();
    expect(confirmShowing()).toBe(false);
  });

  it("hides the bonus line once the reset clears the bonus coins", () => {
    progress.addMiniGameReward(2);
    screen.show();
    onReset.mockImplementation(() => progress.reset());
    clickButton("Reset progress");
    clickButton("Reset");
    expect(bonusLine()).toBeNull();
  });

  it("closes the panel when the player leaves the menu", () => {
    clickButton("Reset progress");
    screen.hide();
    screen.show();
    expect(confirmShowing()).toBe(false);
  });
});
