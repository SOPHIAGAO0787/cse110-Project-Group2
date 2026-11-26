import Konva from "konva";
import { TILE } from "./GameScreenView";
import { CIRCLE_TOWER_COLOR, SQUARE_TOWER_COLOR, TRIANGLE_TOWER_COLOR } from "../theme";
import { tileToPixel } from "./coords";
import type { Enemy } from "../../model/Enemy";
import type { Tower } from "../../model/Tower";
import { rectZone } from "../../model/geometry/rect";
import type { Facing, Vec } from "../../model/types";

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

// What every tower visual must do. One class per tower kind implements this.
interface TowerSprite {
  group: Konva.Group; // the tower's visual, positioned at its tile
  fire(): void; // the animation when it shoots
  rangeShape(): Konva.Shape; // the area it hits, centered on the tower, with no colors yet
  // Called every frame with where the tower's target is (null if none); dt is in seconds.
  update?(target: Vec | null, dt: number): void;
}

const FACING_DEGREES: Record<Facing, number> = { right: 0, down: 90, left: 180, up: 270 };

// The hovered tower's range uses the same colors as the range shown while placing a tower
const RANGE_STROKE = "#4a90d9";
const RANGE_FILL = "#4a90d933";

const TURN_SPEED = 10; // radians per second, how fast a triangle swings towards its target

// Wobbles a node around its resting position at (0, 0) for 300 ms, then puts it back exactly.
class Shake {
  private anim: Konva.Animation | null = null;

  constructor(
    private node: Konva.Node,
    private offset: (t: number) => Vec, // t goes from 0 to 1
  ) {}

  play(): void {
    this.anim?.stop();
    this.anim = new Konva.Animation((frame) => {
      const t = frame.time / 300;
      if (t >= 1) {
        this.node.position({ x: 0, y: 0 }); // always finish centered
        this.anim?.stop();
        return;
      }
      this.node.position(this.offset(t));
    }, this.node.getLayer());
    this.anim.start();
  }
}

// A quick squash and release.
function pop(node: Konva.Node): void {
  new Konva.Tween({
    node,
    duration: 0.06,
    scaleX: 0.85,
    scaleY: 0.85,
    onFinish: () => {
      new Konva.Tween({ node, duration: 0.1, scaleX: 1, scaleY: 1 }).play();
    },
  }).play();
}

class CircleSprite implements TowerSprite {
  group = new Konva.Group({ listening: false });
  private body = new Konva.Circle({ radius: TILE / 2, fill: CIRCLE_TOWER_COLOR });
  private shake = new Shake(this.body, (t) => ({
    x: 3 * (1 - t) * Math.sin(t * Math.PI * 6), // wobbles x
    y: 2 * (1 - t) * Math.sin(t * Math.PI * 3), // wobbles y
  }));
  private tower: Tower;

  constructor(tower: Tower) {
    this.tower = tower;
    this.group.add(this.body);
  }

  fire(): void {
    // expanding ring up to the tower's current reach (read now, so changes to the range show up)
    const ring = new Konva.Circle({
      radius: 0,
      stroke: CIRCLE_TOWER_COLOR,
      strokeWidth: 3,
      opacity: 0.8,
      listening: false,
    });
    this.group.add(ring);
    new Konva.Tween({
      node: ring,
      duration: 0.25,
      radius: this.tower.reach * TILE,
      opacity: 0,
      easing: Konva.Easings.EaseOut,
      onFinish: () => ring.destroy(),
    }).play();
    pop(this.body);
    this.shake.play();
  }

  rangeShape(): Konva.Shape {
    return new Konva.Circle({ radius: this.tower.reach * TILE, listening: false });
  }
}

class TriangleSprite implements TowerSprite {
  group = new Konva.Group({ listening: false });
  // A pointed dart that points along +x, so its rotation is simply the angle it aims at.
  // (An equilateral triangle looks the same after a 120° turn, so you couldn't tell where it aims.)
  private body = new Konva.Line({
    points: [TILE * 0.55, 0, -TILE * 0.35, TILE * 0.3, -TILE * 0.35, -TILE * 0.3],
    closed: true,
    fill: TRIANGLE_TOWER_COLOR,
  });
  private shake: Shake;
  private tower: Tower;
  private facing: number; // where the cone points (the real hit area; never changes)
  private spread: number;
  private angle: number; // where the body points right now: swings towards the target, else back to `facing`

  constructor(tower: Tower) {
    const cfg = tower.config;
    if (cfg.kind !== "sector") throw new Error("TriangleSprite needs a sector config");
    this.tower = tower;
    this.facing = cfg.facing;
    this.spread = cfg.spread;
    this.angle = cfg.facing;
    this.pointBody();
    this.group.add(this.body);

    // Kick backwards, away from where the body is pointing.
    this.shake = new Shake(this.body, (t) => {
      const k = 4 * (1 - t) * Math.sin(t * Math.PI * 6);
      return { x: -Math.cos(this.angle) * k, y: -Math.sin(this.angle) * k };
    });
  }

  // Only the body turns, so the cone flash below is not rotated twice.
  private pointBody(): void {
    this.body.rotation(toDegrees(this.angle));
  }

