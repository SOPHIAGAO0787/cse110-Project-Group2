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

export class InGameTowerCard {
  group = new Konva.Group({ x: 16, y: 64 });

  constructor(def: TowerDef, icon: Konva.Shape) {
    const background = new Konva.Rect({
      width: 228,
      height: 340,
      fill: CARD_FILL,
      stroke: CARD_BORDER,
      strokeWidth: 2,
      cornerRadius: 10,
    });

    const title = new Konva.Text({
      x: 12,
      y: 16,
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
    icon.position({ x: 114, y: 76 });

    const cost = new Konva.Text({
      x: 12,
      y: 115,
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
      y: 155,
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
      y: 215,
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

    const instructions = new Konva.Text({
      x: 16,
      y: 292,
      width: 196,
      text:
        def.range.kind === "circle"
          ? "Drag onto a tile that turns green.\nPress Enter to answer the question."
          : "Drag onto a tile that turns green, then aim with the mouse.\nPress Enter to answer the question.",
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
