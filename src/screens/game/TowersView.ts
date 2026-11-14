import Konva from "konva";
import { TILE } from "./GameScreenView";
import { tileToPixel } from "./coords";
import type { Enemy } from "../../model/Enemy";
import type { Tower } from "../../model/Tower";
import type { Vec } from "../../model/types";

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

// What every tower visual must do. One class per tower kind implements this.
interface TowerSprite {
  group: Konva.Group; // the tower's visual, positioned at its tile
  fire(): void; // the animation when it shoots
  // Called every frame with where the tower's target is (null if none); dt is in seconds.
  update?(target: Vec | null, dt: number): void;
}

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
  // A pointed dart that points along +x, so its rotation is simply the angle it aims at.
  // (An equilateral triangle looks the same after a 120° turn, so you couldn't tell where it aims.)
  private body = new Konva.Line({
    points: [TILE * 0.55, 0, -TILE * 0.35, TILE * 0.3, -TILE * 0.35, -TILE * 0.3],
    closed: true,
    fill: "#2a8f5d",
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

  // Once per frame: lets each tower swing towards its current target.
  update(towers: Tower[], enemies: Enemy[], dt: number): void {
    for (const tower of towers) {
      const target = tower.aimTarget(enemies);
      this.sprites.get(tower.id)?.update?.(target ? target.pos : null, dt);
    }
  }
}
