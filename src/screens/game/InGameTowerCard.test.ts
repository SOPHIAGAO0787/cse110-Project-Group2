// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TowerDef } from "../../model/types";
import { InGameTowerCard } from "./InGameTowerCard";
import { BUTTON_FILL, CARD_BORDER } from "../theme";
import { TOWERS } from "../../model/loadContent";

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
    expect(displayedText()).toContain("Drag onto a tile that turns green.");
    expect(displayedText()).toContain("Enter: answer the question.");
  });

  it("names the confirm and cancel squares next to their keys", () => {
    expect(displayedText()).toContain("✓ or Enter");
    expect(displayedText()).toContain("✕ or Escape: cancel.");
  });

  it("fits every line of text inside the card for every tower", () => {
    for (const def of TOWERS) {
      const towerCard = new InGameTowerCard(def, new Konva.Circle({ radius: 24 }));
      const background = towerCard.group.findOne<Konva.Rect>("Rect");
      if (background === undefined) {
        throw new Error("the card has no background");
      }
      for (const text of towerCard.group.find<Konva.Text>("Text")) {
        expect(text.y() + text.height()).toBeLessThanOrEqual(background.height());
      }
      towerCard.group.destroy();
    }
  });

  it("starts each block of text below the one above it", () => {
    const texts = card.group.find<Konva.Text>("Text");
    for (let i = 1; i < texts.length; i++) {
      expect(texts[i].y()).toBeGreaterThanOrEqual(texts[i - 1].y() + texts[i - 1].height());
    }
  });

  it("tells the player to aim for towers that are aimed", () => {
    const aimed: TowerDef[] = [
      { ...tower, id: "triangle", range: { kind: "sector", area: 7.5 } },
      { ...tower, id: "rectangle", range: { kind: "rect", maxArea: 6, rateArea: 6 } },
    ];
    for (const def of aimed) {
      const aimedCard = new InGameTowerCard(def, new Konva.Circle({ radius: 24 }));
      const text = aimedCard.group
        .find<Konva.Text>("Text")
        .map((t) => t.text())
        .join("\n");
      expect(text).toContain("then aim with the mouse");
      aimedCard.group.destroy();
    }
    expect(displayedText()).not.toContain("aim");
  });

  it("keeps the existing placement icon inside the card", () => {
    expect(icon.getParent()).toBe(card.group);
  });

  it("highlights the border on hover and restores it afterward", () => {
    const background = card.group.findOne<Konva.Rect>("Rect")!;

    card.group.fire("mouseenter");
    expect(background.stroke()).toBe(BUTTON_FILL);

    card.group.fire("mouseleave");
    expect(background.stroke()).toBe(CARD_BORDER);
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
