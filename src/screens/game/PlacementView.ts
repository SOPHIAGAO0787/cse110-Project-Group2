import Konva from "konva";
import { TILE } from "./GameScreenView";
import { tileToPixel } from "./coords";
import { sectorRadius } from "../../model/geometry/sector";
import type { TowerDef, Vec } from "../../model/types";

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export class PlacementView {
  group = new Konva.Group({ listening: false }); // so GridView's hover still gets the mouse
  // temporary stand-in for a shop card; goes in shopGroup (unscaled)
  menuCircle = new Konva.Circle({ x: 130, y: 120, radius: 24, fill: "#4a90d9" });

  private ghost = new Konva.Circle({ radius: TILE / 2, opacity: 0.6, visible: false });
  private range = new Konva.Circle({ stroke: "#4a90d9", fill: "#4a90d933", visible: false });
  // the triangle tower's cone, shown instead of the ring
  private wedge = new Konva.Wedge({
    radius: 0,
    angle: 0,
    stroke: "#4a90d9",
    fill: "#4a90d933",
    visible: false,
    listening: false,
  });
  private def: TowerDef;

  constructor(def: TowerDef) {
    this.def = def;
    if (def.range.kind === "circle") this.range.radius(def.range.radius * TILE);
    this.group.add(this.range, this.wedge, this.ghost);
  }

  show(tile: Vec, valid: boolean): void {
    const px = tileToPixel(tile, TILE); // map pixels; mapGroup scales it for you
    this.ghost
      .position(px)
      .fill(valid ? "#4a90d9" : "#d94a4a")
      .visible(true);
    // circle towers show their ring; cone towers show nothing extra until showSector is called
    this.range.position(px).visible(this.def.range.kind === "circle");
  }

  // Shows the triangle's cone: facing and spread in radians, reach from the constant area.
  showSector(tile: Vec, cfg: { facing: number; spread: number }): void {
    if (this.def.range.kind !== "sector") return;
    this.range.visible(false);
    this.wedge
      .position(tileToPixel(tile, TILE))
      .radius(sectorRadius(cfg.spread, this.def.range.area) * TILE)
      .angle(toDegrees(cfg.spread))
      // a Wedge starts at its rotation and sweeps clockwise, so back up half the angle to centre it
      .rotation(toDegrees(cfg.facing) - toDegrees(cfg.spread) / 2)
      .visible(true);
  }

  hide(): void {
    this.ghost.visible(false);
    this.range.visible(false);
    this.wedge.visible(false);
  }
}
