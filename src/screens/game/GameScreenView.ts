import Konva from "konva";
import {
  ICON_BUTTON_SIZE,
  makeBackButton,
  makeButton,
  makeIconButton,
  makeSettingsButton,
} from "../button";
import {
  FONT,
  HEADER_BACKGROUND,
  PAGE_BACKGROUND,
  SIDEBAR_BORDER,
  SIDEBAR_FILL,
  TITLE_TEXT,
  WARNING_TEXT,
} from "../theme";
import { QuestionPrompt } from "./QuestionPrompt";
import { SettingsPanel } from "./SettingsPanel";
import type { Sound } from "../../core/Sound";
import type { QuestionService } from "../../model/questions/QuestionService";
import type { Vec } from "../../model/types";

export const TILE = 48; // pixels per tile, before the map is scaled to fit the window
const SHOP_WIDTH = 260;
const HUD_HEIGHT = 48;
const MARGIN = 24;
const MESSAGE_MS = 2000; // how long showMessage() keeps a message on screen
const SPEED_BUTTON_WIDTH = 72; // wider than the other icon buttons: it has a label too
const FAST_SPEED_COLOR = "#ffd53d"; // the speed button's sign and label at double speed

// Layout of the game screen: HUD bar on top, map below it, shop column on the right.
//
//   ┌─────────────────────────────────────┬────────┐
//   │ [←] coins · lives · wave [▶▶1x] [⚙] │  Shop  │
//   ├─────────────────────────────────────┤        │
//   │                 map                 │        │
//   └─────────────────────────────────────┴────────┘
//
// Anything drawn in tile pixels (map, enemies, towers, range preview) goes in mapGroup,
// which is scaled and centered automatically. HUD and shop are not scaled.
// The back arrow is only shown before the first wave; the gear opens the settings.
// The button left of the gear switches the game speed and shows the current one.
export class GameScreenView {
  group = new Konva.Group();
  mapGroup = new Konva.Group();
  shopGroup = new Konva.Group();
  startWaveButton: Konva.Group;
  backButton: Konva.Group;
  settingsButton: Konva.Group;
  speedButton: Konva.Group;
  readonly prompt: QuestionPrompt;
  readonly settings: SettingsPanel;

  private mapCols: number;
  private mapRows: number;
  // The same grey page and blue bar as the screens outside the game
  private background = new Konva.Rect({ fill: PAGE_BACKGROUND });
  private hudBar = new Konva.Rect({ height: HUD_HEIGHT, fill: HEADER_BACKGROUND });
  // Starts right of the back arrow
  private hudText = new Konva.Text({
    x: 72,
    y: 14,
    fontSize: 20,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: "white",
  });
  private timerText = new Konva.Text({
    x: 20,
    width: SHOP_WIDTH - 40,
    fontSize: 18,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    listening: false,
  });
  private shopBackground = new Konva.Rect({ fill: SIDEBAR_FILL, stroke: SIDEBAR_BORDER });
  private shopTitle = new Konva.Text({
    x: 20,
    y: 20,
    text: "Shop",
    fontSize: 22,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: TITLE_TEXT,
  });
  // A short message under the HUD, e.g. "Not enough coins". Hidden until showMessage() is called.
  private messageText = new Konva.Text({
    x: MARGIN,
    y: HUD_HEIGHT,
    fontSize: 18,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: WARNING_TEXT,
    visible: false,
  });
  // The speed button shows a fast-forward sign (two triangles pointing right) and "1x" or "2x"
  private speedArrowOne = new Konva.RegularPolygon({
    x: 15,
    y: ICON_BUTTON_SIZE / 2,
    sides: 3,
    radius: 7,
    rotation: 90,
    fill: "white",
  });
  private speedArrowTwo = new Konva.RegularPolygon({
    x: 26,
    y: ICON_BUTTON_SIZE / 2,
    sides: 3,
    radius: 7,
    rotation: 90,
    fill: "white",
  });
  private speedLabel = new Konva.Text({
    x: 34,
    text: "1x",
    width: 32,
    height: ICON_BUTTON_SIZE,
    align: "center",
    verticalAlign: "middle",
    fontSize: 18,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: "white",
  });
  private messageTimer = 0; // id of the timeout that hides the message
  // "Wave 3" across the top of the map when a wave starts. Invisible until showWaveBanner().
  private waveBanner = new Konva.Text({
    fontSize: 56,
    fontStyle: "bold",
    fontFamily: FONT,
    fill: "white",
    stroke: "#073c53",
    strokeWidth: 2,
    align: "center",
    opacity: 0,
    listening: false,
  });
  // A red frame around the map when a life is lost. Invisible until flashLeak().
  private leakFrame = new Konva.Rect({
    stroke: "#ff3b3b",
    strokeWidth: 10,
    opacity: 0,
    listening: false,
  });

