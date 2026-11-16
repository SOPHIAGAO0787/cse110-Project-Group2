import Konva from "konva";
import type { Question, Vec } from "../../model/types";
import type { QuestionService } from "../../model/questions/QuestionService";
import { makeButton, makeClickable, setHoverCursor } from "../button";

const PANEL_W = 320;
const PAD = 16; // space around the edges of the panel
const SECTION_GAP = 12; // space between the question and the input box
const INPUT_H = 40;
const BUTTON_H = 48; // same as BUTTON_HEIGHT in button.ts
const MIN_FEEDBACK_H = 34; // room for two lines of feedback
const SYMBOLS = ["π", "√", "⌫", "C"];
const SYMBOL_W = 40;
const SYMBOL_H = 30;
const SYMBOL_GAP = 8;
const MAX_TYPED = 18; // what fits in the input box
const GAP = 16; // space between the tower tile and the popup
const DIM_OPACITY = 0.3; // set to 0 if you don't want the screen dimmed
const MAX_ATTEMPTS = 2; // total tries per question

export class QuestionPrompt {
  group = new Konva.Group({ visible: false });
  private dim = new Konva.Rect({ fill: "black", opacity: DIM_OPACITY }); // also blocks clicks on the map
  private panelGroup = new Konva.Group();
  private panel = new Konva.Rect({
    width: PANEL_W,
    fill: "#222",
    stroke: "white",
    strokeWidth: 2,
    cornerRadius: 8,
  });
  private promptText = new Konva.Text({
    x: 16,
    y: 16,
    width: PANEL_W - 32,
    fontSize: 18,
    fill: "white",
    align: "center",
  });
  private inputBox = new Konva.Rect({
    x: 60,
    y: 90,
    width: PANEL_W - 120,
    height: 40,
    fill: "white",
    cornerRadius: 4,
  });
  private inputText = new Konva.Text({
    x: 60,
    y: 90,
    width: PANEL_W - 120,
    height: 40,
    fontSize: 22,
    fill: "black",
    align: "center",
    verticalAlign: "middle",
    wrap: "none",
  });
  private cursorBar = new Konva.Rect({ y: 98, width: 2, height: 24, fill: "black" });
  private symbolRow = new Konva.Group({
    x: (PANEL_W - (SYMBOLS.length * SYMBOL_W + (SYMBOLS.length - 1) * SYMBOL_GAP)) / 2,
    y: 138,
  });
  private feedback = new Konva.Text({
    x: 16,
    y: 174,
    width: PANEL_W - 32,
    fontSize: 14,
    fill: "#ff6b6b",
    align: "center",
  });
  private submitButton: Konva.Group;
  private continueButton: Konva.Group;

  private service: QuestionService;
  private question: Question | null = null;
  private typed = "";
  private cursor = 0;
  private phase: "typing" | "wrong" = "typing";
  private resolve: ((correct: boolean) => void) | null = null;
  private attemptsLeft = 0;
  private width = 0;
  private height = 0;
  private panelH = 0; // set by layout(), because it depends on the question

  constructor(service: QuestionService) {
    this.service = service;

    this.submitButton = makeButton("Submit", () => this.submit());
    this.continueButton = makeButton("Continue", () => this.finish(false));
    this.submitButton.x(PANEL_W / 2 - 100);
    this.continueButton.x(PANEL_W / 2 - 100);
    this.continueButton.visible(false);

    SYMBOLS.forEach((symbol, i) => {
      const button = new Konva.Group({ x: i * (SYMBOL_W + SYMBOL_GAP) });
      button.add(
        new Konva.Rect({
          width: SYMBOL_W,
          height: SYMBOL_H,
          fill: "#3a3a52",
          stroke: "white",
          cornerRadius: 4,
        }),
        new Konva.Text({
          text: symbol,
          width: SYMBOL_W,
          height: SYMBOL_H,
          fontSize: 18,
          fill: "white",
          align: "center",
          verticalAlign: "middle",
          listening: false,
        }),
      );
      makeClickable(button, () => this.pressSymbol(symbol));
      this.symbolRow.add(button);
    });

    this.inputBox.on("click tap", () => this.placeCursorAtPointer());
    this.inputText.on("click tap", () => this.placeCursorAtPointer());

    setHoverCursor(this.inputBox, "text", () => this.phase === "typing");
    setHoverCursor(this.inputText, "text", () => this.phase === "typing");

    this.panelGroup.add(
      this.panel,
      this.promptText,
      this.inputBox,
      this.inputText,
      this.symbolRow,
      this.cursorBar,
      this.feedback,
      this.submitButton,
      this.continueButton,
    );
    this.group.add(this.dim, this.panelGroup);

    this.layout("");
  }

