import Konva from "konva";
import { TILE } from "./GameScreenView";
import { tileToPixel } from "./coords";
import type { Tower } from "../../model/Tower";
import type { TowerDef } from "../../model/types";

// What every tower visual must do. One class per tower kind implements this.
interface TowerSprite {
  group: Konva.Group; // the tower's visual, positioned at its tile
  fire(): void; // the animation when it shoots
}

class CircleSprite implements TowerSprite {
  group = new Konva.Group({ listening: false });
  private body = new Konva.Circle({ radius: TILE / 2, fill: "#2a5d99" });
  private shakeAnim: Konva.Animation | null = null;
  private startShake(): void {
    this.shakeAnim?.stop();
    this.shakeAnim = new Konva.Animation((frame) => {
      const t = frame.time / 300; // 0 to 1 over 300 ms
      if (t >= 1) {
        this.body.x(0); // always finish centered
        this.body.y(0);
        this.shakeAnim?.stop();
        return;
      }
      this.body.x(3 * (1 - t) * Math.sin(t * Math.PI * 6)); // wobbles x
      this.body.y(2 * (1 - t) * Math.sin(t * Math.PI * 3)); // wobbles y
    }, this.body.getLayer());
    this.shakeAnim.start();
  }

  constructor(private def: TowerDef) {
    this.group.add(this.body);
  }

  fire(): void {
    // expanding ring (unchanged)
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
      radius: this.def.range.radius * TILE,
      opacity: 0,
      easing: Konva.Easings.EaseOut,
      onFinish: () => ring.destroy(),
    }).play();
    new Konva.Tween({
      //Tower bounce
      node: this.body,
      duration: 0.06,
      scaleX: 0.85,
      scaleY: 0.85,
      onFinish: () => {
        new Konva.Tween({ node: this.body, duration: 0.1, scaleX: 1, scaleY: 1 }).play();
      },
    }).play();
    this.startShake();
  }
}

// One place that picks a visual for a tower definition.
function makeSprite(def: TowerDef): TowerSprite {
  // TODO: add a case per tower kind (triangle, square) as they are implemented
  return new CircleSprite(def);
}

// Draws every placed tower and plays its animation when it fires.
export class TowersView {
  group = new Konva.Group({ listening: false }); // so GridView's hover still gets the mouse
  private sprites = new Map<number, TowerSprite>();

  add(tower: Tower): void {
    const sprite = makeSprite(tower.def);
    sprite.group.position(tileToPixel(tower.tile, TILE));
    this.group.add(sprite.group);
    this.sprites.set(tower.id, sprite);
  }

  fire(towerId: number): void {
    this.sprites.get(towerId)?.fire();
  }
}
