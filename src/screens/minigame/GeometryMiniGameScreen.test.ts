// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeometryMiniGameResult } from "../../model/minigame/GeometryMiniGame";
import { GameLoop } from "../../core/GameLoop";
import { GeometryMiniGameScreen } from "./GeometryMiniGameScreen";

const frames = vi.hoisted(() => [] as ((dt: number) => void)[]);
vi.mock("../../core/GameLoop", () => ({
  GameLoop: class {
    constructor(tick: (dt: number) => void) {
      frames.push(tick);
    }
    start() {}
    stop() {}
  },
}));
let screen: GeometryMiniGameScreen;
let complete: ReturnType<typeof vi.fn<(result: GeometryMiniGameResult) => void>>;
let frame: (dt: number) => void;
const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key }));
// The feedback shows for 1.2 seconds before the next question
const waitForNext = () => vi.advanceTimersByTime(1200);
const texts = () => screen.group.find<Konva.Text>("Text").map((text) => text.text());
function click(label: string) {
  const text = screen.group.find<Konva.Text>("Text").find((text) => text.text() === label)!;
  expect(text.getParent()!.visible()).toBe(true);
  text.getParent()!.fire("click");
}

beforeEach(() => {
  vi.useFakeTimers();
  frames.length = 0;
  vi.spyOn(Math, "random").mockReturnValue(0);
  complete = vi.fn();
  screen = new GeometryMiniGameScreen(complete);
  screen.resize(1000, 700);
  screen.show();
  frame = frames[0];
});
afterEach(() => {
  screen.hide();
  screen.group.destroy();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("GeometryMiniGameScreen", () => {
  it("shows the question, input, score, and decreasing timer without creating nodes", () => {
    const count = screen.group.find("Text").length;
    expect(texts()).toContain("Question 1/5   ·   Time: 25s   ·   Correct: 0");
    frame(3);
    expect(texts()).toContain("Question 1/5   ·   Time: 22s   ·   Correct: 0");
    press("9");
    press("Backspace");
    for (const key of "4*pi") press(key);
    expect(texts()).toContain("4*pi|");
    click("Submit");
    expect(texts()).toContain("Correct!");
    frame(100);
    expect(texts()).toContain("Question 1/5   ·   Time: 22s   ·   Correct: 1");
    vi.advanceTimersByTime(1199);
    expect(texts()).toContain("Correct!");
    vi.advanceTimersByTime(1);
    expect(texts()).toContain("Question 2/5   ·   Time: 25s   ·   Correct: 1");
    expect(screen.group.find("Text")).toHaveLength(count);
  });

  it("allows one incorrect submission, shows timeout feedback, and moves on after both", () => {
    press("0");
    press("Enter");
    expect(texts().some((text) => text.startsWith("Incorrect."))).toBe(true);
    press("Enter"); // Enter does not skip the feedback
    expect(texts().some((text) => text.startsWith("Incorrect."))).toBe(true);
    waitForNext();
    frame(25);
    expect(texts().some((text) => text.startsWith("Time's up!"))).toBe(true);
    press("2");
    expect(texts()).toContain("Question 2/5   ·   Time: 0s   ·   Correct: 0");
    waitForNext();
    expect(texts()).toContain("Question 3/5   ·   Time: 25s   ·   Correct: 0");
  });

  it("shows final results, calls completion once, and supports restart", () => {
    const stop = vi.spyOn(GameLoop.prototype, "stop");
    for (const answer of ["4*pi", "2", "4", "8", "2"]) {
      for (const key of answer) press(key);
      press("Enter");
      waitForNext();
    }
    expect(texts()).toContain("Round complete");
    expect(texts()).toContain("You answered 5 of 5 correctly.");
    expect(complete).toHaveBeenCalledExactlyOnceWith({ correctAnswers: 5, totalQuestions: 5 });
    expect(stop).toHaveBeenCalledTimes(1);
    press("Enter");
    frame(100);
    expect(complete).toHaveBeenCalledTimes(1);
    click("Restart");
    expect(texts()).toContain("Question 1/5   ·   Time: 25s   ·   Correct: 0");
    for (let i = 0; i < 5; i++) {
      frame(25);
      waitForNext();
    }
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenLastCalledWith({ correctAnswers: 0, totalQuestions: 5 });
  });

  it("stops timers and removes keyboard listeners when hidden, resetting on re-entry", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const stop = vi.spyOn(GameLoop.prototype, "stop");
    press("4");
    frame(5);
    const before = texts();
    screen.hide();
    expect(screen.group.visible()).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
    press("9");
    frame(25);
    vi.advanceTimersByTime(5000);
    expect(texts()).toEqual(before);
    screen.show();
    screen.show();
    press("2");
    expect(texts()).toContain("2|");
    expect(texts()).toContain("Question 1/5   ·   Time: 25s   ·   Correct: 0");
    expect(frames).toHaveLength(1);
  });

  it("types π and √ with the symbol buttons and hides them during the feedback", () => {
    click("√");
    press("Backspace");
    press("4");
    click("π");
    expect(texts()).toContain("4π|");
    press("Enter");
    expect(texts()).toContain("Correct!");
    const pi = screen.group.find<Konva.Text>("Text").find((text) => text.text() === "π")!;
    expect(pi.getParent()!.visible()).toBe(false);
    waitForNext();
    click("√");
    press("4");
    expect(texts()).toContain("√4|");
  });

  it("does not move on by itself after the screen is closed during the feedback", () => {
    press("0");
    press("Enter");
    const before = texts();
    screen.hide();
    waitForNext();
    expect(texts()).toEqual(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs the back callback when the back arrow is clicked", () => {
    const back = vi.fn();
    const withBack = new GeometryMiniGameScreen(complete, back);
    withBack.group.findOne(".back")!.fire("click");
    expect(back).toHaveBeenCalledTimes(1);
    withBack.group.destroy();
  });

  it("keeps the panel within small and large viewports", () => {
    for (const [width, height] of [
      [400, 400],
      [1200, 800],
    ]) {
      screen.resize(width, height);
      const panel = screen.group.getChildren()[1];
      expect(panel.x()).toBeGreaterThanOrEqual(0);
      expect(panel.y()).toBeGreaterThanOrEqual(0);
      expect(panel.x() + 520 * panel.scaleX()).toBeLessThanOrEqual(width);
      expect(panel.y() + 470 * panel.scaleY()).toBeLessThanOrEqual(height);
    }
  });
});