  // onStartWave runs on Start Wave, onBack on the back arrow and on "Back to maps" in the
  // settings, onOpenSettings on the gear, onResume / onMainMenu on those settings buttons,
  // and onToggleSpeed on the speed button. The settings switch the sound on and off.
  constructor(
    mapCols: number,
    mapRows: number,
    onStartWave: () => void,
    onBack: () => void,
    onOpenSettings: () => void,
    onResume: () => void,
    onMainMenu: () => void,
    onToggleSpeed: () => void,
    questions: QuestionService,
    sound: Sound,
  ) {
    this.mapCols = mapCols;
    this.mapRows = mapRows;
    this.startWaveButton = makeButton("Start Wave", onStartWave);
    this.backButton = makeBackButton(onBack);
    this.backButton.position({ x: 16, y: 4 });
    this.settingsButton = makeSettingsButton(onOpenSettings);
    const speedIcon = new Konva.Group();
    speedIcon.add(this.speedArrowOne, this.speedArrowTwo, this.speedLabel);
    this.speedButton = makeIconButton("speed", speedIcon, onToggleSpeed, SPEED_BUTTON_WIDTH);
    this.prompt = new QuestionPrompt(questions);
    this.settings = new SettingsPanel(onResume, onBack, onMainMenu, sound);
    this.shopGroup.add(this.shopBackground, this.shopTitle, this.timerText);
    this.group.add(
      this.background,
      this.mapGroup,
      this.hudBar,
      this.hudText,
      this.shopGroup,
      this.startWaveButton,
      this.backButton,
      this.settingsButton,
      this.speedButton,
      this.messageText,
      this.leakFrame,
      this.waveBanner,
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

  // Shows the game speed on the speed button, e.g. "2x" for speed 2.
  setSpeed(speed: number): void {
    this.speedLabel.text(`${speed}x`);
    // Yellow while the game runs faster than normal, so the player can tell at a glance
    let color = "white";
    if (speed > 1) {
      color = FAST_SPEED_COLOR;
    }
    this.speedArrowOne.fill(color);
    this.speedArrowTwo.fill(color);
    this.speedLabel.fill(color);
  }

  setWaveTimers(preparation: number | null, lastSpawn: number | null, canStart: boolean): void {
    const seconds = preparation ?? lastSpawn;
    const text =
      seconds !== null && Number.isFinite(seconds)
        ? `${preparation !== null ? "Next Wave In" : "Last Enemy Spawns In"}: ${Math.ceil(Math.max(0, seconds))}s`
        : "";
    if (this.timerText.text() !== text) this.timerText.text(text);
    this.startWaveButton
      .findOne<Konva.Text>("Text")!
      .text(preparation !== null ? "Start Next Wave" : "Start Wave");
    this.startWaveButton.visible(canStart);
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

  // Shows the wave number over the map, then fades it out.
  showWaveBanner(wave: number): void {
    this.waveBanner.text(`Wave ${wave}`);
    this.waveBanner.opacity(1);
    new Konva.Tween({ node: this.waveBanner, duration: 1.5, opacity: 0 }).play();
  }

  // Flashes the red frame around the map.
  flashLeak(): void {
    this.leakFrame.opacity(1);
    new Konva.Tween({ node: this.leakFrame, duration: 0.4, opacity: 0 }).play();
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
    this.background.size({ width, height });
    this.hudBar.width(width - SHOP_WIDTH);
    this.shopGroup.x(width - SHOP_WIDTH);
    this.shopBackground.size({ width: SHOP_WIDTH, height });
    this.startWaveButton.position({ x: width - SHOP_WIDTH + 30, y: height - 80 });
    this.timerText.y(height - 140);
    // The gear sits at the right end of the HUD, just left of the shop
    this.settingsButton.position({ x: width - SHOP_WIDTH - 56, y: 4 });
    // The speed button sits left of the gear, with an 8 pixel gap
    this.speedButton.position({ x: width - SHOP_WIDTH - 56 - SPEED_BUTTON_WIDTH - 8, y: 4 });

    // Fit the map into the space left of the shop and below the HUD
    const areaWidth = width - SHOP_WIDTH - 2 * MARGIN;
    const areaHeight = height - HUD_HEIGHT - 2 * MARGIN;
    const scale = Math.min(areaWidth / (this.mapCols * TILE), areaHeight / (this.mapRows * TILE));
    this.mapGroup.scale({ x: scale, y: scale });
    this.mapGroup.position({
      x: MARGIN + (areaWidth - this.mapCols * TILE * scale) / 2,
      y: HUD_HEIGHT + MARGIN + (areaHeight - this.mapRows * TILE * scale) / 2,
    });
    // The frame and the banner follow the map: the frame around it, the banner near its top
    const mapWidth = this.mapCols * TILE * scale;
    const mapHeight = this.mapRows * TILE * scale;
    this.leakFrame.position(this.mapGroup.position());
    this.leakFrame.size({ width: mapWidth, height: mapHeight });
    this.waveBanner.position({ x: this.mapGroup.x(), y: this.mapGroup.y() + mapHeight * 0.2 });
    this.waveBanner.width(mapWidth);
    this.prompt.resize(width, height);
    this.settings.resize(width, height);
  }
}
