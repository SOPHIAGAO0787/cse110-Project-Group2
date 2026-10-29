import Konva from "konva";
import { makeButton } from "../button";

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
  shopGroup = new Konva.Group(); // TODO(J1): add tower cards here
  startWaveButton: Konva.Group;

  private mapCols: number;
  private mapRows: number;
  private hudText = new Konva.Text({ x: MARGIN, y: 14, fontSize: 20, fill: "white" });
  private shopBackground = new Konva.Rect({ fill: "#262637", stroke: "#3a3a52" });
  private shopTitle = new Konva.Text({ x: 20, y: 20, text: "Shop", fontSize: 22, fill: "white" });

  // onStartWave runs when the player clicks the Start Wave button.
  constructor(mapCols: number, mapRows: number, onStartWave: () => void) {
    this.mapCols = mapCols;
    this.mapRows = mapRows;
    this.startWaveButton = makeButton("Start Wave", onStartWave);
    this.shopGroup.add(this.shopBackground, this.shopTitle);
    this.group.add(this.mapGroup, this.hudText, this.shopGroup, this.startWaveButton);
  }

  // TODO(St1, N1, M3): call this when coins, lives, wave number, or remaining enemies changes
  setHud(coins: number, lives: number, wave: number, totalWaves: number, enemiesRemaining: number): void {
    this.hudText.text(`Coins: ${coins}   ·   Lives: ${lives}   ·   Wave: ${wave}/${totalWaves}   ·   Enemies Remaining: ${enemiesRemaining}`);
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
  }
}
