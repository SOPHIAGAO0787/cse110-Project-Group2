import Konva from "konva";
import { makeBackButton, makeButton, makeSettingsButton } from "../button";
import { QuestionPrompt } from "./QuestionPrompt";
import { SettingsPanel } from "./SettingsPanel";
import type { QuestionService } from "../../model/questions/QuestionService";
import type { Vec } from "../../model/types";

export const TILE = 48; // pixels per tile, before the map is scaled to fit the window
const SHOP_WIDTH = 260;
const HUD_HEIGHT = 48;
const MARGIN = 24;
const MESSAGE_MS = 2000; // how long showMessage() keeps a message on screen

// Layout of the game screen: HUD bar on top, map below it, shop column on the right.
//
//   ┌──────────────────────────────┬────────┐
//   │ [←] coins · lives · wave [⚙] │  Shop  │
//   ├──────────────────────────────┤        │
//   │            map               │        │
//   └──────────────────────────────┴────────┘
//
// Anything drawn in tile pixels (map, enemies, towers, range preview) goes in mapGroup,
// which is scaled and centered automatically. HUD and shop are not scaled.
// The back arrow is only shown before the first wave; the gear opens the settings.
export class GameScreenView {
  group = new Konva.Group();
  mapGroup = new Konva.Group();
  shopGroup = new Konva.Group();
  startWaveButton: Konva.Group;
  backButton: Konva.Group;
  settingsButton: Konva.Group;
  readonly prompt: QuestionPrompt;
  readonly settings: SettingsPanel;

  private mapCols: number;
  private mapRows: number;
  // Starts right of the back arrow
  private hudText = new Konva.Text({ x: 72, y: 14, fontSize: 20, fill: "white" });
  private shopBackground = new Konva.Rect({ fill: "#262637", stroke: "#3a3a52" });
  private shopTitle = new Konva.Text({ x: 20, y: 20, text: "Shop", fontSize: 22, fill: "white" });
  // A short message under the HUD, e.g. "Not enough coins". Hidden until showMessage() is called.
  private messageText = new Konva.Text({
    x: MARGIN,
    y: HUD_HEIGHT,
    fontSize: 18,
    fill: "#ff6b6b",
    visible: false,
  });
  private messageTimer = 0; // id of the timeout that hides the message

  // onStartWave runs on Start Wave, onBack on the back arrow and on "Back to maps" in the
  // settings, onOpenSettings on the gear, and onResume / onMainMenu on those settings buttons.
  constructor(
    mapCols: number,
    mapRows: number,
    onStartWave: () => void,
    onBack: () => void,
    onOpenSettings: () => void,
    onResume: () => void,
    onMainMenu: () => void,
    questions: QuestionService,
  ) {
    this.mapCols = mapCols;
    this.mapRows = mapRows;
    this.startWaveButton = makeButton("Start Wave", onStartWave);
    this.backButton = makeBackButton(onBack);
    this.backButton.position({ x: 16, y: 4 });
    this.settingsButton = makeSettingsButton(onOpenSettings);
    this.prompt = new QuestionPrompt(questions);
    this.settings = new SettingsPanel(onResume, onBack, onMainMenu);
    this.shopGroup.add(this.shopBackground, this.shopTitle);
    this.group.add(
      this.mapGroup,
      this.hudText,
      this.shopGroup,
      this.startWaveButton,
      this.backButton,
      this.settingsButton,
      this.messageText,
      this.prompt.group,
      this.settings.group,
    );
  }

  // Rewrites the HUD text. The controller calls this whenever one of these values changes.
  setHud(
    coins: number,
    lives: number,
    wave: number,
    totalWaves: number,
    enemiesRemaining: number,
  ): void {
    this.hudText.text(
      `Coins: ${coins}   ·   Lives: ${lives}   ·   Wave: ${wave}/${totalWaves}   ·   Enemies Remaining: ${enemiesRemaining}`,
    );
  }

  // Shows a message under the HUD for 2 seconds.
  showMessage(text: string): void {
    this.messageText.text(text);
    this.messageText.visible(true);
    // Restart the 2 seconds if a message is already showing, so the old timeout can't hide the new one
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.messageText.visible(false);
    }, MESSAGE_MS);
  }

  /* Converts a tile to a screen position (right edge, vertical middle),
  accounting for the map's scale and offset. Used to place the question popup. */
  tileToScreen(tile: Vec): Vec {
    return this.mapGroup.getAbsoluteTransform().point({
      x: (tile.x + 1) * TILE,
      y: (tile.y + 0.5) * TILE,
    });
  }

  resize(width: number, height: number): void {
    this.shopGroup.x(width - SHOP_WIDTH);
    this.shopBackground.size({ width: SHOP_WIDTH, height });
    this.startWaveButton.position({ x: width - SHOP_WIDTH + 30, y: height - 80 });
    // The gear sits at the right end of the HUD, just left of the shop
    this.settingsButton.position({ x: width - SHOP_WIDTH - 56, y: 4 });

    // Fit the map into the space left of the shop and below the HUD
    const areaWidth = width - SHOP_WIDTH - 2 * MARGIN;
    const areaHeight = height - HUD_HEIGHT - 2 * MARGIN;
    const scale = Math.min(areaWidth / (this.mapCols * TILE), areaHeight / (this.mapRows * TILE));
    this.mapGroup.scale({ x: scale, y: scale });
    this.mapGroup.position({
      x: MARGIN + (areaWidth - this.mapCols * TILE * scale) / 2,
      y: HUD_HEIGHT + MARGIN + (areaHeight - this.mapRows * TILE * scale) / 2,
    });
    this.prompt.resize(width, height);
    this.settings.resize(width, height);
  }
}
