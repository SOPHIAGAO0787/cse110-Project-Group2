import Konva from "konva";
import type { Enemy } from "../../model/Enemy";
import { TILE } from "./GameScreenView";

// Draws enemies and syncs their positions with the model
//Movement logic is handled by src/model/Enemy.ts

export class EnemiesView {
  group = new Konva.Group();

  // Maps each enemy's unique ID to its Konva shape.
  private shapes = new Map<number, Konva.Circle>();

  sync(enemies: Enemy[]): void {
    const activeIds = new Set<number>();

    for (const enemy of enemies) {
      activeIds.add(enemy.id);

      let circle = this.shapes.get(enemy.id);

      // Create a visual representation for new enemies.
      if (!circle) {
        circle = new Konva.Circle({
          radius: TILE * 0.3,
          fill: enemy.def.color,
          stroke: "#ffffff",
          strokeWidth: 2,
          listening: false,
        });

        this.shapes.set(enemy.id, circle);
        this.group.add(circle);
      }

      // Model positions are tile coordinates.
      // Convert them to the center of the corresponding tile.
      circle.position({
        x: (enemy.pos.x + 0.5) * TILE,
        y: (enemy.pos.y + 0.5) * TILE,
      });
    }

    // Remove shapes when enemies disappear from the model.
    for (const [id, circle] of this.shapes) {
      if (!activeIds.has(id)) {
        circle.destroy();
        this.shapes.delete(id);
      }
    }
  }
}
