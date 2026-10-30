import type Konva from "konva";
import { GameLoop } from "../../core/GameLoop";
import { GameModel } from "../../model/GameModel";
import { loadMap } from "../../model/loadContent";
import type { MapConfig, Vec } from "../../model/types";
import type { Screen, ScreenSwitcher } from "../../app/types";
import map1 from "../../data/maps/map1.json";
import { GameScreenView } from "./GameScreenView";
import { GridView } from "./GridView";
import { PlacementModel } from "../../model/PlacementModel";
import { PlacementView } from "../../ui/PlacementView";
import { TOWERS } from "../../model/loadContent"; //import loadMAP once we start working on stages

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

  constructor(app: ScreenSwitcher) {
    this.app = app;
    this.map = loadMap(map1);
    this.view = new GameScreenView(this.map.cols, this.map.rows, () => this.model.startNextWave());
    this.group = this.view.group;

    // A real game is created in show(). These are only here so the fields are never empty.
    this.model = new GameModel(this.map);
    this.loop = new GameLoop((dt) => this.model.tick(dt));
  }

  // Called every time the player enters the game screen: starts a fresh game.
  show(): void {
    this.model = new GameModel(this.map);
    this.loop = new GameLoop((dt) => this.model.tick(dt));
    this.view.mapGroup.destroyChildren();

    const gridView = new GridView(this.map, (tile) => this.model.grid.isBuildable(tile));
    this.view.mapGroup.add(gridView.group);
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

    // WIRE(St1): update the HUD on "coinsChanged"
    // WIRE(N1): update the HUD on "waveStarted" / "waveCleared"
    // WIRE(M3): update the HUD on "livesChanged"
    // WIRE(R1): add EnemiesView to this.view.mapGroup and sync it every frame
    // WIRE(R3): add TowersView to this.view.mapGroup
    // WIRE(B1): click to place a tower on the map
    // WIRE(B2): show the tower's range under the mouse before it is placed
    // WIRE(J1): shop cards in this.view.shopGroup
    // WIRE(So2): click a shop card to choose the tower to place
    // WIRE(J2): show a message when the player can't afford a tower
    // WIRE(M2): ask a question before a tower is placed

    this.group.visible(true);
    this.loop.start();
  }

  hide(): void {
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
    this.view.mapGroup.add(pv.group); // after the grid, so it draws on top
    this.view.shopGroup.add(pv.menuCircle);

    const stage = this.group.getStage();
    const canPlace = (t: Vec) => this.model.grid.isBuildable(t);
    const beforeCommit = async (_tile: Vec): Promise<boolean> => true;
    let pending = false; // blocks double-triggers while a question is open
    const requestPlace = async () => {
      const s = placement.state;
      if (s.kind !== "placed" || pending) return;
      const tile = s.pos;

      pending = true;
      const ok = await beforeCommit(tile);
      pending = false;

      const now = placement.state;
      if (!ok || now.kind !== "placed" || now.pos.x !== tile.x || now.pos.y !== tile.y) return;

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
      if (e.key === "Enter") {
        void requestPlace();
      } else if (e.key === "Escape") {
        placement.cancel();
        pv.hide();
      }
    };
    // Click to confirm functionality, waiting on other implementation before using/deleting
    // const onMapClick = () => {
    //   const s = placement.state;
    //   const tile = gridView.tileUnderMouse();
    //   // clicking the dropped ghost's tile confirms it
    //   if (s.kind === "placed" && tile && tile.x === s.pos.x && tile.y === s.pos.y) {
    //     void requestPlace();
    //   }
    // };

    // gridView.group.on("click", onMapClick);

    pv.menuCircle.on("pointerdown", onDown);
    stage?.on("pointermove.placement", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      // called from hide()
      stage?.off(".placement");
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      pv.menuCircle.destroy();
    };
  }

  private commitTower(tile: Vec): boolean {
    if (!this.model.grid.isBuildable(tile)) return false;
    this.model.grid.occupy(tile);
    return true;
  }
}
