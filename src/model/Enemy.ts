import type { Path } from "./Path";
import type { EnemyDef, Vec } from "./types";

// One enemy walking the path.
// TODO(R1): update() moves it speed * dt tiles further along the path.
// TODO(R2): takeDamage() lowers hp; isDead() when hp <= 0; reachedEnd() at the end of the path.
export class Enemy {
  id: number;
  def: EnemyDef;
  distance = 0; // tiles travelled along the path
  pos: Vec;
  hp: number;
  private path: Path;

  constructor(id: number, def: EnemyDef, path: Path) {
    this.id = id;
    this.def = def;
    this.path = path;
    this.pos = path.pointAt(0);
    this.hp = def.hp;
  }

  update(dt: number): void {
    // TODO(R1)
  }

  takeDamage(amount: number): void {
    // TODO(R2)
  }

  isDead(): boolean {
    return false; // TODO(R2)
  }

  reachedEnd(): boolean {
    return false; // TODO(R2)
  }
}
