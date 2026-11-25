// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TowerShopScreen } from "./TowerShopScreen";
import { TowerProgress } from "../../model/TowerProgress";
import { Sound } from "../../core/Sound";

let screen: TowerShopScreen;
let sound: Sound;
let progress: TowerProgress;
const switchTo = vi.fn();

function click(label: string): void {
  const text = screen.group.find<Konva.Text>("Text").find((node) => node.text() === label)!;
  text.getParent()!.fire("click");
}

function panel(): Konva.Group {
  return screen.group
    .find<Konva.Text>("Text")
    .find((node) => node.text() === "Settings")!
    .getParent()!
    .getParent() as Konva.Group;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  sound = new Sound();
  progress = new TowerProgress();
  screen = new TowerShopScreen({ switchTo }, progress, () => {}, sound);
  screen.resize(1200, 800);
  screen.show();
});
afterEach(() => {
  screen.hide();
  screen.group.destroy();
  vi.restoreAllMocks();
});

describe("Tower Shop settings", () => {
  it("opens from the top-right gear and closes outside without changing purchases", () => {
    expect(panel().visible()).toBe(false);
    expect(screen.group.findOne(".settings")!.position()).toEqual({ x: 1128, y: 30 });
    screen.group.findOne(".settings")!.fire("click");
    expect(panel().visible()).toBe(true);
    panel().getChildren()[0].fire("click");
    expect(panel().visible()).toBe(false);
    expect(progress.shopCoins).toBe(200);
    expect(progress.getMaxLevel("circle")).toBe(0);
    expect(switchTo).not.toHaveBeenCalled();
  });

  it("uses the shared audio preferences and refreshes labels on reopening", () => {
    sound.toggleMusic();
    screen.group.findOne(".settings")!.fire("click");
    click("Music: Off");
    expect(sound.musicOn).toBe(true);
    panel().getChildren()[0].fire("click");
    screen.group.findOne(".settings")!.fire("click");
    expect(
      panel()
        .find<Konva.Text>("Text")
        .map((node) => node.text()),
    ).toContain("Music: On");
  });

  it("offers only music and a return to the main menu", () => {
    screen.group.findOne(".settings")!.fire("click");
    const labels = panel()
      .find<Konva.Text>("Text")
      .map((node) => node.text());
    expect(labels).toEqual(["Settings", "Music: On", "Back to main menu"]);
    click("Back to main menu");
    expect(switchTo).toHaveBeenCalledExactlyOnceWith("menu");
  });

  it("closes settings when leaving and keeps the panel centered after resize", () => {
    screen.group.findOne(".settings")!.fire("click");
    screen.resize(800, 600);
    const box = panel().getChildren()[1];
    expect(box.position()).toEqual({ x: (800 - 280) / 2, y: (600 - 232) / 2 });
    screen.hide();
    screen.show();
    expect(panel().visible()).toBe(false);
  });
});
