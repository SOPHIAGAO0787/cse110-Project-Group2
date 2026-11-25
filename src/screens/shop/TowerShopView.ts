import Konva from "konva";
import { makeClickable, makeSettingsButton } from "../button";
import { Page, CARD_WIDTH as PAGE_WIDTH, CARD_HEIGHT as PAGE_HEIGHT } from "../Page";
import {
  FONT,
  HEADER_BACKGROUND,
  SQUARE_TOWER_COLOR,
  TRIANGLE_TOWER_COLOR,
  CIRCLE_TOWER_COLOR,
} from "../theme";
import type { ShopLevel, ShopTower } from "../../model/shop/types";
import { rectSizes } from "../../model/geometry/rect";
import { fireRateFor } from "../../model/towerConfig";

interface ShopViewState {
  towers: ShopTower[];
  selectedId: string;
  levels: ReadonlyMap<string, number>;
  coins: number;
}

interface ShopCallbacks {
  onSelect: (id: string) => void;
  onAction: () => void;
  onBack: () => void;
  onSettings: () => void;
}

const ROW_WIDTH = 1120;
const CARD_WIDTH = 330;
const CARD_HEIGHT = 554;
const INK = "#20283d";
const MUTED = "#65738b";

function towerStyle(tower: ShopTower): { color: string; tint: string } {
  switch (tower.def.range.kind) {
    case "rect":
      return { color: SQUARE_TOWER_COLOR, tint: "#edf2ff" };
    case "sector":
      return { color: TRIANGLE_TOWER_COLOR, tint: "#fff5e8" };
    case "circle":
      return { color: CIRCLE_TOWER_COLOR, tint: "#edfbf3" };
  }
}

export class TowerShopView {
  private page = new Page();
  group = this.page.group;

  private content = new Konva.Group();
  private settingsButton: Konva.Group;
  private popup = new Konva.Group({ visible: false });

  constructor(private callbacks: ShopCallbacks) {
    this.page.content.add(this.content, this.popup);
    this.settingsButton = makeSettingsButton(this.callbacks.onSettings);
    this.group.add(this.settingsButton);
  }

  render(state: ShopViewState): void {
    this.content.destroyChildren();
    this.text(this.content, "Tower Shop", 56, 47, 28, 650, INK, true);
    this.text(
      this.content,
      "Choose a tower. Unlock new shapes and build a stronger defense.",
      56,
      91,
      15,
      850,
      MUTED,
    );
    this.button(
      this.content,
      "←  Main menu",
      PAGE_WIDTH - 210,
      42,
      154,
      38,
      this.callbacks.onBack,
      HEADER_BACKGROUND,
    );

    const coinsX = PAGE_WIDTH - 225;
    this.content.add(
      new Konva.Rect({
        x: coinsX,
        y: 99,
        width: 169,
        height: 44,
        fill: "#fff4cf",
        cornerRadius: 22,
      }),
      new Konva.Circle({
        x: coinsX + 24,
        y: 121,
        radius: 10,
        fill: "#ffc547",
        stroke: "#e9aa29",
        strokeWidth: 1.5,
      }),
    );
    this.text(this.content, `${state.coins} coins`, coinsX + 43, 110, 17, 115, INK, true);

    const order = ["circle", "sector", "rect"];
    const towers = [...state.towers].sort(
      (a, b) => order.indexOf(a.def.range.kind) - order.indexOf(b.def.range.kind),
    );
    towers.forEach((tower, index) => this.renderCard(tower, index, state));

    this.text(
      this.content,
      "Shop purchases unlock levels. Upgrade placed towers separately during a game.",
      56,
      747,
      13,
      900,
      MUTED,
    );
  }

