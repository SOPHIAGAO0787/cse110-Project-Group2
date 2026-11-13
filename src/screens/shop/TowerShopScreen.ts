import type { Screen, ScreenSwitcher } from "../../app/types";
import { SHOP_TOWERS } from "../../model/shop/loadShopContent";
import { TowerShopView } from "./TowerShopView";
import { PlayerProgress } from "../../model/PlayerProgress";

export class TowerShopScreen implements Screen {
  private view: TowerShopView;

  private selectedId = SHOP_TOWERS[0]?.def.id ?? "";

  group: TowerShopView["group"];

  constructor(
    app: ScreenSwitcher,
    private progress: PlayerProgress,
  ) {
    this.view = new TowerShopView({
      onSelect: (id) => {
        this.selectedId = id;
        this.refresh();
      },
      onAction: () => this.handleAction(),
      onBack: () => app.switchTo("menu"),
    });

    this.group = this.view.group;
    this.refresh();
  }

  show(): void {
    this.refresh();
    this.group.visible(true);
  }

  hide(): void {
    this.view.closePopup();
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.view.resize(width, height);
  }

  //refresh the page
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

    //get the level, check locked or not, get cur level
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
