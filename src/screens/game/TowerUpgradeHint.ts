import Konva from "konva";
import type { Tower } from "../../model/Tower";
import type { ShopTower } from "../../model/shop/types";
import type { Vec } from "../../model/types";
import { fireRateFor } from "../../model/towerConfig";
import { FONT, TITLE_TEXT, WARNING_TEXT } from "../theme";

const WIDTH = 280;
const HEIGHT = 216;

// This overlay never takes pointer events away from the tower underneath it.
export class TowerUpgradeHint {
  group = new Konva.Group({ name: "tower-upgrade-hint", visible: false, listening: false });
  private title: Konva.Text;
  private cost: Konva.Text;
  private stats: Konva.Text;
  private action: Konva.Text;

  constructor() {
    this.group.add(
      new Konva.Rect({
        width: WIDTH,
        height: HEIGHT,
        fill: "#fffefa",
        stroke: "#759ef5",
        strokeWidth: 2,
        cornerRadius: 14,
        shadowColor: "#142139",
        shadowBlur: 18,
        shadowOpacity: 0.2,
        shadowOffsetY: 5,
      }),
    );
    this.title = this.text(18, 16, 17, true);
    this.cost = this.text(18, 45, 15, true);
    this.stats = this.text(18, 75, 14);
    this.group.add(
      new Konva.Rect({
        x: 12,
        y: 157,
        width: WIDTH - 24,
        height: 47,
        fill: "#edf2ff",
        cornerRadius: 8,
      }),
    );
    this.action = this.text(20, 165, 13, true);
  }

  show(
    tower: Tower,
    shop: ShopTower | undefined,
    maxLevel: number,
    coins: number,
    anchor: Vec,
    bounds: Vec,
  ): void {
    const current = shop?.levels[tower.level];
    const next = shop?.levels[tower.level + 1];
    const price = current?.upgradeCost;
    this.title.text(`${tower.def.name} · Level ${tower.level + 1}`);
    this.action.fill(TITLE_TEXT);

    if (!next || price === null || price === undefined) {
      this.cost.text("Maximum level reached");
      this.stats.text(
        `Damage: ${tower.def.damage}\nAttack speed: ${this.number(tower.fireRate)} shots/sec`,
      );
      this.action.text("This tower has no further upgrades.");
    } else {
      this.cost.text(`Upgrade to Level ${tower.level + 2} · ${price} coins`);
      const nextRate = fireRateFor(
        { ...tower.def, fireRatePerSec: next.attackSpeed },
        tower.config,
      );
      const lines = [
        `Damage: ${tower.def.damage} → ${next.damage}`,
        `Speed: ${this.number(tower.fireRate)} → ${this.number(nextRate)} shots/sec`,
        tower.def.range.kind === "circle"
          ? `Radius: ${tower.reach} → ${next.radius} tiles`
          : "Your aimed range stays the same.",
      ];
      this.stats.text(lines.join("\n"));
      if (tower.level >= maxLevel) {
        this.action.fill(WARNING_TEXT);
        this.action.text(`Unlock Level ${tower.level + 2} in the Tower Shop first.`);
      } else if (coins < price) {
        this.action.fill(WARNING_TEXT);
        this.action.text(`Need ${price - coins} more coins.\nYou have ${coins} of ${price}.`);
      } else {
        this.action.text(`Click this tower to upgrade.\nSpend ${price} gameplay coins.`);
      }
    }

    const x = anchor.x + WIDTH + 12 <= bounds.x - 8 ? anchor.x + 12 : anchor.x - WIDTH - 12;
    this.group.position({
      x: Math.max(8, Math.min(x, bounds.x - WIDTH - 8)),
      y: Math.max(56, Math.min(anchor.y - 36, bounds.y - HEIGHT - 8)),
    });
    this.group.visible(true);
  }

  hide(): void {
    this.group.visible(false);
  }

  private text(x: number, y: number, size: number, bold = false): Konva.Text {
    const text = new Konva.Text({
      x,
      y,
      width: WIDTH - x - 18,
      fontFamily: FONT,
      fontSize: size,
      fontStyle: bold ? "bold" : "normal",
      fill: TITLE_TEXT,
      lineHeight: 1.45,
    });
    this.group.add(text);
    return text;
  }

  private number(value: number): number {
    return Number(value.toFixed(2));
  }
}