  update(target: Vec | null, dt: number): void {
    const wanted = target
      ? Math.atan2(target.y - this.tower.tile.y, target.x - this.tower.tile.x)
      : this.facing;
    // shortest way round, wrapped into [-π, π]
    const diff = Math.atan2(Math.sin(wanted - this.angle), Math.cos(wanted - this.angle));
    const maxStep = TURN_SPEED * dt;
    this.angle += Math.max(-maxStep, Math.min(maxStep, diff));
    this.pointBody();
  }

  // The cone. A Wedge starts at its rotation and sweeps clockwise, so it backs up half the angle.
  rangeShape(): Konva.Shape {
    return new Konva.Wedge({
      radius: this.tower.reach * TILE,
      angle: toDegrees(this.spread),
      rotation: toDegrees(this.facing) - toDegrees(this.spread) / 2,
      listening: false,
    });
  }

  fire(): void {
    const flash = this.rangeShape();
    flash.fill(TRIANGLE_TOWER_COLOR);
    flash.opacity(0.5);
    this.group.add(flash);
    new Konva.Tween({
      node: flash,
      duration: 0.2,
      opacity: 0,
      onFinish: () => flash.destroy(),
    }).play();
    pop(this.body);
    this.shake.play();
  }
}

class RectSprite implements TowerSprite {
  group = new Konva.Group({ listening: false });
  // A square with a barrel on the side it fires towards. The body's origin is the tower's centre,
  // so squashing and shaking it works like the other towers.
  private body = new Konva.Group({ listening: false });
  private tower: Tower;

  constructor(tower: Tower) {
    const cfg = tower.config;
    if (cfg.kind !== "rect") throw new Error("RectSprite needs a rect config");
    this.tower = tower;

    const size = TILE * 0.8;
    this.body.add(
      new Konva.Rect({
        x: -size / 2,
        y: -size / 2,
        width: size,
        height: size,
        cornerRadius: 4,
        fill: SQUARE_TOWER_COLOR,
      }),
      new Konva.Rect({
        x: size / 2 - 2,
        y: -TILE * 0.1,
        width: TILE * 0.2,
        height: TILE * 0.2,
        fill: "#4a6fc4",
      }),
    );
    this.body.rotation(FACING_DEGREES[cfg.facing]); // the barrel starts out pointing right
    this.group.add(this.body);
  }

  // The block this tower hits, as a rectangle relative to the tower's centre (in pixels).
  rangeShape(): Konva.Shape {
    const cfg = this.tower.config;
    if (cfg.kind !== "rect") throw new Error("RectSprite needs a rect config");
    const { col, row, cols, rows } = rectZone(
      this.tower.tile,
      cfg.facing,
      cfg.width,
      cfg.depth,
      cfg.side,
    );
    return new Konva.Rect({
      x: (col - 0.5 - this.tower.tile.x) * TILE,
      y: (row - 0.5 - this.tower.tile.y) * TILE,
      width: cols * TILE,
      height: rows * TILE,
      listening: false,
    });
  }

  fire(): void {
    const flash = this.rangeShape();
    flash.fill(SQUARE_TOWER_COLOR);
    flash.opacity(0.5);
    this.group.add(flash);
    new Konva.Tween({
      node: flash,
      duration: 0.2,
      opacity: 0,
      onFinish: () => flash.destroy(),
    }).play();
    pop(this.body);
  }
}

// One place that picks a visual for a tower.
function makeSprite(tower: Tower): TowerSprite {
  switch (tower.def.range.kind) {
    case "circle":
      return new CircleSprite(tower);
    case "sector":
      return new TriangleSprite(tower);
    case "rect":
      return new RectSprite(tower);
  }
}

// Draws every placed tower and plays its animation when it fires.
export class TowersView {
  group = new Konva.Group({ listening: false }); // so GridView's hover still gets the mouse
  private sprites = new Map<number, TowerSprite>();
  // The range of the tower under the mouse. Empty when no tower is hovered.
  // It is named "tower-range" so tests can find it.
  private range = new Konva.Group({ name: "tower-range", listening: false });

  add(tower: Tower): void {
    const sprite = makeSprite(tower);
    sprite.group.position(tileToPixel(tower.tile, TILE));
    this.group.add(sprite.group);
    this.sprites.set(tower.id, sprite);
  }

  remove(towerId: number): void {
    this.sprites.get(towerId)?.group.destroy();
    this.sprites.delete(towerId);
  }
  // Draws this tower's range: its circle, its aimed cone or its aimed block.
  // It reads the tower's range now, so after an upgrade it shows the new range.
  showRange(tower: Tower): void {
    this.range.destroyChildren();
    const sprite = this.sprites.get(tower.id);
    if (sprite === undefined) {
      return;
    }
    const shape = sprite.rangeShape();
    shape.fill(RANGE_FILL);
    shape.stroke(RANGE_STROKE);
    shape.strokeWidth(2);
    this.range.add(shape);
    this.range.position(tileToPixel(tower.tile, TILE));
    this.group.add(this.range);
    // Above every tower, including ones placed since the last hover
    this.range.moveToTop();
  }

  hideRange(): void {
    this.range.destroyChildren();
  }

  fire(towerId: number): void {
    this.sprites.get(towerId)?.fire();
  }

  // Once per frame: lets each tower swing towards its current target.
  update(towers: Tower[], enemies: Enemy[], dt: number): void {
    for (const tower of towers) {
      const target = tower.aimTarget(enemies);
      this.sprites.get(tower.id)?.update?.(target ? target.pos : null, dt);
    }
  }
}