  private renderCard(tower: ShopTower, index: number, state: ShopViewState): void {
    const { color, tint } = towerStyle(tower);
    const levelIndex = state.levels.get(tower.def.id) ?? -1;
    const locked = levelIndex < 0;
    const current = tower.levels[Math.max(0, levelIndex)];
    const next = tower.levels[Math.max(0, levelIndex) + 1];
    const selected = tower.def.id === state.selectedId;
    const card = new Konva.Group({
      x: (PAGE_WIDTH - ROW_WIDTH) / 2 + 40 + index * 355,
      y: 160,
      name: `tower-${tower.def.id}`,
    });
    card.add(
      new Konva.Rect({
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fill: "white",
        stroke: selected ? color : "#e4e9f2",
        strokeWidth: selected ? 2 : 1,
        cornerRadius: 16,
        shadowColor: "#26395f",
        shadowBlur: 18,
        shadowOpacity: 0.08,
        shadowOffsetY: 6,
      }),
      new Konva.Rect({
        width: CARD_WIDTH,
        height: 132,
        fill: tint,
        cornerRadius: [16, 16, 0, 0],
        listening: false,
      }),
      new Konva.Rect({
        x: 16,
        y: 15,
        width: 115,
        height: 22,
        fill: color,
        cornerRadius: 11,
        listening: false,
      }),
    );
    this.text(card, tower.def.name.toUpperCase(), 25, 20, 9, 103, "white", true);
    this.drawIcon(card, tower, color);
    if (locked) {
      card.add(
        new Konva.Rect({
          width: CARD_WIDTH,
          height: 132,
          fill: "#111827",
          opacity: 0.65,
          cornerRadius: [16, 16, 0, 0],
          listening: false,
          name: "locked-overlay",
        }),
        new Konva.Arc({
          x: 165,
          y: 65,
          innerRadius: 10,
          outerRadius: 13,
          angle: 180,
          rotation: 180,
          fill: "white",
          listening: false,
        }),
        new Konva.Rect({
          x: 148,
          y: 65,
          width: 34,
          height: 27,
          fill: "white",
          cornerRadius: 5,
          listening: false,
        }),
        new Konva.Circle({ x: 165, y: 76, radius: 3, fill: "#3f485b", listening: false }),
      );
      this.text(card, "LOCKED", 115, 104, 12, 100, "white", true).align("center");
    }
    this.text(card, tower.def.name, 20, 150, 24, 290, INK, true);
    this.text(
      card,
      locked
        ? "Locked · unlock to place"
        : `Level ${levelIndex + 1} of ${tower.levels.length} unlocked`,
      20,
      183,
      13,
      290,
      MUTED,
    );

    const range = tower.def.range;
    const rangeLabel = range.kind === "circle" ? "Radius" : "Range area";
    const rangeValue =
      range.kind === "circle"
        ? `${current.radius} tiles`
        : range.kind === "sector"
          ? `${range.area} tiles²`
          : `up to ${range.maxArea} tiles²`;
    const stats = [
      ["Damage", `${current.damage}`],
      [rangeLabel, rangeValue],
      ["Attack speed", `${this.describeAttackSpeed(tower, current)} / sec`],
    ];
    stats.forEach(([label, value], row) => {
      const y = 215 + row * 36;
      card.add(
        new Konva.Line({ points: [20, y - 7, 310, y - 7], stroke: "#edf0f5", listening: false }),
      );
      this.text(card, label, 20, y + 1, 13, 160, INK);
      card.add(
        new Konva.Rect({
          x: 188,
          y: y - 1,
          width: 122,
          height: 25,
          fill: tint,
          cornerRadius: 7,
          listening: false,
        }),
      );
      const valueText = this.text(card, value, 192, y + 3, 12, 114, INK, true);
      valueText.align("center");
    });

    const note =
      range.kind === "sector"
        ? "Wider cones reach less far; narrower cones reach farther."
        : range.kind === "rect"
          ? "Smaller blocks fire faster; aim to choose the size."
          : tower.def.description;
    this.text(card, note, 20, 329, 13, 290, MUTED);

    card.add(
      new Konva.Rect({
        x: 16,
        y: 378,
        width: 298,
        height: 98,
        fill: "#f7f9fc",
        cornerRadius: 10,
        listening: false,
      }),
    );
    if (next) {
      this.text(
        card,
        locked ? "After unlocking · Level 2" : `Next upgrade · Level ${levelIndex + 2}`,
        28,
        388,
        12,
        274,
        INK,
        true,
      );
      this.text(
        card,
        `Damage: ${current.damage} → ${next.damage}   ·   ${current.upgradeCost} coins`,
        28,
        411,
        12,
        274,
        MUTED,
      );
      this.text(
        card,
        `Attack speed: ${this.describeAttackSpeed(tower, current)} → ${this.describeAttackSpeed(tower, next)} / sec`,
        28,
        432,
        12,
        274,
        MUTED,
      );
      if (range.kind === "circle") {
        this.text(
          card,
          `Radius: ${current.radius} → ${next.radius} tiles`,
          28,
          453,
          12,
          274,
          MUTED,
        );
      }
    } else {
      this.text(card, "All levels unlocked", 28, 396, 15, 274, INK, true);
      this.text(card, "No further upgrades available", 28, 423, 12, 274, MUTED);
    }

    const canAct = locked || !!next;
    const cost = locked ? tower.unlockCost : current.upgradeCost;
    this.button(
      card,
      canAct
        ? `${locked ? "Unlock tower" : "Upgrade tower"} · ${cost} coins`
        : "Maximum level reached",
      20,
      492,
      290,
      44,
      () => {
        // Select first so each card's purchase acts on its own tower.
        this.callbacks.onSelect(tower.def.id);
        this.callbacks.onAction();
      },
      color,
      canAct,
    );
    makeClickable(card, () => this.callbacks.onSelect(tower.def.id));
    this.content.add(card);
  }

