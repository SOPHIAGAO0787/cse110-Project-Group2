// @vitest-environment jsdom
import type { ScreenSwitcher } from "../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MAPS } from "../model/loadContent";
import { Progress } from "../model/Progress";
import { MapSelectScreen } from "./MapSelectScreen";

let switchTo: Mock<ScreenSwitcher["switchTo"]>;
let progress: Progress;
let screen: MapSelectScreen;

// The first text on the screen with exactly this text
function findText(group: Konva.Group, text: string): Konva.Text | null {
  for (const node of group.find<Konva.Text>("Text")) {
    if (node.text() === text) {
      return node;
    }
  }
  return null;
}

// The card of the map with this name: the group that holds the name text
function cardFor(mapName: string): Konva.Group {
  const name = findText(screen.group, mapName);
  if (name === null) {
    throw new Error(`No card for ${mapName}`);
  }
  return name.getParent() as Konva.Group;
}

// Clicks the button (or locked label) whose text is `label` on a map's card
function clickOnCard(mapName: string, label: string): void {
  const text = findText(cardFor(mapName), label);
  if (text === null) {
    throw new Error(`${mapName} has no "${label}"`);
  }
  const button = text.getParent() as Konva.Group;
  button.fire("click");
}

beforeEach(() => {
  switchTo = vi.fn<ScreenSwitcher["switchTo"]>();
  progress = new Progress(MAPS);
  screen = new MapSelectScreen({ switchTo }, progress);
  screen.show();
});

describe("MapSelectScreen", () => {
  it("shows a card for every map", () => {
    for (const map of MAPS) {
      expect(findText(screen.group, map.name)).not.toBeNull();
    }
  });

  it("plays an unlocked map", () => {
    clickOnCard("Circle Grove", "Play");
    expect(progress.currentMapId).toBe("map1");
    expect(switchTo).toHaveBeenCalledWith("game");
  });

  it("does nothing when a locked map is clicked", () => {
    expect(findText(cardFor("Angle Canyon"), "Play")).toBeNull();
    clickOnCard("Angle Canyon", "Locked");
    expect(progress.currentMapId).toBe("map1");
    expect(switchTo).not.toHaveBeenCalled();
  });

  it("unlocks the next map and shows the best stars after a win", () => {
    expect(findText(cardFor("Circle Grove"), "★★☆")).toBeNull();
    progress.recordResult("map1", 2);
    screen.show();

    expect(findText(cardFor("Circle Grove"), "★★☆")).not.toBeNull();
    clickOnCard("Angle Canyon", "Play");
    expect(progress.currentMapId).toBe("map2");
    expect(switchTo).toHaveBeenCalledWith("game");
  });

  it("goes back to the menu", () => {
    const back = findText(screen.group, "Back");
    if (back === null) {
      throw new Error("Back button is missing");
    }
    const button = back.getParent() as Konva.Group;
    button.fire("click");
    expect(switchTo).toHaveBeenCalledWith("menu");
  });

  it("hides", () => {
    screen.hide();
    expect(screen.group.visible()).toBe(false);
  });
});
