// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameScreenView, TILE } from "./GameScreenView";
import { QuestionService } from "../../model/questions/QuestionService";
import { Sound } from "../../core/Sound";
import { GOOD_TEXT, WARNING_TEXT } from "../theme";

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
    () => {},
    () => {},
    new QuestionService(),
    new Sound(),
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
      .find((node) => node instanceof Konva.Text && node.text().startsWith("Lives:"));
    expect(view.shopGroup.findOne<Konva.Text>(".game-coins")!.text()).toBe(`Coins: ${coins}`);
    expect(hud).toBeInstanceOf(Konva.Text);
    expect((hud as Konva.Text).text()).toBe(
      `Lives: ${lives}   ·   Wave: ${wave}/${total}   ·   Enemies Remaining: ${enemies}`,
    );
  });

  it("replaces previous values, including zeros, without adding HUD nodes", () => {
    const childCount = view.group.getChildren().length;
    view.setHud(100, 20, 1, 2, 5);
    view.setHud(0, 0, 2, 2, 0);

    const texts = view.group
      .getChildren()
      .filter((node) => node instanceof Konva.Text && node.text().startsWith("Lives:"));
    expect(texts).toHaveLength(1);
    expect(view.shopGroup.find<Konva.Text>(".game-coins")).toHaveLength(1);
    expect(view.shopGroup.findOne<Konva.Text>(".game-coins")!.text()).toBe("Coins: 0");
    expect((texts[0] as Konva.Text).text()).toBe(
      "Lives: 0   ·   Wave: 2/2   ·   Enemies Remaining: 0",
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

it("puts the speed button left of the gear and shows the speed on it", () => {
  view.resize(1200, 800);
  const label = view.speedButton.findOne<Konva.Text>("Text")!;
  expect(label.text()).toBe("1x");
  expect(label.fill()).toBe("white");
  expect(view.speedButton.position()).toEqual({ x: 804, y: 4 });
  expect(view.settingsButton.position()).toEqual({ x: 884, y: 4 });

  view.setSpeed(2);
  expect(label.text()).toBe("2x");
  expect(label.fill()).toBe("#ffd53d");

  view.setSpeed(0.5);
  expect(label.text()).toBe("0.5x");
  expect(label.fill()).toBe("white");

  view.setSpeed(1);
  expect(label.text()).toBe("1x");
  expect(label.fill()).toBe("white");
});

describe("GameScreenView feedback", () => {
  function waveBanner(): Konva.Text {
    const banner = view.group
      .getChildren()
      .find((node) => node instanceof Konva.Text && node.text().startsWith("Wave "));
    if (!(banner instanceof Konva.Text)) {
      throw new Error("The wave banner is missing from the screen");
    }
    return banner;
  }

  function leakFrame(): Konva.Rect {
    const frame = view.group
      .getChildren()
      .find((node) => node instanceof Konva.Rect && node.stroke() === "#ff3b3b");
    if (!(frame instanceof Konva.Rect)) {
      throw new Error("The leak frame is missing from the screen");
    }
    return frame;
  }

  it("shows the wave number over the map when a wave starts", () => {
    view.resize(1200, 800);
    view.showWaveBanner(3);

    const banner = waveBanner();
    expect(banner.text()).toBe("Wave 3");
    expect(banner.opacity()).toBeGreaterThan(0.9); // the fade-out has just started
    expect(banner.x()).toBe(view.mapGroup.x());
    expect(banner.width()).toBeCloseTo(16 * TILE * view.mapGroup.scaleX());
  });

  it("keeps the leak frame hidden until a life is lost, then puts it around the map", () => {
    view.resize(1200, 800);
    const frame = leakFrame();
    expect(frame.opacity()).toBe(0);

    view.flashLeak();
    expect(frame.opacity()).toBeGreaterThan(0.9); // the fade-out has just started
    expect(frame.position()).toEqual(view.mapGroup.position());
    expect(frame.width()).toBeCloseTo(16 * TILE * view.mapGroup.scaleX());
    expect(frame.height()).toBeCloseTo(10 * TILE * view.mapGroup.scaleY());
  });
});

describe("GameScreenView messages", () => {
  const messageText = () =>
    view.group.getChildren().find((node): node is Konva.Text => {
      return node instanceof Konva.Text && node.fontStyle() === "bold" && node.fontSize() === 18;
    })!;

  it("shows a message in the warning color by default", () => {
    view.showMessage("Not enough coins");
    expect(messageText().text()).toBe("Not enough coins");
    expect(messageText().fill()).toBe(WARNING_TEXT);
  });

  it("shows good news in green", () => {
    view.showMessage("Wave 1 cleared: +10 coins", true);
    expect(messageText().text()).toBe("Wave 1 cleared: +10 coins");
    expect(messageText().fill()).toBe(GOOD_TEXT);
  });

  it("goes back to the warning color for the next ordinary message", () => {
    view.showMessage("Wave 1 cleared: +10 coins", true);
    view.showMessage("Not enough coins");
    expect(messageText().fill()).toBe(WARNING_TEXT);
  });
});
