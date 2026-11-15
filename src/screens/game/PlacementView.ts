import Konva from "konva";
import { TILE } from "./GameScreenView";
import { tileToPixel } from "./coords";
import { rectZone } from "../../model/geometry/rect";
import { sectorRadius } from "../../model/geometry/sector";
import type { TowerConfig, TowerDef, Vec } from "../../model/types";

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

// The picture on a tower's shop card.
function makeMenuIcon(def: TowerDef): Konva.Shape {
  switch (def.range.kind) {
    case "sector":
      return new Konva.RegularPolygon({ x: 130, y: 120, sides: 3, radius: 28, fill: "#2a8f5d" });
    case "rect":
      return new Konva.Rect({
        x: 130,
        y: 120,
        width: 44,
        height: 44,
        offsetX: 22,
        offsetY: 22,
        cornerRadius: 4,
        fill: "#b5651d",
      });
    case "circle":
      return new Konva.Circle({ x: 130, y: 120, radius: 24, fill: "#4a90d9" });
  }
}

// The shape dragged around the map, centred on its own origin. It matches the placed tower.
function makeGhost(def: TowerDef): Konva.Shape {
  const style = { opacity: 0.6, visible: false, listening: false };
  switch (def.range.kind) {
    case "sector":
      // the same dart as the placed triangle, pointing right
      return new Konva.Line({
        points: [TILE * 0.55, 0, -TILE * 0.35, TILE * 0.3, -TILE * 0.35, -TILE * 0.3],
        closed: true,
        ...style,
      });
    case "rect": {
      const size = TILE * 0.8;
      return new Konva.Rect({
        width: size,
        height: size,
        offsetX: size / 2,
        offsetY: size / 2,
        cornerRadius: 4,
        ...style,
      });
    }
    case "circle":
      return new Konva.Circle({ radius: TILE / 2, ...style });
  }
}

export class PlacementView {
  group = new Konva.Group({ listening: false }); // so GridView's hover still gets the mouse
  // temporary stand-in for a shop card icon; goes in shopGroup (unscaled)
  menuIcon: Konva.Shape;

  // the tower's own shape, see-through, blue where it can go and red where it can't
  private ghost: Konva.Shape;
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
  // the square tower's block of tiles, one outlined cell per tile
  private block = new Konva.Group({ listening: false, visible: false });
  private def: TowerDef;

  constructor(def: TowerDef) {
    this.def = def;
    this.menuIcon = makeMenuIcon(def);
    this.ghost = makeGhost(def);
    if (def.range.kind === "circle") this.range.radius(def.range.radius * TILE);
    this.group.add(this.range, this.wedge, this.block, this.ghost);
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

  // Shows what the player has chosen so far for a tower that is aimed (cone or block).
  showConfig(tile: Vec, config: TowerConfig): void {
    if (config.kind === "sector") this.showSector(tile, config);
    else if (config.kind === "rect") this.showRect(tile, config);
  }

  // Shows the square tower's block of tiles, next to the tower.
  showRect(tile: Vec, cfg: Extract<TowerConfig, { kind: "rect" }>): void {
    if (this.def.range.kind !== "rect") return;
    this.range.visible(false);
    const { col, row, cols, rows } = rectZone(tile, cfg.facing, cfg.width, cfg.depth, cfg.side);
    this.block.destroyChildren();
    for (let c = col; c < col + cols; c++) {
      for (let r = row; r < row + rows; r++) {
        this.block.add(
          new Konva.Rect({
            x: c * TILE, // tile (c, r) covers pixels [c·TILE, (c+1)·TILE)
            y: r * TILE,
            width: TILE,
            height: TILE,
            stroke: "#e8a14a",
            fill: "#e8a14a33",
            listening: false,
          }),
        );
      }
    }
    this.block.visible(true);
  }

  hide(): void {
    this.ghost.visible(false);
    this.range.visible(false);
    this.wedge.visible(false);
    this.block.visible(false);
  }
}
