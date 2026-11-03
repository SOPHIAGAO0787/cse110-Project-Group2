import type Konva from "konva";
import { GameLoop } from "../../core/GameLoop";
import { GameModel } from "../../model/GameModel";
import { loadMap, TOWERS } from "../../model/loadContent";
import type { MapConfig, Vec } from "../../model/types";
import type { Screen, ScreenSwitcher } from "../../app/types";
import map1 from "../../data/maps/map1.json";
import { GameScreenView } from "./GameScreenView";
import { GridView } from "./GridView";
import { PlacementModel } from "../../model/PlacementModel";
import { PlacementView } from "./PlacementView";
import { QuestionService } from "../../model/questions/QuestionService";
import { EnemiesView } from "./EnemiesView";
import { InGameTowerCard } from "./InGameTowerCard";

// Connects the game model to the screen: input → model, model events → views.
// Each "WIRE" comment marks where a task plugs in. Only edit your own spots.
export class GameScreenController implements Screen {
  group: Konva.Group;
  private app: ScreenSwitcher;
  private map: MapConfig;
  private view: GameScreenView;
  private model: GameModel;
  private loop: GameLoop;
  private cleanupPlacement: (() => void) | null = null;
  private questions = new QuestionService();
  private active = false; // false while the screen is hidden

  constructor(app: ScreenSwitcher) {
    this.app = app;
    this.map = loadMap(map1);
    this.view = new GameScreenView(
      this.map.cols,
      this.map.rows,
      () => this.model.startNextWave(),
      this.questions,
    );
    this.group = this.view.group;

    // A real game is created in show(). These are only here so the fields are never empty.
    this.model = new GameModel(this.map);
    this.loop = new GameLoop((dt) => this.model.tick(dt));
  }

  // Called every time the player enters the game screen: starts a fresh game.
  show(): void {
    this.model = new GameModel(this.map);

    // R1: create the enemy view
    const enemiesView = new EnemiesView();

    this.loop = new GameLoop((dt) => {
      this.model.tick(dt);
      enemiesView.sync(this.model.enemies); // R1: update the enemy view with the current model state
    });
    this.view.mapGroup.destroyChildren();

    const gridView = new GridView(this.map, (tile) => this.model.grid.isBuildable(tile));

    //Draw the grid and render enemies over it
    this.view.mapGroup.add(gridView.group);
    this.view.mapGroup.add(enemiesView.group); // R1: add the enemy view to the map group

    this.cleanupPlacement = this.wirePlacement(gridView);

    const refreshHud = () => {
      this.view.setHud(
        this.model.wallet.coins,
        this.model.lives.remaining,
        this.model.waves.currentWave,
        this.model.waves.totalWaves,
        this.model.waves.enemiesLeft,
      );
    };

    refreshHud();
    const events = this.model.events;
    events.on("gameOver", (e) => this.app.switchTo("result", { won: e.won }));

    events.on("coinsChanged", refreshHud);
    events.on("livesChanged", refreshHud);
    events.on("waveStarted", refreshHud);
    events.on("waveCleared", refreshHud);
    events.on("enemyKilled", refreshHud);
    events.on("enemyLeaked", refreshHud);

    // WIRE(R3): add TowersView to this.view.mapGroup
    // WIRE(So2): click a shop card to choose the tower to place

    this.active = true;
    this.group.visible(true);
    this.loop.start();
  }

  hide(): void {
    this.active = false;
    this.view.prompt.cancel(); // closes the popup and removes its key listener
    this.cleanupPlacement?.();
    this.cleanupPlacement = null;
    this.loop.stop();
    this.model.events.clear();
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.view.resize(width, height);
  }

  private wirePlacement(gridView: GridView): () => void {
    const placement = new PlacementModel();
    const def = TOWERS.find((d) => d.id === "circle")!;
    const pv = new PlacementView(def.range.radius);
    this.view.mapGroup.add(pv.group);

    const card = new InGameTowerCard(def, pv.menuCircle);
    this.view.shopGroup.add(card.group);

    const stage = this.group.getStage();
    const canPlace = (t: Vec) => this.model.grid.isBuildable(t);

    // Asks the question and returns true only if the player answered correctly.
    const beforeCommit = async (tile: Vec): Promise<boolean> => {
      const question = this.questions.questionFor(def);
      this.loop.stop(); // pause the game while the question is open
      const correct = await this.view.prompt.ask(question, this.view.tileToScreen(tile));
      if (this.active) this.loop.start(); // don't restart if the player left the screen
      return correct;
    };

    let pending = false; // blocks double-triggers while a question is open
    const requestPlace = async () => {
      const s = placement.state;
      if (s.kind !== "placed" || pending) return;
      const tile = s.pos;

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
        ok = await beforeCommit(tile);
      } finally {
        pending = false;
      }

      if (!ok) {
        placement.cancel();
        pv.hide();
        return;
      }

      const now = placement.state;
      if (now.kind !== "placed" || now.pos.x !== tile.x || now.pos.y !== tile.y) return;

      placement.confirm(); // state: idle
      pv.hide();
      if (this.commitTower(tile)) pv.addTower(tile);
    };

    const onDown = () => {
      const tile = gridView.tileUnderMouse();
      if (tile) placement.startDrag(tile);
    };

    const onMove = () => {
      if (placement.state.kind !== "dragging") return;
      const tile = gridView.tileUnderMouse();
      if (tile) pv.show(tile, canPlace(tile));
    };

    const onUp = () => {
      if (placement.state.kind !== "dragging") return;
      const tile = gridView.tileUnderMouse();
      if (tile && canPlace(tile)) {
        placement.endDrag(tile, true); // state: placed, ghost stays
        pv.show(tile, true);
      } else {
        placement.cancel();
        pv.hide();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (pending) return; // while a question is open, the prompt owns the keyboard
      if (e.key === "Enter") {
        void requestPlace();
      } else if (e.key === "Escape") {
        placement.cancel();
        pv.hide();
      }
    };

    card.group.on("pointerdown", onDown);
    stage?.on("pointermove.placement", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      // called from hide()
      stage?.off(".placement");
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      card.group.destroy();
    };
  }

  private commitTower(tile: Vec): boolean {
    return this.model.tryPlaceTower("circle", tile) === "ok";
  }
}
