import type { GameModel } from "../../model/GameModel";
import { MAPS, TOWERS } from "../../model/loadContent";
import type { MapConfig, TowerConfig, Vec } from "../../model/types";
import type { GameScreenView } from "./GameScreenView";
import type { GridView } from "./GridView";
import { PlacementModel } from "../../model/PlacementModel";
import { PlacementView } from "./PlacementView";
import type { QuestionService } from "../../model/questions/QuestionService";
import { wrongAnswerCost } from "../../model/questions/TowerQuestionsHandling";
import { InGameTowerCard } from "./InGameTowerCard";
import type { TowerProgress } from "../../model/TowerProgress";
import { configFromPointer, defaultConfig } from "../../model/towerConfig";
import { SHOP_TOWERS } from "../../model/shop/loadShopContent";

// Placing and upgrading towers during one game: the tower cards in the shop, dragging a tower onto
// the map, aiming it, asking its question, and selecting placed towers for upgrade or sale.
// GameScreenController makes a new one for every game and calls dispose() when the game ends.
export class PlacementController {
  private view: GameScreenView;
  private model: GameModel;
  private map: MapConfig;
  private mapNumber: number; // this map's place in the map list, starting at 1
  private towerProgress: TowerProgress;
  private questions: QuestionService;
  private isActive: () => boolean; // false while the game screen is hidden
  private screenHeight: number; // used to fit the tower cards in the shop
  private layoutCards: () => void;
  private refreshHint: () => void;
  private cleanup: () => void;
  // Runs when a tower's question opens. The controller sets it, for the tutorial.
  onQuestionOpened: () => void = () => {};

  constructor(
    view: GameScreenView,
    model: GameModel,
    map: MapConfig,
    towerProgress: TowerProgress,
    questions: QuestionService,
    gridView: GridView,
    isActive: () => boolean,
    screenHeight: number,
  ) {
    this.view = view;
    this.model = model;
    this.map = map;
    // Later maps ask harder questions. A map that isn't in the list counts as the first.
    this.mapNumber = 1;
    for (let i = 0; i < MAPS.length; i++) {
      if (MAPS[i].id === map.id) {
        this.mapNumber = i + 1;
      }
    }
    this.towerProgress = towerProgress;
    this.questions = questions;
    this.isActive = isActive;
    this.screenHeight = screenHeight;
    // These stay empty when no tower is unlocked, because then there is nothing to place
    this.layoutCards = () => {};
    this.refreshHint = () => {};
    this.cleanup = () => {};
    this.wire(gridView);
  }

  // Fits the tower cards to the new screen height and moves the upgrade hint
  resize(height: number): void {
    this.screenHeight = height;
    this.layoutCards();
    this.refreshHint();
  }

  // Shows or hides the upgrade hint, after the coins or the settings change
  refreshUpgradeHint(): void {
    this.refreshHint();
  }

  // Removes the cards, the previews and every input listener
  dispose(): void {
    this.cleanup();
  }

