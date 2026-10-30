import type { Screen, ScreenSwitcher } from "../../app/types";
import { SHOP_TOWERS } from "./ShopPreviewData";
import { TowerShopView } from "./TowerShopView";

export class TowerShopScreen implements Screen {
  private view: TowerShopView;

  // Demo state only. This is separate from the gameplay wallet.
  private coins = 200;
  private levels = new Map<string, number>();
  private selectedId = SHOP_TOWERS[0]?.def.id ?? "";

  group: TowerShopView["group"];

  constructor(app: ScreenSwitcher) {
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
      levels: this.levels,
      coins: this.coins,
    });
  }

  private handleAction(): void {
    const tower = SHOP_TOWERS.find(
      (item) => item.def.id === this.selectedId,
    );
    if (!tower) return;

    //get the level, check locked or not, get cur level
    // -1 = locked; 0 = level 1; 1 = level 2.
    const levelIndex = this.levels.get(tower.def.id) ?? -1;
    const locked = levelIndex < 0;
    const current = tower.levels[Math.max(0, levelIndex)];

    if (!locked && !tower.levels[levelIndex + 1]) return;

    //check the coin, check if use can buy
    const cost = locked ? tower.unlockCost : current.upgradeCost;
    if (cost === null) return;

    if (this.coins < cost) {
      this.view.showPopup(
        `You need ${cost} coins, but have ${this.coins}.\nEarn ${cost - this.coins} more coins.`,
      );
      return;
    }

    // Temporary successful interaction for the UI demonstration.
    this.coins -= cost;
    this.levels.set(tower.def.id, locked ? 0 : levelIndex + 1);
    this.refresh();
  }
}