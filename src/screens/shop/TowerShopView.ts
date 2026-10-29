import Konva from "konva";
import { makeButton } from "../button";
import type { ShopTower } from "./shopPreviewData";

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
}

//place holder : could be changed on our team's size
const WIDTH = 900;
const HEIGHT = 640;

export class TowerShopView {
  group = new Konva.Group();

  private scene = new Konva.Group();
  private content = new Konva.Group();
  private popup = new Konva.Group({ visible: false });

  constructor(private callbacks: ShopCallbacks) {
    this.scene.add(this.content, this.popup);
    this.group.add(this.scene);
  }

    render(state: ShopViewState): void {
        this.content.destroyChildren();

        this.content.add(
            new Konva.Rect({
                width: WIDTH,
                height: HEIGHT,
                fill: "#1e1e2e",
            }),
        );

        this.text(this.content, "Tower Shop", 28, 24, 34);
        this.text(this.content, `Coins: ${state.coins}`, 650, 30, 24);
        this.text(
            this.content,
            "Select a tower to view its abilities and upgrades.",
            28,
            75,
            18,
        );
        state.towers.forEach((tower, index) => {
            const level = state.levels.get(tower.def.id) ?? -1;
            const status = level < 0 ? "Locked" : `Level ${level + 1}`;
            const selected = tower.def.id === state.selectedId;

            this.text(
                this.content,
                `${selected ? "► " : ""}${tower.def.name} · ${status}`,
                28,
                120 + index * 100,
                18,
                260,
            );

            this.button(
                this.content,
                `View · ${tower.unlockCost} coins to unlock`,
                28,
                150 + index * 100,
                () => this.callbacks.onSelect(tower.def.id),
            );
        });

        const tower = state.towers.find(
            (item) => item.def.id === state.selectedId,
        );

        if (tower) {
            this.renderDetails(tower, state.levels.get(tower.def.id) ?? -1);
        }

        this.button(
            this.content,
            "Back to Menu",
            28,
            550,
            this.callbacks.onBack,
        );

        this.text(
            this.content,
            "UI demo: sample coins and upgrades. Progress resets on refresh.",
            28,
            610,
            15,
            840,
        );
    }
    
    private renderDetails(tower: ShopTower, levelIndex: number): void {
    const locked = levelIndex < 0;
    const current = tower.levels[Math.max(0, levelIndex)];
    const next = tower.levels[Math.max(0, levelIndex) + 1];

    this.content.add(
      new Konva.Rect({
        x: 310,
        y: 115,
        width: 562,
        height: 470,
        fill: "#262637",
        stroke: "#52526b",
        cornerRadius: 12,
      }),
    );

    this.text(this.content, tower.def.name, 334, 135, 28);
    this.text(
      this.content,
      locked ? "Locked · Base abilities" : `Level ${levelIndex + 1}`,
      334,
      175,
      18,
    );

    this.text(
      this.content,
      tower.def.description,
      334,
      211,
      18,
    );

    this.text(
      this.content,
      [
        `Damage: ${current.damage}`,
        `Attack speed: ${current.attackSpeed} shots/sec`,
        `Range radius: ${current.radius} tiles`,
      ].join("\n"),
      334,
      275,
      20,
    );

    if (next) {
      this.text(
        this.content,
        [
          locked ? "Next upgrade after unlocking:" : "Next upgrade:",
          `Damage: ${current.damage} → ${next.damage}`,
          `Attack speed: ${current.attackSpeed} → ${next.attackSpeed} shots/sec`,
          `Range radius: ${current.radius} → ${next.radius} tiles`,
          `Upgrade cost: ${current.upgradeCost} coins`,
        ].join("\n"),
        334,
        375,
        18,
      );
    } else {
      this.text(
        this.content,
        "Maximum level reached",
        334,
        390,
        22,
      );
    }

    if (locked || next) {
      const cost = locked ? tower.unlockCost : current.upgradeCost;

      this.button(
        this.content,
        `${locked ? "Unlock" : "Upgrade"} · ${cost} coins`,
        334,
        520,
        this.callbacks.onAction,
      );
    }
  }

