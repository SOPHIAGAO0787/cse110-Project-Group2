import Konva from "konva";
import { TILE } from "./GameScreenView";
import { tileToPixel } from "./coords";
import type { Tower } from "../../model/Tower";
import type { Vec } from "../../model/types";

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

// What every tower visual must do. One class per tower kind implements this.
interface TowerSprite {
  group: Konva.Group; // the tower's visual, positioned at its tile
  fire(): void; // the animation when it shoots
}

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
  private body = new Konva.Circle({ radius: TILE / 2, fill: "#2a5d99" });
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
      stroke: "#4a90d9",
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
}

class TriangleSprite implements TowerSprite {
  group = new Konva.Group({ listening: false });
  private body = new Konva.RegularPolygon({ sides: 3, radius: TILE / 2, fill: "#2a8f5d" });
  private shake: Shake;
  private tower: Tower;
  private facing: number;
  private spread: number;

  constructor(tower: Tower) {
    const cfg = tower.config;
    if (cfg.kind !== "sector") throw new Error("TriangleSprite needs a sector config");
    this.tower = tower;
    this.facing = cfg.facing;
    this.spread = cfg.spread;

    // The polygon's tip points up (-y); +90° turns it to point along `facing`.
    // Only the body turns, so the cone flash below is not rotated twice.
    this.body.rotation(toDegrees(this.facing) + 90);
    this.group.add(this.body);

    // Kick backwards, away from where it is aiming.
    const dx = -Math.cos(this.facing);
    const dy = -Math.sin(this.facing);
    this.shake = new Shake(this.body, (t) => {
      const k = 4 * (1 - t) * Math.sin(t * Math.PI * 6);
      return { x: dx * k, y: dy * k };
    });
  }

  fire(): void {
    const flash = new Konva.Wedge({
      radius: this.tower.reach * TILE,
      angle: toDegrees(this.spread),
      rotation: toDegrees(this.facing) - toDegrees(this.spread) / 2,
      fill: "#4ad98f",
      opacity: 0.5,
      listening: false,
    });
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

// One place that picks a visual for a tower.
function makeSprite(tower: Tower): TowerSprite {
  switch (tower.def.range.kind) {
    case "circle":
      return new CircleSprite(tower);
    case "sector":
      return new TriangleSprite(tower);
  }
}

// Draws every placed tower and plays its animation when it fires.
export class TowersView {
  group = new Konva.Group({ listening: false }); // so GridView's hover still gets the mouse
  private sprites = new Map<number, TowerSprite>();

  add(tower: Tower): void {
    const sprite = makeSprite(tower);
    sprite.group.position(tileToPixel(tower.tile, TILE));
    this.group.add(sprite.group);
    this.sprites.set(tower.id, sprite);
  }

  fire(towerId: number): void {
    this.sprites.get(towerId)?.fire();
  }
}
