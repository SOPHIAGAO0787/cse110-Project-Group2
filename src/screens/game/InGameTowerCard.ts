import Konva from "konva";
import { describeRange } from "../../model/towerConfig";
import type { TowerDef } from "../../model/types";

export class InGameTowerCard {
  group = new Konva.Group({ x: 16, y: 64 });

  constructor(def: TowerDef, icon: Konva.Shape) {
    const background = new Konva.Rect({
      width: 228,
      height: 340,
      fill: "#303044",
      stroke: "#52526b",
      cornerRadius: 10,
    });

    const title = new Konva.Text({
      x: 12,
      y: 16,
      width: 204,
      text: def.name,
      fontSize: 20,
      fill: "white",
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
      fill: "#a6e3a1",
      align: "center",
      listening: false,
    });

    const description = new Konva.Text({
      x: 16,
      y: 155,
      width: 196,
      text: def.description,
      fontSize: 15,
      fill: "#d0d0df",
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
      fill: "white",
      lineHeight: 1.4,
      listening: false,
    });

    const instructions = new Konva.Text({
      x: 16,
      y: 292,
      width: 196,
      text:
        def.range.kind === "sector"
          ? "Drag onto a green tile, then aim with the mouse.\nPress Enter to answer the question."
          : "Drag onto a green tile.\nPress Enter to answer the question.",
      fontSize: 13,
      fill: "#b4b4c8",
      lineHeight: 1.3,
      listening: false,
    });

    this.group.add(background, title, icon, cost, description, abilities, instructions);

    this.group.on("mouseenter", () => {
      background.stroke("#a6e3a1");
    });

    this.group.on("mouseleave", () => {
      background.stroke("#52526b");
    });
  }
}
