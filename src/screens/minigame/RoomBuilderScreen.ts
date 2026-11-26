import type { EffectName } from "../../core/Sound";
import type { Screen } from "../../app/types";
import { RoomBuilderController } from "./RoomBuilderController";
import { RoomBuilderView } from "./RoomBuilderView";

export class RoomBuilderScreen implements Screen {
  readonly group;
  private controller: RoomBuilderController;
  private view: RoomBuilderView;

  constructor(
    award: (earnedCoins: number) => number,
    onBack: () => void,
    onReturnToMenu: () => void,
    playEffect: (effect: EffectName) => void,
  ) {
    this.controller = new RoomBuilderController(award, playEffect);
    this.view = new RoomBuilderView(this.controller, onBack, onReturnToMenu);
    this.group = this.view.page.group;
  }

  show(): void {
    this.view.showDifficulty();
    this.group.show();
  }

  hide(): void {
    this.group.hide();
    this.view.cancelDrag();
    document.body.style.cursor = "default";
  }

  resize(width: number, height: number): void {
    this.view.page.resize(width, height);
  }
}
