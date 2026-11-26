import Konva from "konva";
import type { Tower } from "../../model/Tower";
import type { ShopTower } from "../../model/shop/types";
import type { Vec } from "../../model/types";
import { fireRateFor } from "../../model/towerConfig";
import { BUTTON_FILL, FONT, LOCKED_BUTTON_FILL, TITLE_TEXT, WARNING_TEXT } from "../theme";

const WIDTH = 280;
const HEIGHT = 300;
const BUTTON_WIDTH = WIDTH - 36;
const BUTTON_HEIGHT = 34;

// The panel catches clicks so its controls never fall through to the map.
export class TowerUpgradeHint {
  group = new Konva.Group({ name: "tower-upgrade-hint", visible: false });
  onSell: () => void = () => {};
  onUpgrade: () => void = () => {};
  private title: Konva.Text;
  private cost: Konva.Text;
  private stats: Konva.Text;
  private action: Konva.Text;
  // The Upgrade button's background. It turns grey when the tower can't be upgraded right now.
  private upgradeFill: Konva.Rect;

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
        listening: false,
      }),
    );
    this.action = this.text(20, 165, 13, true);
    this.upgradeFill = this.buttonFill();
    this.group.add(
      this.button("upgrade-tower-button", "upgrade-tower-label", 214, this.upgradeFill, () =>
        this.onUpgrade(),
      ),
      this.button("sell-tower-button", "sell-tower-label", 254, this.buttonFill(), () =>
        this.onSell(),
      ),
    );
  }

  private buttonFill(): Konva.Rect {
    return new Konva.Rect({
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      fill: BUTTON_FILL,
      cornerRadius: 8,
    });
  }

  private button(
    name: string,
    label: string,
    y: number,
    fill: Konva.Rect,
    action: () => void,
  ): Konva.Group {
    const button = new Konva.Group({ name, x: 18, y });
    button.add(
      fill,
      new Konva.Text({
        name: label,
        width: BUTTON_WIDTH,
        y: 7,
        align: "center",
        fontFamily: FONT,
        fontSize: 14,
        fontStyle: "bold",
        fill: "white",
        listening: false,
      }),
    );
    button.on("click tap", (event) => {
      event.cancelBubble = true;
      action();
    });
    return button;
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
    this.group
      .findOne<Konva.Text>(".sell-tower-label")
      ?.text(`Sell Tower (+${tower.sellValue} coins)`);
    this.group.findOne<Konva.Text>(".upgrade-tower-label")?.text("Upgrade Tower");
    this.title.text(`${tower.def.name} · Level ${tower.level + 1}`);
    this.action.fill(TITLE_TEXT);
    // Only the last case below can upgrade. The button still answers a click in the other
    // cases, with a message that says why the upgrade didn't happen.
    let canUpgrade = false;

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
        this.action.text(`Use Upgrade below.\nSpend ${price} gameplay coins.`);
        canUpgrade = true;
      }
    }
    if (canUpgrade) {
      this.upgradeFill.fill(BUTTON_FILL);
    } else {
      this.upgradeFill.fill(LOCKED_BUTTON_FILL);
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

  // The short gap between the tower tile and the panel stays interactive so a hover-only
  // panel does not vanish before the pointer can reach its buttons.
  containsPointer(
    pointer: Vec,
    tile: { x: number; y: number; width: number; height: number },
  ): boolean {
    if (!this.group.visible()) return false;
    const panelX = this.group.x();
    const panelY = this.group.y();
    if (
      pointer.x >= panelX &&
      pointer.x <= panelX + WIDTH &&
      pointer.y >= panelY &&
      pointer.y <= panelY + HEIGHT
    )
      return true;
    if (
      pointer.x >= tile.x &&
      pointer.x <= tile.x + tile.width &&
      pointer.y >= tile.y &&
      pointer.y <= tile.y + tile.height
    )
      return true;

    const tileRight = tile.x + tile.width;
    const panelRight = panelX + WIDTH;
    const gapLeft = panelX >= tileRight ? tileRight : panelRight;
    const gapRight = panelX >= tileRight ? panelX : tile.x;
    return (
      pointer.x >= gapLeft &&
      pointer.x <= gapRight &&
      pointer.y >= tile.y &&
      pointer.y <= tile.y + tile.height
    );
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
      listening: false,
    });
    this.group.add(text);
    return text;
  }

  private number(value: number): number {
    return Number(value.toFixed(2));
  }
}
