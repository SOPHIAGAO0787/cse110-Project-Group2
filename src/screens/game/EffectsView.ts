import Konva from "konva";
import type { Enemy } from "../../model/Enemy";
import { FONT } from "../theme";
import { tileToPixel } from "./coords";
import { TILE } from "./GameScreenView";

const BAR_WIDTH = 32;
const BAR_HEIGHT = 5;
const BAR_ABOVE_ENEMY = 26; // pixels from the enemy's center up to its health bar
const COIN_COLOR = "#ffd53d";

// Short visual feedback drawn on the map: a health bar over each damaged enemy, and a coin
// popup with a small puff where an enemy is defeated.
export class EffectsView {
  group = new Konva.Group({ listening: false });
  private bars = new Konva.Group();

  constructor() {
    this.group.add(this.bars);
  }

  // Redraws the health bars from the model. Called every frame, because enemies move every frame.
  syncHealthBars(enemies: Enemy[]): void {
    this.bars.destroyChildren();
    for (const enemy of enemies) {
      // def.hp is the health the enemy started with. A full bar would only add clutter.
      if (enemy.hp >= enemy.def.hp || enemy.isDead()) {
        continue;
      }
      const center = tileToPixel(enemy.pos, TILE);
      const x = center.x - BAR_WIDTH / 2;
      const y = center.y - BAR_ABOVE_ENEMY;
      const filled = BAR_WIDTH * (enemy.hp / enemy.def.hp);
      this.bars.add(
        new Konva.Rect({ x, y, width: BAR_WIDTH, height: BAR_HEIGHT, fill: "#3a3a52" }),
        new Konva.Rect({ x, y, width: filled, height: BAR_HEIGHT, fill: "#34c97a" }),
      );
    }
  }

  // Shows "+reward" floating up and a ring in the enemy's color where the enemy was defeated.
  showKill(enemy: Enemy, reward: number): void {
    const center = tileToPixel(enemy.pos, TILE);

    const puff = new Konva.Circle({
      x: center.x,
      y: center.y,
      radius: TILE * 0.3,
      stroke: enemy.def.color,
      strokeWidth: 4,
    });
    this.group.add(puff);
    new Konva.Tween({
      node: puff,
      duration: 0.3,
      scaleX: 2,
      scaleY: 2,
      opacity: 0,
      onFinish: () => puff.destroy(),
    }).play();

    const popup = new Konva.Text({
      x: center.x - TILE,
      y: center.y - 20,
      width: TILE * 2,
      align: "center",
      text: `+${reward}`,
      fontSize: 20,
      fontStyle: "bold",
      fontFamily: FONT,
      fill: COIN_COLOR,
      stroke: "#3a3a52",
      strokeWidth: 1,
    });
    this.group.add(popup);
    new Konva.Tween({
      node: popup,
      duration: 0.8,
      y: center.y - 60,
      opacity: 0,
      onFinish: () => popup.destroy(),
    }).play();
  }
}
