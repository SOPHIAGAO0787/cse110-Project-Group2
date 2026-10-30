import type { Screen, ScreenSwitcher } from "../../app/types";
import { SHOP_TOWERS } from "./shopPreviewData";
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
