import type { Screen, ScreenSwitcher } from "../../app/types";
import { SHOP_TOWERS } from "../../model/shop/loadShopContent";
import { TowerShopView } from "./TowerShopView";
import { TowerProgress } from "../../model/TowerProgress";
import { SettingsPanel } from "../game/SettingsPanel";
import { Sound } from "../../core/Sound";

export class TowerShopScreen implements Screen {
  private view: TowerShopView;
  private settings: SettingsPanel;

  private selectedId = SHOP_TOWERS[0]?.def.id ?? "";

  group: TowerShopView["group"];

  constructor(
    app: ScreenSwitcher,
    private progress: TowerProgress,
    sound: Sound = new Sound(),
  ) {
    this.settings = new SettingsPanel(
      () => this.settings.close(),
      () => app.switchTo("maps"),
      () => app.switchTo("menu"),
      sound,
      "shop",
    );
    this.view = new TowerShopView({
      onSelect: (id) => {
        this.selectedId = id;
        this.refresh();
      },
      onAction: () => this.handleAction(),
      onBack: () => app.switchTo("menu"),
      onSettings: () => {
        this.view.closePopup();
        this.settings.open();
      },
    });

    this.group = this.view.group;
    this.group.add(this.settings.group);
    this.refresh();
  }

  show(): void {
    this.refresh();
    this.group.visible(true);
  }

  hide(): void {
    this.settings.close();
    this.view.closePopup();
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.view.resize(width, height);
    this.settings.resize(width, height);
  }

  private refresh(): void {
    this.view.render({
      towers: SHOP_TOWERS,
      selectedId: this.selectedId,
      levels: this.progress.maxLevels,
      coins: this.progress.shopCoins,
    });
  }

  private handleAction(): void {
    const tower = SHOP_TOWERS.find((item) => item.def.id === this.selectedId);
    if (!tower) return;

    // -1 = locked; 0 = level 1; 1 = level 2.
    const levelIndex = this.progress.maxLevels.get(tower.def.id) ?? -1;
    const locked = levelIndex < 0;
    const current = tower.levels[Math.max(0, levelIndex)];

    if (!locked && !tower.levels[levelIndex + 1]) return;

    // Check whether the user has enough coins to unlock or upgrade.
    const cost = locked ? tower.unlockCost : current.upgradeCost;
    if (cost === null) return;

    if (this.progress.shopCoins < cost) {
      this.view.showPopup(
        `You need ${cost} coins, but have ${this.progress.shopCoins}.\nEarn ${cost - this.progress.shopCoins} more coins.`,
      );
      return;
    }

    // Temporary successful interaction for the UI demonstration.
    this.progress.shopCoins -= cost;
    this.progress.maxLevels.set(tower.def.id, locked ? 0 : levelIndex + 1);
    this.refresh();
  }
}