  private drawIcon(card: Konva.Group, tower: ShopTower, color: string): void {
    switch (tower.def.range.kind) {
      case "rect":
        card.add(
          new Konva.Rect({
            x: 130,
            y: 49,
            width: 70,
            height: 65,
            fill: color,
            cornerRadius: 9,
            listening: false,
          }),
        );
        break;
      case "sector":
        card.add(
          new Konva.Line({
            points: [165, 47, 204, 113, 126, 113],
            fill: color,
            closed: true,
            listening: false,
          }),
        );
        break;
      case "circle":
        card.add(new Konva.Circle({ x: 165, y: 81, radius: 35, fill: color, listening: false }));
        break;
    }
  }

  private describeAttackSpeed(tower: ShopTower, level: ShopLevel): string {
    if (tower.def.range.kind !== "rect") return `${level.attackSpeed}`;
    const def = { ...tower.def, fireRatePerSec: level.attackSpeed };
    const rates = rectSizes(tower.def.range.maxArea).map(({ width, depth }) =>
      fireRateFor(def, { kind: "rect", facing: "up", width, depth, side: 1 }),
    );
    const slowest = Number(Math.min(...rates).toFixed(2));
    const fastest = Number(Math.max(...rates).toFixed(2));
    return slowest === fastest ? `${slowest}` : `${slowest}–${fastest}`;
  }

  showPopup(message: string): void {
    this.popup.destroyChildren();
    const x = (PAGE_WIDTH - 460) / 2;
    const y = (PAGE_HEIGHT - 250) / 2;
    this.popup.add(
      new Konva.Rect({
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        fill: "#20283d88",
        cornerRadius: 24,
      }),
      new Konva.Rect({
        x,
        y,
        width: 460,
        height: 250,
        fill: "white",
        cornerRadius: 18,
        shadowColor: "#20283d",
        shadowBlur: 30,
        shadowOpacity: 0.15,
      }),
    );
    this.text(this.popup, "A few more coins to go", x + 32, y + 32, 25, 396, INK, true);
    this.text(this.popup, message, x + 32, y + 82, 17, 396, MUTED);
    this.button(
      this.popup,
      "Got it",
      x + 32,
      y + 174,
      396,
      44,
      () => this.closePopup(),
      HEADER_BACKGROUND,
    );
    this.popup.visible(true);
    this.popup.moveToTop();
  }

  closePopup(): void {
    this.popup.visible(false);
    this.popup.destroyChildren();
  }

  resize(width: number, height: number): void {
    this.page.resize(width, height);
    this.settingsButton.position({ x: width - 72, y: 30 });
  }

  private text(
    parent: Konva.Group,
    value: string,
    x: number,
    y: number,
    fontSize: number,
    width: number,
    fill: string,
    bold = false,
  ): Konva.Text {
    const text = new Konva.Text({
      x,
      y,
      width,
      text: value,
      fontSize,
      fill,
      fontFamily: FONT,
      fontStyle: bold ? "bold" : "normal",
      lineHeight: 1.3,
      listening: false,
    });
    parent.add(text);
    return text;
  }

  private button(
    parent: Konva.Group,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: () => void,
    color: string,
    enabled = true,
  ): void {
    const button = new Konva.Group({ x, y, listening: enabled });
    const background = new Konva.Rect({
      width,
      height,
      fill: enabled ? color : "#e8edf4",
      cornerRadius: height / 2,
    });
    const text = new Konva.Text({
      width,
      height,
      text: label,
      fontFamily: FONT,
      fontSize: 16,
      fontStyle: "bold",
      fill: enabled ? "white" : MUTED,
      align: "center",
      verticalAlign: "middle",
      listening: false,
    });
    button.add(background, text);
    // Stop bubbling before the callback redraws and replaces this card.
    button.on("click tap", (event) => {
      event.cancelBubble = true;
    });
    makeClickable(button, onClick);
    button.on("mouseenter", () => background.opacity(0.88));
    button.on("mouseleave", () => background.opacity(1));
    parent.add(button);
  }
}
