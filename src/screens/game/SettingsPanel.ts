import Konva from "konva";
import type { Sound } from "../../core/Sound";
import { DEFAULT_BUTTON_WIDTH, makeButton, setButtonLabel } from "../button";
import { FONT } from "../theme";

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 436;

// The settings box over a dimmed screen, opened with the gear button on the game screen.
// The game is paused while it is open; the controller does the pausing.
//
//   ┌── Settings ──────┐
//   │  [ Resume ]      │
//   │  [ Music: On ]   │
//   │  [ Sound: On ]   │
//   │  [ Back to maps ]│
//   │  [ Main menu ]   │
//   └──────────────────┘
export class SettingsPanel {
  group = new Konva.Group({ visible: false });
  private dim = new Konva.Rect({ fill: "black", opacity: 0.5 }); // also blocks clicks on the game
  private box = new Konva.Group();
  private sound: Sound;
  private musicButton: Konva.Group;
  private effectsButton: Konva.Group;
  private panelHeight: number;

  constructor(
    onResume: () => void,
    onBackToMaps: () => void,
    onMainMenu: () => void,
    sound: Sound,
    mode: "game" | "shop" = "game",
  ) {
    this.sound = sound;
    this.panelHeight = mode === "shop" ? 232 : PANEL_HEIGHT;
    if (mode === "shop") this.dim.on("click tap", () => this.close());
    const panel = new Konva.Rect({
      width: PANEL_WIDTH,
      height: this.panelHeight,
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
    // The two switches get their labels in refreshSoundLabels()
    this.musicButton = makeButton("", () => {
      this.sound.toggleMusic();
      this.refreshSoundLabels();
    });
    this.effectsButton = makeButton("", () => {
      this.sound.toggleEffects();
      this.refreshSoundLabels();
    });
    this.refreshSoundLabels();
    const mapsButton = makeButton("Back to maps", onBackToMaps);
    const menuButton = makeButton(mode === "shop" ? "Back to main menu" : "Main menu", onMainMenu);
    // Center the buttons in the box
    const buttonX = (PANEL_WIDTH - DEFAULT_BUTTON_WIDTH) / 2;
    resumeButton.position({ x: buttonX, y: 84 });
    this.musicButton.position({ x: buttonX, y: 152 });
    this.effectsButton.position({ x: buttonX, y: 220 });
    mapsButton.position({ x: buttonX, y: 288 });
    menuButton.position({ x: buttonX, y: 356 });

    this.box.add(panel, title);
    if (mode === "shop") {
      this.musicButton.y(84);
      menuButton.y(152);
      this.box.add(this.musicButton, menuButton);
    } else {
      this.box.add(resumeButton, this.musicButton, this.effectsButton, mapsButton, menuButton);
    }
    this.group.add(this.dim, this.box);
  }

  // Each switch shows whether its kind of sound is on
  private refreshSoundLabels(): void {
    if (this.sound.musicOn) {
      setButtonLabel(this.musicButton, "Music: On");
    } else {
      setButtonLabel(this.musicButton, "Music: Off");
    }
    if (this.sound.effectsOn) {
      setButtonLabel(this.effectsButton, "Sound: On");
    } else {
      setButtonLabel(this.effectsButton, "Sound: Off");
    }
  }

  isOpen(): boolean {
    return this.group.visible();
  }

  open(): void {
    this.refreshSoundLabels();
    this.group.visible(true);
  }

  close(): void {
    this.group.visible(false);
  }

  // Covers the whole screen and keeps the box in the middle
  resize(width: number, height: number): void {
    this.dim.size({ width, height });
    this.box.position({ x: (width - PANEL_WIDTH) / 2, y: (height - this.panelHeight) / 2 });
  }
}
