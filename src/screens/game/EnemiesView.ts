import Konva from "konva";
import type { Enemy } from "../../model/Enemy";
import { TILE } from "./GameScreenView";

// Draws enemies and syncs their positions with the model
// Movement logic is handled by src/model/Enemy.ts

export class EnemiesView {
  group = new Konva.Group();

  // Maps each enemy's unique ID to its Konva shape.
  private shapes = new Map<number, Konva.Shape>();
  private lastHp = new Map<number, number>();
  private flashUntil = new Map<number, number>();

  // Custom shape creation for different enemy types:
  // Basic: Circle
  // Fast: Arrowhead
  // Tank: Hexagon
  private createEnemyShape(enemy: Enemy): Konva.Shape {
    const radius = TILE * 0.3;

    const config = {
      fill: enemy.def.color,
      stroke: "#ffffff",
      strokeWidth: 2,
      listening: false,
    };

    switch (enemy.def.id) {
      case "fast":
        return new Konva.Line({
          ...config,
          points: [radius, 0, -radius, -radius * 0.8, -radius * 0.4, 0, -radius, radius * 0.8],
          closed: true,
          lineJoin: "round",
        });

      case "tank":
        return new Konva.RegularPolygon({
          ...config,
          sides: 6,
          radius,
          stroke: "#568b36",
          strokeWidth: 4,
          lineJoin: "round",
        });

      default:
        return new Konva.Circle({
          ...config,
          radius,
        });
    }
  }

  sync(enemies: Enemy[]): void {
    const activeIds = new Set<number>();

    for (const enemy of enemies) {
      activeIds.add(enemy.id);

      let shape = this.shapes.get(enemy.id);

      if (!shape) {
        shape = this.createEnemyShape(enemy);

        // Position the newly created shape at the enemy's current location.
        shape.position({
          x: (enemy.pos.x + 0.5) * TILE,
          y: (enemy.pos.y + 0.5) * TILE,
        });

        this.shapes.set(enemy.id, shape);
        this.group.add(shape);
      }

      // flash red for 120 ms when the enemy loses hp
      const prev = this.lastHp.get(enemy.id);
      if (prev !== undefined && enemy.hp < prev) {
        this.flashUntil.set(enemy.id, performance.now() + 120);
      }
      this.lastHp.set(enemy.id, enemy.hp);
      const flashing = performance.now() < (this.flashUntil.get(enemy.id) ?? 0);
      shape.fill(flashing ? "#ff3b3b" : enemy.def.color);

      // Model positions are tile coordinates.
      // Convert them to the center of the corresponding tile.
      // Convert model coordinates to pixel coordinates.
      const x = (enemy.pos.x + 0.5) * TILE;
      const y = (enemy.pos.y + 0.5) * TILE;

      // Rotate fast enemies toward their direction of movement.
      if (enemy.def.id === "fast") {
        const dx = x - shape.x();
        const dy = y - shape.y();

        if (dx !== 0 || dy !== 0) {
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          shape.rotation(angle);
        }
      }

      // Update the rendered position.
      shape.position({ x, y });
    }

    // Remove shapes when enemies disappear from the model.
    for (const [id, shape] of this.shapes) {
      if (!activeIds.has(id)) {
        shape.destroy();
        this.shapes.delete(id);
        this.lastHp.delete(id);
        this.flashUntil.delete(id);
      }
    }
  }
}
