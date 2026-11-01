import Konva from "konva";
import { TILE } from "../screens/game/GameScreenView";
import { tileToPixel } from "./coords";
import type { Vec } from "../model/types";

export class PlacementView {
  group = new Konva.Group({ listening: false }); // so GridView's hover still gets the mouse
  // temporary stand-in for a shop card; goes in shopGroup (unscaled)
  menuCircle = new Konva.Circle({ x: 130, y: 120, radius: 24, fill: "#4a90d9" });

  private ghost = new Konva.Circle({ radius: TILE / 2, opacity: 0.6, visible: false });
  private range = new Konva.Circle({ stroke: "#4a90d9", fill: "#4a90d933", visible: false });
  private towers = new Konva.Group(); // holds the placed-tower markers

  constructor(radiusTiles: number) {
    this.range.radius(radiusTiles * TILE);
    this.group.add(this.towers, this.range, this.ghost);
  }

  addTower(tile: Vec): void {
    this.towers.add(
      new Konva.Circle({
        ...tileToPixel(tile, TILE),
        radius: TILE / 2,
        fill: "#2a5d99",
      }),
    );
  }

  show(tile: Vec, valid: boolean): void {
    const px = tileToPixel(tile, TILE); // map pixels; mapGroup scales it for you
    this.ghost
      .position(px)
      .fill(valid ? "#4a90d9" : "#d94a4a")
      .visible(true);
    this.range.position(px).visible(true);
  }

  hide(): void {
    this.ghost.visible(false);
    this.range.visible(false);
  }
}