  // Stacks everything from the top down, so the panel is as tall as this question needs:
  // question, input box, symbol row, a reserved feedback area, then the buttons.
  private layout(hint: string): void {
    this.promptText.y(PAD);
    const inputY = PAD + this.promptText.height() + SECTION_GAP;
    this.inputBox.y(inputY);
    this.inputText.y(inputY);
    this.cursorBar.y(inputY + (INPUT_H - this.cursorBar.height()) / 2);

    const symbolsY = inputY + INPUT_H + 8;
    this.symbolRow.y(symbolsY);

    // Reserve room for the longest feedback this question can show, so the panel
    // doesn't change size when a hint appears.
    const feedbackY = symbolsY + SYMBOL_H + 8;
    this.feedback.y(feedbackY);
    this.feedback.text(`Not quite. ${hint} (${MAX_ATTEMPTS} tries left)`);
    const feedbackH = Math.max(this.feedback.height(), MIN_FEEDBACK_H);
    this.feedback.text("");

    const buttonsY = feedbackY + feedbackH + 10;
    this.submitButton.y(buttonsY);
    this.continueButton.y(buttonsY);

    this.panelH = buttonsY + BUTTON_H + PAD;
    this.panel.height(this.panelH);
  }

  // Shows the popup next to `anchor` (screen pixels, not map pixels).
  // Resolves true if the player answers correctly, false otherwise.
  ask(question: Question, anchor: Vec): Promise<boolean> {
    this.cancel(); // in case a previous question is somehow still open

    this.question = question;
    this.typed = "";
    this.cursor = 0;
    this.phase = "typing";
    this.attemptsLeft = MAX_ATTEMPTS;
    this.submitButton.visible(true);
    this.continueButton.visible(false);
    this.symbolRow.visible(true);
    this.cursorBar.visible(true);
    this.promptText.text(question.prompt);
    this.layout(question.hint); // must come before placeNear, which needs panelH
    this.refreshInput();
    this.feedback.text("");
    this.placeNear(anchor);

    this.group.visible(true);
    window.addEventListener("keydown", this.onKeyDown);
    this.redraw();

    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  // Closes the popup and resolves false. Call this from the controller's hide().
  cancel(): void {
    if (this.resolve !== null) {
      this.finish(false);
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dim.size({ width, height });
  }

  // Puts the popup to the right of the anchor, flipping left if it would run off screen
  private placeNear(anchor: Vec): void {
    let x = anchor.x + GAP;
    if (x + PANEL_W > this.width) {
      x = anchor.x - GAP - PANEL_W;
    }
    const y = Math.min(
      Math.max(anchor.y - this.panelH / 2, 0),
      Math.max(this.height - this.panelH, 0),
    );
    this.panelGroup.position({ x: Math.max(x, 0), y });
  }

  // Adds text at the cursor, unless the box is full
  private insert(text: string): void {
    if (this.typed.length + text.length > MAX_TYPED) return;
    this.typed = this.typed.slice(0, this.cursor) + text + this.typed.slice(this.cursor);
    this.cursor += text.length;
  }

  // Removes the character before the cursor
  private deleteBefore(): void {
    if (this.cursor === 0) return;
    this.typed = this.typed.slice(0, this.cursor - 1) + this.typed.slice(this.cursor);
    this.cursor -= 1;
  }

  // Used by the on-screen buttons: adds a symbol, or removes the last character for ⌫
  private pressSymbol(symbol: string): void {
    if (this.question === null || this.phase !== "typing") return;
    if (symbol === "C") {
      this.typed = "";
      this.cursor = 0;
    } else if (symbol === "⌫") {
      this.deleteBefore();
    } else {
      this.insert(symbol);
    }
    this.refreshInput();
  }

  // Moves the cursor to the gap between characters closest to where the player clicked
  private placeCursorAtPointer(): void {
    if (this.question === null || this.phase !== "typing") return;
    const pointer = this.panelGroup.getRelativePointerPosition();
    if (pointer === null) return;

    // Same math as refreshInput: where the centered text starts
    const boxCenter = this.inputText.x() + this.inputText.width() / 2;
    const textStart = boxCenter - this.measure(this.typed) / 2;
    const clickX = pointer.x - textStart;

    // Pick the gap (0..length) whose position is closest to the click
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= this.typed.length; i++) {
      const distance = Math.abs(this.measure(this.typed.slice(0, i)) - clickX);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    this.cursor = best;
    this.refreshInput();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.finish(false); // close without placing the tower
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (this.phase === "typing") this.submit();
      else this.finish(false);
      return;
    }
    if (this.phase !== "typing") return;

    if (e.key === "Backspace") {
      e.preventDefault(); // stop the browser navigating back
      this.deleteBefore();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.cursor = Math.max(0, this.cursor - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.cursor = Math.min(this.typed.length, this.cursor + 1);
    } else if (/^[0-9./\-()^*+]$/.test(e.key)) {
      this.insert(e.key);
    } else {
      return;
    }
    this.refreshInput();
  };

  private submit(): void {
    if (this.question === null || this.phase !== "typing") return;

    // Blank or whitespace-only: don't count it as an attempt
    if (this.typed.trim() === "") {
      this.feedback.text("Type an answer before submitting.");
      this.redraw();
      return;
    }

    this.attemptsLeft -= 1;

    if (this.service.check(this.question, this.typed)) {
      this.finish(true);
    } else if (this.attemptsLeft > 0) {
      // wrong, but the player gets another try: show the hint and clear the input
      const left = this.attemptsLeft === 1 ? "1 try left" : `${this.attemptsLeft} tries left`;
      this.feedback.text(`Not quite. ${this.question.hint} (${left})`);
      this.typed = "";
      this.cursor = 0;
      this.refreshInput(); // also redraws
    } else {
      // out of tries: the player can only dismiss the popup
      this.phase = "wrong";
      this.symbolRow.visible(false);
      this.cursorBar.visible(false);
      this.feedback.text(`Not quite. ${this.question.hint}`);
      this.submitButton.visible(false);
      this.continueButton.visible(true);
      this.redraw();
    }
  }

  private finish(correct: boolean): void {
    window.removeEventListener("keydown", this.onKeyDown);
    document.body.style.cursor = "default"; // the mouse may still be over a button
    this.group.visible(false);
    this.redraw();
    const resolve = this.resolve;
    this.resolve = null;
    this.question = null;
    resolve?.(correct);
  }

  private refreshInput(): void {
    this.inputText.text(this.typed);

    // Width of everything typed, and of the part before the cursor
    const fullWidth = this.measure(this.typed);
    const beforeWidth = this.measure(this.typed.slice(0, this.cursor));

    // Centered text starts at the box's center minus half its width
    const boxCenter = this.inputText.x() + this.inputText.width() / 2;
    const textStart = boxCenter - fullWidth / 2;

    this.cursorBar.x(textStart + beforeWidth);
    this.redraw();
  }

  // How wide this text is when drawn in the input box's font
  private measure(text: string): number {
    const probe = new Konva.Text({
      text,
      fontSize: this.inputText.fontSize(),
      fontFamily: this.inputText.fontFamily(),
    });
    const width = probe.width();
    probe.destroy();
    return width;
  }

  private redraw(): void {
    this.group.getLayer()?.batchDraw();
  }
}
