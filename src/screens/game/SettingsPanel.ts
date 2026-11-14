import Konva from "konva";
import { makeButton } from "../button";
import { FONT } from "../theme";

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 300;

// The settings box over a dimmed screen, opened with the gear button on the game screen.
// The game is paused while it is open; the controller does the pausing.
//
//   ┌── Settings ──────┐
//   │  [ Resume ]      │
//   │  [ Back to maps ]│
//   │  [ Main menu ]   │
//   └──────────────────┘
export class SettingsPanel {
  group = new Konva.Group({ visible: false });
  private dim = new Konva.Rect({ fill: "black", opacity: 0.5 }); // also blocks clicks on the game
  private box = new Konva.Group();

  constructor(onResume: () => void, onBackToMaps: () => void, onMainMenu: () => void) {
    const panel = new Konva.Rect({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      fill: "#222",
      stroke: "white",
      strokeWidth: 2,
      cornerRadius: 8,
    });
    const title = new Konva.Text({
      y: 24,
      width: PANEL_WIDTH,
      text: "Settings",
      align: "center",
      fontSize: 26,
      fontFamily: FONT,
      fontStyle: "bold",
      fill: "white",
    });
    const resumeButton = makeButton("Resume", onResume);
    const mapsButton = makeButton("Back to maps", onBackToMaps);
    const menuButton = makeButton("Main menu", onMainMenu);
    // Buttons are 200 wide; center them in the box
    resumeButton.position({ x: (PANEL_WIDTH - 200) / 2, y: 84 });
    mapsButton.position({ x: (PANEL_WIDTH - 200) / 2, y: 152 });
    menuButton.position({ x: (PANEL_WIDTH - 200) / 2, y: 220 });

    this.box.add(panel, title, resumeButton, mapsButton, menuButton);
    this.group.add(this.dim, this.box);
  }

  isOpen(): boolean {
    return this.group.visible();
  }

  open(): void {
    this.group.visible(true);
  }

  close(): void {
    this.group.visible(false);
  }

  // Covers the whole screen and keeps the box in the middle
  resize(width: number, height: number): void {
    this.dim.size({ width, height });
    this.box.position({ x: (width - PANEL_WIDTH) / 2, y: (height - PANEL_HEIGHT) / 2 });
  }
}