  private wire(gridView: GridView): void {
    const model = this.model;
    let disposed = false;
    const canCommit = () => !disposed && this.isActive() && !model.isOver;
    const placement = new PlacementModel();

    // Only the towers bought in the Tower Shop can be placed.
    const unlockedTowers = TOWERS.filter((tower) => this.towerProgress.getMaxLevel(tower.id) >= 0);

    // No unlocked towers means there is nothing to place.
    if (unlockedTowers.length === 0) {
      return;
    }

    // One card and one preview per tower kind; picking a card switches which one is active.
    const choices = unlockedTowers.map((tower) => {
      const view = new PlacementView(tower, { cols: this.map.cols, rows: this.map.rows });
      const card = new InGameTowerCard(tower, view.menuIcon);
      this.view.mapGroup.add(view.group, view.prompt);
      this.view.shopGroup.add(card.group);
      return { tower, view, card };
    });

    // Stack the cards under the shop title, shrinking them all if they would run off the screen
    // (the wave countdown and the Start Wave button sit at the bottom).
    const CARD_STEP = 352;
    const SHOP_TOP = 84;
    const SHOP_BOTTOM = 160;
    this.layoutCards = () => {
      const room = this.screenHeight - SHOP_TOP - SHOP_BOTTOM;
      const scale =
        this.screenHeight > 0
          ? Math.min(1, Math.max(0.35, room / (choices.length * CARD_STEP)))
          : 1;
      choices.forEach(({ card }, index) => {
        card.group.scale({ x: scale, y: scale });
        card.group.position({
          x: 16 + (228 * (1 - scale)) / 2,
          y: SHOP_TOP + index * CARD_STEP * scale,
        });
      });
    };
    this.layoutCards();

    // These change when the player picks another tower.
    let def = choices[0].tower;
    let pv = choices[0].view;

    const stage = this.view.group.getStage();
    const canPlace = (t: Vec) => this.model.grid.isBuildable(t);

    // Asks the question and returns true only if the player answered correctly.
    const beforeCommit = async (tile: Vec, config?: TowerConfig): Promise<boolean> => {
      const question = this.questions.questionFor(def, config, this.mapNumber);
      this.onQuestionOpened();
      const anchor = this.view.tileToScreen(tile);
      const correct = await this.view.prompt.ask(question, anchor, wrongAnswerCost(def));
      if (!canCommit()) return false;
      return correct;
    };

    let pending = false; // blocks double-triggers while a question is open
    // A click on the map locks the aim of a cone or block tower where it is, so the mouse can
    // reach the confirm and cancel squares without changing it. Another click aims again.
    let aimLocked = false;
    const lockAim = (locked: boolean) => {
      aimLocked = locked;
      pv.setLocked(locked);
    };
    // Keep the last hover preview while the pointer crosses empty tiles to reach the panel.
    // It is cleared by an outside click, Escape, a sale, or disposal.
    let hoveredTowerId: number | null = null;
    let selectedTowerId: number | null = null;
    const refreshUpgradeHint = () => {
      const tower =
        model.towers.find((item) => item.id === selectedTowerId) ??
        model.towers.find((item) => item.id === hoveredTowerId);
      const canShow =
        !pending &&
        !disposed &&
        this.isActive() &&
        !model.isOver &&
        !this.view.settings.isOpen() &&
        placement.state.kind === "idle";
      const container = stage?.container();
      if (!canShow || !tower) {
        this.view.hideTowerUpgradeHint();
        if (container) container.style.cursor = "default";
        return;
      }
      this.view.showTowerUpgradeHint(
        tower,
        SHOP_TOWERS.find((item) => item.def.id === tower.def.id),
        this.towerProgress.getMaxLevel(tower.def.id),
        model.wallet.coins,
        () => {
          if (
            (selectedTowerId !== tower.id && hoveredTowerId !== tower.id) ||
            !canCommit() ||
            pending ||
            this.view.settings.isOpen() ||
            placement.state.kind !== "idle"
          )
            return;
          const refund = model.trySellTower(tower.id);
          if (refund === null) return;
          selectedTowerId = null;
          hoveredTowerId = null;
          this.view.hideTowerUpgradeHint();
          this.view.showMessage(`${tower.def.name} sold for ${refund} coins.`);
        },
        () => {
          if (
            (selectedTowerId !== tower.id && hoveredTowerId !== tower.id) ||
            !canCommit() ||
            pending ||
            this.view.settings.isOpen() ||
            placement.state.kind !== "idle"
          )
            return;
          this.view.showMessage(model.tryUpgradeTower(tower.id));
          refreshUpgradeHint();
        },
      );
      if (container) container.style.cursor = "pointer";
    };
    this.refreshHint = refreshUpgradeHint;
    gridView.group.on("pointermove.upgrade pointerenter.upgrade", () => {
      const tile = gridView.tileUnderMouse();
      const hoveredTower = model.towers.find(
        (tower) => tower.tile.x === tile?.x && tower.tile.y === tile?.y,
      );
      if (hoveredTower) hoveredTowerId = hoveredTower.id;
      refreshUpgradeHint();
    });
    const onSelectTower = () => {
      if (
        pending ||
        disposed ||
        this.model.isOver ||
        this.view.settings.isOpen() ||
        placement.state.kind !== "idle"
      ) {
        return;
      }

      const tile = gridView.tileUnderMouse();
      if (!tile) {
        selectedTowerId = null;
        hoveredTowerId = null;
        refreshUpgradeHint();
        return;
      }

      const tower = this.model.towers.find(
        (item) => item.tile.x === tile.x && item.tile.y === tile.y,
      );
      if (!tower) {
        selectedTowerId = null;
        hoveredTowerId = null;
        refreshUpgradeHint();
        return;
      }

      selectedTowerId = tower.id;
      refreshUpgradeHint();
    };

    gridView.group.on("click.upgrade tap.upgrade", onSelectTower);
    this.view.group.on("click.selection tap.selection", (event) => {
      const target = event.target;
      if (target.getAncestors().includes(gridView.group) || this.view.isTowerPanelTarget(target))
        return;
      selectedTowerId = null;
      hoveredTowerId = null;
      refreshUpgradeHint();
    });

    const requestPlace = async () => {
      const s = placement.state;
      if (!canCommit() || (s.kind !== "placed" && s.kind !== "configuring") || pending) return;
      const tile = s.pos;
      const config = s.kind === "configuring" ? s.config : undefined; // e.g. where the triangle aims

      // Check coins before asking, so the player isn't asked a question for a tower they can't buy.
      // tryPlaceTower checks again, because coins can change while the question is open.
      if (!this.model.wallet.canAfford(def.cost)) {
        placement.cancel();
        pv.hide();
        this.view.showMessage("Not enough coins");
        return;
      }

      pending = true;
      let ok = false;
      try {
        ok = await beforeCommit(tile, config);
      } finally {
        pending = false;
      }

      if (!ok || !canCommit()) {
        // A wrong answer, or closing the question with Esc or ✕, costs part of the tower's price.
        // Nothing is taken if the game ended or the screen closed while the question was open.
        if (canCommit()) {
          let lost = wrongAnswerCost(def);
          if (lost > this.model.wallet.coins) {
            lost = this.model.wallet.coins; // coins never go below 0
          }
          if (lost > 0) {
            this.model.wallet.spend(lost);
            this.view.showMessage(`−${lost} coins for the missed question`);
          }
        }
        placement.cancel();
        pv.hide();
        return;
      }

      const now = placement.state;
      if (
        (now.kind !== "placed" && now.kind !== "configuring") ||
        now.pos.x !== tile.x ||
        now.pos.y !== tile.y
      ) {
        return;
      }

      placement.confirm(); // state: idle
      pv.hide();
      const result = this.model.tryPlaceTower(def.id, tile, config);
      // TowersView draws successful placements through the towerPlaced event.
      // The answer counts as solved only now, once the tower is really on the map.
      if (result === "ok") {
        this.model.recordQuestionSolved();
        return;
      }

      if (result === "funds") {
        this.view.showMessage("Not enough coins");
      } else if (result === "locked") {
        this.view.showMessage("Unlock this tower in the Tower Shop first");
      } else if (result === "occupied") {
        this.view.showMessage("There is already a tower on this tile");
      } else {
        this.view.showMessage("Can't place a tower here");
      }
    };

    const onDown = () => {
      if (pending || !canCommit()) return;
      hoveredTowerId = null;
      selectedTowerId = null;
      refreshUpgradeHint();
      const tile = gridView.tileUnderMouse();
      if (tile) placement.startDrag(tile);
      gridView.showGrid(true);
    };

    const onMove = () => {
      if (pending) return; // the preview stays put while a question is open
      const s = placement.state;
      if (s.kind === "dragging") {
        const tile = gridView.tileUnderMouse();
        if (tile) pv.show(tile, canPlace(tile));
      } else if (s.kind === "configuring" && !aimLocked) {
        // Aim at the mouse: the cone's width or the block's size follows how far it is from the tower.
        const pointer = gridView.pointerInTiles();
        if (!pointer) return;
        const config = configFromPointer(def, s.pos, pointer);
        if (!config) return;
        placement.configure(config);
        pv.showConfig(s.pos, config);
      }
    };

    const onUp = () => {
      gridView.showGrid(false); // also when Escape already ended the drag
      if (placement.state.kind !== "dragging") return;
      const tile = gridView.tileUnderMouse();
      if (tile && canPlace(tile)) {
        placement.endDrag(tile, true); // state: placed, ghost stays
        pv.show(tile, true);
        pv.showPrompt(tile); // the confirm and cancel squares
        lockAim(false);
        const config = defaultConfig(def);
        if (config.kind !== "circle") {
          // a cone or block tower still needs aiming: show the default and follow the mouse from here
          placement.configure(config);
          pv.showConfig(tile, config);
        }
      } else {
        placement.cancel();
        pv.hide();
      }
    };

    const onMapClick = () => {
      if (pending || placement.state.kind !== "configuring") return;
      if (!gridView.tileUnderMouse()) return; // only a click on the map, not on the shop or buttons
      lockAim(!aimLocked);
    };

    const onKey = (e: KeyboardEvent) => {
      if (pending) return; // while a question is open, the prompt owns the keyboard
      if (this.view.settings.isOpen()) {
        return; // paused: Enter must not open a question behind the settings
      }
      if (e.key === "Enter") {
        void requestPlace();
      } else if (e.key === "Escape") {
        selectedTowerId = null;
        hoveredTowerId = null;
        refreshUpgradeHint();
        placement.cancel();
        pv.hide();
      }
    };

    // The squares at the tower do what Enter and Escape do
    const cancelPlacement = () => {
      if (pending || this.view.settings.isOpen()) return;
      placement.cancel();
      pv.hide();
    };
    const confirmPlacement = () => {
      if (this.view.settings.isOpen()) return;
      void requestPlace();
    };
    choices.forEach(({ view }) => {
      view.onConfirm = confirmPlacement;
      view.onCancel = cancelPlacement;
    });

    choices.forEach((choice) => {
      choice.card.group.on("pointerdown", () => {
        if (pending || this.model.isOver) return;

        placement.cancel();
        pv.hide();

        def = choice.tower;
        pv = choice.view;
        onDown();
      });
    });
    stage?.on("pointermove.placement", onMove);
    stage?.on("pointerdown.placement", onMapClick);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    this.cleanup = () => {
      // Invalidate pending answers before removing input handlers.
      disposed = true;
      selectedTowerId = null;
      hoveredTowerId = null;
      refreshUpgradeHint();
      this.refreshHint = () => {};
      placement.cancel();
      pv.hide();
      stage?.off(".placement");
      this.view.group.off(".selection");
      gridView.group.off(".upgrade");
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      for (const choice of choices) {
        choice.card.group.destroy();
        choice.view.group.destroy();
        choice.view.prompt.destroy();
      }
    };
  }
}
