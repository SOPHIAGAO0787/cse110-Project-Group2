import type Konva from "konva";
import { GameLoop } from "../../core/GameLoop";
import { GameModel } from "../../model/GameModel";
import { loadMap } from "../../model/loadContent";
import type { MapConfig } from "../../model/types";
import type { Screen, ScreenSwitcher } from "../../app/types";
import map1 from "../../data/maps/map1.json";
import { GameScreenView } from "./GameScreenView";
import { GridView } from "./GridView";

// Connects the game model to the screen: input → model, model events → views.
// Each "WIRE" comment marks where a task plugs in. Only edit your own spots.
export class GameScreenController implements Screen {
  group: Konva.Group;
  private app: ScreenSwitcher;
  private map: MapConfig;
  private view: GameScreenView;
  private model: GameModel;
  private loop: GameLoop;

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
    this.view.mapGroup.add(
      new GridView(this.map, (tile) => this.model.grid.isBuildable(tile)).group,
    );
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
    this.loop.stop();
    this.model.events.clear();
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.view.resize(width, height);
  }
}
