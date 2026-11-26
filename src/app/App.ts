import Konva from "konva";
import { GameScreenController } from "../screens/game/GameScreenController";
import { MapSelectScreen } from "../screens/MapSelectScreen";
import { MenuScreen } from "../screens/MenuScreen";
import { GeometryMiniGameScreen } from "../screens/minigame/GeometryMiniGameScreen";
import { MinigameSelectScreen } from "../screens/minigame/MinigameSelectScreen";
import { RoomBuilderScreen } from "../screens/minigame/RoomBuilderScreen";
import { ResultScreen } from "../screens/ResultScreen";
import type { GameResult } from "../model/GameResult";
import { MAPS } from "../model/loadContent";
import { Progress } from "../model/Progress";
import { loadGame, loadSettings, saveGame, saveSettings } from "../model/saveGame";
import type { Screen, ScreenName, ScreenSwitcher } from "./types";
import { TowerShopScreen } from "../screens/shop/TowerShopScreen";
import { TowerProgress } from "../model/TowerProgress";
import { Sound } from "../core/Sound";

// Owns the Konva stage and switches between screens.
export class App implements ScreenSwitcher {
  private stage: Konva.Stage;
  private layer = new Konva.Layer();
  // Shared by the menu, map and game screens: the chosen map, each map's best stars, bonus coins
  private progress = new Progress(MAPS);
  private sound = new Sound(); // the music plays on every screen; the game screen adds effects
  private menu: MenuScreen;
  private maps: MapSelectScreen;
  private game: GameScreenController;
  private result: ResultScreen;
  private current: Screen;
  private shop: TowerShopScreen;
  private towerProgress = new TowerProgress();
  private miniGame: GeometryMiniGameScreen;
  private minigames: MinigameSelectScreen;
  private roomBuilder: RoomBuilderScreen;

  constructor(containerId: string) {
    this.stage = new Konva.Stage({ container: containerId });
    this.stage.add(this.layer);
    // Pick up where the player left off, before the screens read the progress
    loadGame(this.progress, this.towerProgress);
    loadSettings(this.sound);
    this.sound.onChange = () => saveSettings(this.sound);

    this.menu = new MenuScreen(this, this.progress, this.sound);
    this.maps = new MapSelectScreen(this, this.progress);
    this.game = new GameScreenController(this, this.progress, this.towerProgress, this.sound);
    this.result = new ResultScreen(this);
    this.shop = new TowerShopScreen(this, this.towerProgress, () => this.save(), this.sound);
    this.minigames = new MinigameSelectScreen(this);
    this.roomBuilder = new RoomBuilderScreen(
      (earnedCoins) => {
        const awarded = this.progress.addRoomBuilderReward(earnedCoins);
        this.save();
        return awarded;
      },
      () => this.switchTo("minigame"),
      () => this.switchTo("menu"),
      (effect) => this.sound.play(effect),
    );
    // A finished mini-game round turns its correct answers into bonus coins for the next game
    this.miniGame = new GeometryMiniGameScreen(
      (result) => {
        this.progress.addMiniGameReward(result.correctAnswers);
        this.save();
      },
      () => this.switchTo("menu"),
    );
    for (const screen of this.allScreens()) {
      this.layer.add(screen.group);
      screen.group.visible(false);
    }

    this.current = this.menu;
    this.current.show();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    // Browsers block sound until the player's first click, so the music starts on that click
    window.addEventListener("pointerdown", () => this.sound.startMusic(), { once: true });
  }

  switchTo(name: ScreenName, data?: GameResult): void {
    this.current.hide();
    if (name === "menu") {
      this.current = this.menu;
    } else if (name === "maps") {
      this.current = this.maps;
    } else if (name === "game") {
      this.current = this.game;
    } else if (name === "shop") {
      this.current = this.shop;
    } else if (name === "minigame") {
      this.current = this.minigames;
    } else if (name === "quiz") {
      this.current = this.miniGame;
    } else if (name === "roomBuilder") {
      this.current = this.roomBuilder;
    } else {
      // The game screen has already recorded the finished game, so this is the moment to save it
      this.current = this.result;
      this.save();
    }
    this.current.show(data);
  }

  // Called after each finished game, shop purchase and mini-game round
  private save(): void {
    saveGame(this.progress, this.towerProgress);
  }

  private allScreens(): Screen[] {
    return [
      this.menu,
      this.maps,
      this.game,
      this.result,
      this.shop,
      this.minigames,
      this.miniGame,
      this.roomBuilder,
    ];
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.stage.size({ width, height });
    for (const screen of this.allScreens()) {
      screen.resize(width, height);
    }
  }
}
