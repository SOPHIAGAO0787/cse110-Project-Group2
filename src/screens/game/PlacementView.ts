import Konva from "konva";
import { TILE } from "./GameScreenView";
import { CIRCLE_TOWER_COLOR, SQUARE_TOWER_COLOR, TRIANGLE_TOWER_COLOR } from "../theme";
import { tileToPixel } from "./coords";
import { rectZone } from "../../model/geometry/rect";
import { sectorRadius } from "../../model/geometry/sector";
import { fireRateFor } from "../../model/towerConfig";
import type { TowerConfig, TowerDef, Vec } from "../../model/types";

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

// The confirm and cancel squares sit at the dropped tower's corner, with the key for each below.
const BUTTON = TILE * 0.5;
const BUTTON_GAP = 4;
const HINT_SIZE = TILE * 0.22;
const HINT_GAP = 2;
const PROMPT_WIDTH = BUTTON * 2 + BUTTON_GAP;
const PROMPT_HEIGHT = BUTTON + HINT_GAP + HINT_SIZE;

// Outline widths of the cone and block: heavier once the player has locked the aim
const OUTLINE = 2;
const LOCKED_OUTLINE = 4;

// The text above the square tower's block: its size and how fast it fires.
const LABEL_SIZE = TILE * 0.2;
const LABEL_GAP = 4;

// A square with a white mark on it. Pressing it calls `onPress`.
function makeButton(x: number, fill: string, marks: number[][], onPress: () => void): Konva.Group {
  const button = new Konva.Group({ x, y: 0 });
  button.add(new Konva.Rect({ width: BUTTON, height: BUTTON, fill, cornerRadius: 3 }));
  for (const points of marks) {
    button.add(
      new Konva.Line({
        points: points.map((p) => p * BUTTON),
        stroke: "white",
        strokeWidth: 2.5,
        lineCap: "round",
        lineJoin: "round",
        listening: false,
      }),
    );
  }
  button.on("pointerdown", (event) => {
    event.cancelBubble = true; // the map underneath is not pressed as well
    onPress();
  });
  button.on("pointerenter", () => {
    const container = button.getStage()?.container();
    if (container) container.style.cursor = "pointer";
  });
  button.on("pointerleave", () => {
    const container = button.getStage()?.container();
    if (container) container.style.cursor = "";
  });
  return button;
}

// A key's name under its square. Each takes half the width of the pair, so the pair stays one box.
function makeHint(index: number, text: string): Konva.Text {
  return new Konva.Text({
    x: (index * PROMPT_WIDTH) / 2,
    y: BUTTON + HINT_GAP,
    width: PROMPT_WIDTH / 2,
    align: "center",
    text,
    fontSize: HINT_SIZE,
    fill: "white",
    stroke: "#1b2a33",
    strokeWidth: 2,
    fillAfterStrokeEnabled: true,
    listening: false,
  });
}

// The picture on a tower's shop card.
function makeMenuIcon(def: TowerDef): Konva.Shape {
  switch (def.range.kind) {
    case "sector":
      return new Konva.RegularPolygon({
        x: 130,
        y: 120,
        sides: 3,
        radius: 28,
        fill: TRIANGLE_TOWER_COLOR,
      });
    case "rect":
      return new Konva.Rect({
        x: 130,
        y: 120,
        width: 44,
        height: 44,
        offsetX: 22,
        offsetY: 22,
        cornerRadius: 4,
        fill: SQUARE_TOWER_COLOR,
      });
    case "circle":
      return new Konva.Circle({ x: 130, y: 120, radius: 24, fill: CIRCLE_TOWER_COLOR });
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
  // the picture on the tower's shop card; goes in shopGroup (unscaled)
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
  // "3x2  Fire Rate: 0.7/s", above the block
  private label = new Konva.Text({
    fontSize: LABEL_SIZE,
    fontStyle: "bold",
    fill: "#fff1d6",
    stroke: "#3a2610",
    strokeWidth: 3,
    fillAfterStrokeEnabled: true,
    visible: false,
    listening: false,
  });
  private def: TowerDef;
  private bounds?: { cols: number; rows: number };
  private locked = false;

  // The green confirm and red cancel squares at the dropped tower. They take the mouse, so this
  // is a separate group from `group`; goes in mapGroup next to it.
  prompt = new Konva.Group({ visible: false });
  // What pressing the squares does. The controller sets these.
  onConfirm: () => void = () => {};
  onCancel: () => void = () => {};

  // `bounds` is the map's size in tiles, so the squares move to the other side of a tower that
  // is at the right or bottom edge instead of running off the map.
  constructor(def: TowerDef, bounds?: { cols: number; rows: number }) {
    this.def = def;
    this.bounds = bounds;
    this.menuIcon = makeMenuIcon(def);
    this.ghost = makeGhost(def);
    if (def.range.kind === "circle") this.range.radius(def.range.radius * TILE);
    this.group.add(this.range, this.wedge, this.block, this.label, this.ghost);

    const confirmX = 0;
    const cancelX = BUTTON + BUTTON_GAP;
    this.prompt.add(
      makeButton(
        confirmX,
        "#2fbf4f",
        [[0.22, 0.52, 0.42, 0.72, 0.78, 0.3]], // a tick
        () => this.onConfirm(),
      ),
      makeButton(
        cancelX,
        "#e0364d",
        [
          [0.3, 0.3, 0.7, 0.7],
          [0.7, 0.3, 0.3, 0.7],
        ], // a cross
        () => this.onCancel(),
      ),
      makeHint(0, "Enter"),
      makeHint(1, "Esc"),
    );
  }

  // Shows the confirm and cancel squares at the corner of the dropped tower.
  showPrompt(tile: Vec): void {
    let left = tile.x * TILE; // just right of the tile, below its bottom edge
    let top = (tile.y + 1) * TILE;
    if (this.bounds) {
      if (left + PROMPT_WIDTH > this.bounds.cols * TILE) left = tile.x * TILE - PROMPT_WIDTH;
      if (top + PROMPT_HEIGHT > this.bounds.rows * TILE) top = tile.y * TILE - PROMPT_HEIGHT;
    }
    this.prompt.position({ x: left, y: top }).visible(true);
  }

  // Draws the cone or block with a heavier outline while the player has locked its aim.
  setLocked(locked: boolean): void {
    this.locked = locked;
    this.wedge.strokeWidth(this.outlineWidth());
    this.block
      .getChildren()
      .forEach((cell) => (cell as Konva.Rect).strokeWidth(this.outlineWidth()));
  }

  private outlineWidth(): number {
    return this.locked ? LOCKED_OUTLINE : OUTLINE;
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
            strokeWidth: this.outlineWidth(),
            fill: "#e8a14a33",
            listening: false,
          }),
        );
      }
    }
    this.block.visible(true);

    // The size as drawn (columns by rows) and the fire rate this size gives
    const rate = +fireRateFor(this.def, cfg).toFixed(2);
    this.label.text(`${cols}x${rows}  Fire Rate: ${rate}/s`);
    const above = row * TILE - this.label.height() - LABEL_GAP;
    // a block against the top edge has no room above it, so the text goes underneath
    this.label
      .position({ x: col * TILE, y: above >= 0 ? above : (row + rows) * TILE + LABEL_GAP })
      .visible(true);
  }

  hide(): void {
    this.label.visible(false);
    this.prompt.visible(false);
    this.setLocked(false);
    this.ghost.visible(false);
    this.range.visible(false);
    this.wedge.visible(false);
    this.block.visible(false);
  }
}
