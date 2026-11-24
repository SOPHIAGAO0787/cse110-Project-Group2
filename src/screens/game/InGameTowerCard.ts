import Konva from "konva";
import { describeRange } from "../../model/towerConfig";
import type { TowerDef } from "../../model/types";
import {
  BUTTON_FILL,
  CARD_BORDER,
  CARD_FILL,
  COST_TEXT,
  FONT,
  MUTED_TEXT,
  TITLE_TEXT,
} from "../theme";

// The shop places the cards a fixed distance apart, so every card is this tall
const CARD_HEIGHT = 340;
// Space between the description, the stats and the instructions
const TEXT_GAP = 6;

// One tower in the game's shop: its name, picture, cost, stats and how to place it.
// The texts are stacked, so a description that wraps onto more lines pushes the rest down.
export class InGameTowerCard {
  group = new Konva.Group({ x: 16, y: 64 });

  constructor(def: TowerDef, icon: Konva.Shape) {
    const background = new Konva.Rect({
      width: 228,
      height: CARD_HEIGHT,
      fill: CARD_FILL,
      stroke: CARD_BORDER,
      strokeWidth: 2,
      cornerRadius: 10,
    });

    const title = new Konva.Text({
      x: 12,
      y: 12,
      width: 204,
      text: def.name,
      fontSize: 20,
      fontFamily: FONT,
      fontStyle: "bold",
      fill: TITLE_TEXT,
      align: "center",
      listening: false,
    });

    // Reuse the existing placement icon.
    icon.position({ x: 114, y: 66 });

    const cost = new Konva.Text({
      x: 12,
      y: 96,
      width: 204,
      text: `${def.cost} coins`,
      fontSize: 20,
      fontFamily: FONT,
      fontStyle: "bold",
      fill: COST_TEXT,
      align: "center",
      listening: false,
    });

    const description = new Konva.Text({
      x: 16,
      y: 126,
      width: 196,
      text: def.description,
      fontSize: 15,
      fontFamily: FONT,
      fill: MUTED_TEXT,
      lineHeight: 1.3,
      listening: false,
    });

    const abilities = new Konva.Text({
      x: 16,
      y: description.y() + description.height() + TEXT_GAP,
      width: 196,
      text: [
        `Damage: ${def.damage}`,
        `Attack speed: ${def.fireRatePerSec} shots/sec`,
        `Range: ${describeRange(def)}`,
      ].join("\n"),
      fontSize: 15,
      fontFamily: FONT,
      fill: TITLE_TEXT,
      lineHeight: 1.4,
      listening: false,
    });

    // The ✓ and ✕ are the green and red squares that show up next to a dropped tower
    let placeText = "Drag onto a tile that turns green.";
    if (def.range.kind !== "circle") {
      placeText = "Drag onto a tile that turns green, then aim with the mouse.";
    }
    const instructions = new Konva.Text({
      x: 16,
      y: abilities.y() + abilities.height() + TEXT_GAP,
      width: 196,
      text: placeText + "\n✓ or Enter: answer the question.\n✕ or Escape: cancel.",
      fontSize: 13,
      fontFamily: FONT,
      fill: MUTED_TEXT,
      lineHeight: 1.3,
      listening: false,
    });

    this.group.add(background, title, icon, cost, description, abilities, instructions);

    this.group.on("mouseenter", () => {
      background.stroke(BUTTON_FILL);
    });

    this.group.on("mouseleave", () => {
      background.stroke(CARD_BORDER);
    });
  }
}
