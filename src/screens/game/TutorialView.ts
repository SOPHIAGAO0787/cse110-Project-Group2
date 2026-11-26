import Konva from "konva";
import { BUTTON_HEIGHT, makeButton, setButtonLabel } from "../button";
import { CARD_BORDER, CARD_FILL, FONT, MUTED_TEXT, TITLE_TEXT } from "../theme";

// What the player can do that ends a tutorial step
export type TutorialAction = "question" | "towerPlaced" | "waveStarted" | "speed";

// One tip, and the action that ends it. The first and last tips end with a button instead.
interface TutorialStep {
  text: string;
  waitFor: TutorialAction | null;
}

const STEPS: TutorialStep[] = [
  { text: "New here? Take the 1-minute tour.", waitFor: null },
  {
    text: "Drag a tower from the shop to a tile that turns green, then press ✓ or Enter.",
    waitFor: "question",
  },
  {
    text: "Answer the question to build the tower. You can type π, fractions or decimals.",
    waitFor: "towerPlaced",
  },
  {
    text: "Press Start Wave. Stop the enemies before they reach the end of the path.",
    waitFor: "waveStarted",
  },
  { text: "Click the speed button or press Space to change the speed.", waitFor: "speed" },
  {
    text: "Each enemy you stop gives coins. Click a tower on the map for upgrade and sell options.",
    waitFor: null,
  },
];
const LAST_STEP = STEPS.length - 1;

const BOX_WIDTH = 480;
const PADDING = 16;
const GAP = 12; // between the tip and the buttons
const SMALL_BUTTON = 120;
const SKIP_BUTTON = 160; // wide enough for "Skip tutorial"

// A box at the bottom of the map that walks a new player through their first game.
//
//   ┌──────────────────────────────────────────────┐
//   │ Drag a tower from the shop onto a green      │
//   │ tile, then press ✓ or Enter.                 │
//   │ 1/5                        [ Skip tutorial ] │
//   └──────────────────────────────────────────────┘
//
// Each step waits until the player does what it says. Skip ends the tutorial at any step.
// Only the buttons take the mouse, so the player can still drop towers on the tiles under the box.
export class TutorialView {
  group = new Konva.Group({ name: "tutorial", visible: false });

  private background = new Konva.Rect({
    width: BOX_WIDTH,
    fill: CARD_FILL,
    stroke: CARD_BORDER,
    strokeWidth: 2,
    cornerRadius: 12,
    opacity: 0.95,
    listening: false,
  });
  private tip = new Konva.Text({
    name: "tutorial-tip",
    x: PADDING,
    y: PADDING,
    width: BOX_WIDTH - 2 * PADDING,
    fontSize: 18,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: TITLE_TEXT,
    lineHeight: 1.3,
    listening: false,
  });
  // "1/5" left of the buttons
  private counter = new Konva.Text({
    x: PADDING,
    height: BUTTON_HEIGHT,
    verticalAlign: "middle",
    fontSize: 16,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: MUTED_TEXT,
    listening: false,
  });
  private showMeButton: Konva.Group;
  private skipButton: Konva.Group;
  private doneButton: Konva.Group;

  private step = 0; // index into STEPS
  private done: TutorialAction[] = []; // everything the player has done since start()
  private onDone: () => void = () => {};
  // Where the box goes: the middle of its bottom edge, set by place()
  private centerX = 0;
  private bottomY = 0;

  constructor() {
    this.showMeButton = makeButton("Show me", () => this.goTo(1), SMALL_BUTTON);
    this.skipButton = makeButton("Skip", () => this.finish(), SKIP_BUTTON);
    this.doneButton = makeButton("Done", () => this.finish(), SMALL_BUTTON);
    this.group.add(
      this.background,
      this.tip,
      this.counter,
      this.showMeButton,
      this.skipButton,
      this.doneButton,
    );
  }

  // Shows the offer to take the tour. onDone runs once the player finishes or skips it.
  start(onDone: () => void): void {
    this.onDone = onDone;
    this.done = [];
    this.group.visible(true);
    this.goTo(0);
  }

  // Hides the tutorial without finishing it, e.g. when the game ends or the player leaves
  stop(): void {
    this.group.visible(false);
  }

  isShowing(): boolean {
    return this.group.visible();
  }

  stepText(): string {
    return this.tip.text();
  }

  // Tells the tutorial the player did something. It is remembered even if it is not the
  // current step's action yet, so the player is never asked to do what they already did.
  advance(action: TutorialAction): void {
    if (!this.isShowing()) {
      return;
    }
    this.done.push(action);
    if (this.step > 0) {
      this.goTo(this.step);
    }
  }

  // Puts the box with the middle of its bottom edge at this point
  place(centerX: number, bottomY: number): void {
    this.centerX = centerX;
    this.bottomY = bottomY;
    this.layout();
  }

  // Shows the step, or the first one after it the player has not done yet
  private goTo(step: number): void {
    let next = step;
    while (next < LAST_STEP && this.isDone(STEPS[next].waitFor)) {
      next = next + 1;
    }
    this.step = next;
    this.tip.text(STEPS[next].text);

    // The offer has Show me and Skip, the last step has Done, the rest have Skip tutorial
    const isOffer = next === 0;
    const isLast = next === LAST_STEP;
    this.showMeButton.visible(isOffer);
    this.doneButton.visible(isLast);
    this.skipButton.visible(!isLast);
    if (isOffer) {
      setButtonLabel(this.skipButton, "Skip");
      this.counter.text("");
    } else {
      setButtonLabel(this.skipButton, "Skip tutorial");
      this.counter.text(`${next}/${LAST_STEP}`);
    }
    this.layout();
  }

  private isDone(action: TutorialAction | null): boolean {
    if (action === null) {
      return false;
    }
    return this.done.includes(action);
  }

  private finish(): void {
    this.stop();
    this.onDone();
  }

  // Fits the box to the tip and lines the buttons up at its bottom right
  private layout(): void {
    const buttonsY = PADDING + this.tip.height() + GAP;
    const height = buttonsY + BUTTON_HEIGHT + PADDING;
    this.background.height(height);
    this.counter.y(buttonsY);

    // Skip and Done take the right end; Show me sits left of Skip
    const right = BOX_WIDTH - PADDING;
    this.doneButton.position({ x: right - SMALL_BUTTON, y: buttonsY });
    this.skipButton.position({ x: right - SKIP_BUTTON, y: buttonsY });
    this.showMeButton.position({ x: right - SKIP_BUTTON - GAP - SMALL_BUTTON, y: buttonsY });

    this.group.position({ x: this.centerX - BOX_WIDTH / 2, y: this.bottomY - height });
  }
}
