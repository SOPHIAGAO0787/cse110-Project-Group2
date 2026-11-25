import type { EffectName } from "../../core/Sound";
import type { Screen } from "../../app/types";
import { RoomBuilderController } from "./RoomBuilderController";
import { RoomBuilderView } from "./RoomBuilderView";

export class RoomBuilderScreen implements Screen {
  readonly group;
  private controller: RoomBuilderController;
  private view: RoomBuilderView;

  constructor(
    award: (areaUsed: number) => number,
    onBack: () => void,
    playEffect: (effect: EffectName) => void,
  ) {
    this.controller = new RoomBuilderController(award, playEffect);
    this.view = new RoomBuilderView(this.controller, onBack);
    this.group = this.view.page.group;
  }

  show(): void {
    this.controller.reset();
    this.view.render();
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
