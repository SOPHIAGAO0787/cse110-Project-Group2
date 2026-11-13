// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TowerDef } from "../../model/types";
import { InGameTowerCard } from "./InGameTowerCard";

const tower: TowerDef = {
  id: "circle",
  name: "Circle Tower",
  description: "Hits enemies inside a circle around it.",
  cost: 50,
  damage: 5,
  fireRatePerSec: 1,
  attack: "all",
  range: { kind: "circle", radius: 2.5 },
};

let card: InGameTowerCard;
let icon: Konva.Circle;

function displayedText(): string {
  return card.group
    .find<Konva.Text>("Text")
    .map((text) => text.text())
    .join("\n");
}

beforeEach(() => {
  icon = new Konva.Circle({ radius: 24 });
  card = new InGameTowerCard(tower, icon);
});

afterEach(() => {
  card.group.destroy();
});

describe("InGameTowerCard", () => {
  it("shows the tower's name, cost, and description", () => {
    expect(displayedText()).toContain("Circle Tower");
    expect(displayedText()).toContain("50 coins");
    expect(displayedText()).toContain(tower.description);
  });

  it("shows damage, attack speed, and range", () => {
    expect(displayedText()).toContain("Damage: 5");
    expect(displayedText()).toContain("Attack speed: 1 shots/sec");
    expect(displayedText()).toContain("Range: 2.5 tiles");
  });

  it("shows instructions for placing the tower", () => {
    expect(displayedText()).toContain("Drag onto a green tile.");
    expect(displayedText()).toContain("Press Enter to answer the question.");
  });

  it("keeps the existing placement icon inside the card", () => {
    expect(icon.getParent()).toBe(card.group);
  });

  it("highlights the border on hover and restores it afterward", () => {
    const background = card.group.findOne<Konva.Rect>("Rect")!;

    card.group.fire("mouseenter");
    expect(background.stroke()).toBe("#a6e3a1");

    card.group.fire("mouseleave");
    expect(background.stroke()).toBe("#52526b");
  });

  it("allows pointer events on the icon to reach the card", () => {
    let selected = false;
    card.group.on("pointerdown", () => {
      selected = true;
    });

    icon.fire("pointerdown", {}, true);

    expect(selected).toBe(true);
  });
});
