import Konva from "konva";
import { makeButton } from "../button";
import { QuestionPrompt } from "./QuestionPrompt";
import type { QuestionService } from "../../model/questions/QuestionService";
import type { Vec } from "../../model/types";

export const TILE = 48; // pixels per tile, before the map is scaled to fit the window
const SHOP_WIDTH = 260;
const HUD_HEIGHT = 48;
const MARGIN = 24;

// Layout of the game screen: HUD bar on top, map below it, shop column on the right.
//
//   ┌──────────────────────────────┬────────┐
//   │ HUD: coins · lives · wave    │  Shop  │
//   ├──────────────────────────────┤        │
//   │            map               │        │
//   └──────────────────────────────┴────────┘
//
// Anything drawn in tile pixels (map, enemies, towers, range preview) goes in mapGroup,
// which is scaled and centered automatically. HUD and shop are not scaled.
export class GameScreenView {
  group = new Konva.Group();
  mapGroup = new Konva.Group();
  shopGroup = new Konva.Group();
  startWaveButton: Konva.Group;
  readonly prompt: QuestionPrompt;

  private mapCols: number;
  private mapRows: number;
  private hudText = new Konva.Text({ x: MARGIN, y: 14, fontSize: 20, fill: "white" });
  private shopBackground = new Konva.Rect({ fill: "#262637", stroke: "#3a3a52" });
  private shopTitle = new Konva.Text({ x: 20, y: 20, text: "Shop", fontSize: 22, fill: "white" });

  // onStartWave runs when the player clicks the Start Wave button.
  constructor(
    mapCols: number,
    mapRows: number,
    onStartWave: () => void,
    questions: QuestionService,
  ) {
    this.mapCols = mapCols;
    this.mapRows = mapRows;
    this.startWaveButton = makeButton("Start Wave", onStartWave);
    this.prompt = new QuestionPrompt(questions);
    this.shopGroup.add(this.shopBackground, this.shopTitle);
    this.group.add(
      this.mapGroup,
      this.hudText,
      this.shopGroup,
      this.startWaveButton,
      this.prompt.group,
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
  }
}
