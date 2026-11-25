// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOSE_TEXT, WIN_TEXT } from "../screens/theme";
import { App } from "./App";

const stages = Konva.stages;
let stage: Konva.Stage;
let app: App;
let useFixedQuizQuestions: boolean;

function visibleText() {
  return stage.find<Konva.Text>("Text").filter((node) => node.isVisible());
}

function texts() {
  return visibleText().map((node) => node.text());
}

function button(label: string) {
  const text = visibleText().find((node) => node.text() === label);
  if (!text) throw new Error(`No visible "${label}" button`);
  return text.getParent()!;
}

function click(label: string) {
  button(label).fire("click");
}

function pointer(type: string, node: Konva.Node, x: number, y: number) {
  const point = node.getAbsoluteTransform().point({ x, y });
  const target = stage.container().getBoundingClientRect();
  return new PointerEvent(type, {
    pointerId: 1,
    button: 0,
    clientX: target.left + point.x,
    clientY: target.top + point.y,
  });
}

function grid() {
  return stage.findOne<Konva.Rect>(".room-grid")!;
}

function press(node: Konva.Node, x: number, y: number) {
  const event = pointer("pointerdown", node, x, y);
  stage.setPointersPositions(event);
  node.fire("pointerdown", { evt: event });
}

function release(x: number, y: number) {
  window.dispatchEvent(pointer("pointermove", grid(), x * 64 + 32, y * 64 + 32));
  window.dispatchEvent(pointer("pointerup", grid(), x * 64 + 32, y * 64 + 32));
}

function select(label: string) {
  const card = button(label);
  const releaseEvent = pointer("pointerup", card, 10, 10);
  press(card, 10, 10);
  window.dispatchEvent(releaseEvent);
}

function drag(label: string, x: number, y: number) {
  press(button(label), 10, 10);
  release(x, y);
}

function openRoom() {
  click("Mini-game");
  click("Room Builder");
}

function placeBench() {
  drag("Bench", 0, 0);
}

function placedPieces() {
  return stage.find<Konva.Shape>(".placed-room-piece");
}

function back() {
  stage
    .find<Konva.Group>(".back")
    .find((node) => node.isVisible())!
    .fire("click");
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  document.body.innerHTML = '<div id="game"></div>';
  useFixedQuizQuestions = false;
  const random = Math.random;
  // Give the quiz predictable dimensions without affecting Konva's random hit colors.
  vi.spyOn(Math, "random").mockImplementation(() => (useFixedQuizQuestions ? 0 : random()));
  app = new App("game");
  stage = stages[stages.length - 1];
});

afterEach(() => {
  app.switchTo("menu");
  stage.destroy();
  vi.restoreAllMocks();
});

describe("Room Builder navigation and rewards", () => {
  it("opens from the main menu and shows score, area and feedback after placement", () => {
    openRoom();
    expect(texts()).toContain("Make every space count!");
    placeBench();
    expect(texts()).toEqual(
      expect.arrayContaining([
        "Piece placed! +80 points.",
        "80 pts",
        "8 / 48 m²",
        "17%",
        "2 remaining",
      ]),
    );
    drag("Bench", 0, 0);
    expect(texts()).toContain("This piece overlaps another piece.");
    drag("Bench", 7, 5);
    expect(texts()).toContain("This piece must fit inside the room.");
    expect(texts()).toContain("80 pts");
  });

  it("shows valid and invalid drag previews without committing until release", () => {
    openRoom();
    press(button("Bench"), 10, 10);
    const preview = () =>
      stage.find<Konva.Shape>(
        (node: Konva.Node) =>
          node instanceof Konva.Shape &&
          node.isVisible() &&
          (node.fill() === WIN_TEXT || node.fill() === LOSE_TEXT),
      );
    window.dispatchEvent(pointer("pointermove", grid(), 32, 32));
    expect(preview().map((node) => node.fill())).toEqual([WIN_TEXT]);
    expect(texts()).toEqual(expect.arrayContaining(["0 pts", "3 remaining"]));
    window.dispatchEvent(pointer("pointermove", grid(), 7 * 64 + 32, 32));
    expect(preview().map((node) => node.fill())).toEqual([LOSE_TEXT]);
    window.dispatchEvent(pointer("pointercancel", grid(), 32, 32));
    expect(preview()).toHaveLength(0);
    expect(placedPieces()).toHaveLength(0);
    expect(texts()).toEqual(expect.arrayContaining(["0 pts", "3 remaining"]));
  });

  it("restores inventory and stats on undo and reset", () => {
    openRoom();
    expect(button("Undo").isListening()).toBe(false);
    placeBench();
    click("Undo");
    expect(texts()).toEqual(expect.arrayContaining(["3 remaining", "0 pts"]));
    expect(button("Undo").isListening()).toBe(false);
    placeBench();
    click("Reset Room");
    expect(texts()).toEqual(expect.arrayContaining(["3 remaining", "0 / 48 m²", "48 m²"]));
  });

  it("awards once, returns to the menu, and applies the coins to the next game", () => {
    openRoom();
    placeBench();
    drag("Square tower", 4, 0);
    const finish = button("Finish Room");
    finish.fire("click");
    finish.fire("click");
    expect(texts()).toEqual(
      expect.arrayContaining([
        "Room Complete!",
        "Final score   120 points",
        "Area filled   12 / 48 m²",
        "Room utilization   25%",
        "Pieces placed   2",
        "Bonus coins earned   +5",
      ]),
    );
    click("Return to Menu");
    expect(texts()).toContain("Mini-game bonus: +5 coins in your next game");
    click("Play");
    click("Play");
    expect(texts()).toContain("Coins: 105");
  });

  it("restarts with a fresh room and reports the actual capped reward", () => {
    openRoom();
    for (let round = 0; round < 5; round++) {
      for (let y = 0; y < 6; y += 2) drag("Bench", 0, y);
      drag("Square tower", 4, 0);
      click("Finish Room");
      expect(texts()).toContain(`Bonus coins earned   +${[15, 15, 15, 5, 0][round]}`);
      click("Play Again");
      expect(texts()).toEqual(expect.arrayContaining(["0 pts", "3 remaining"]));
    }
    const back = stage.find<Konva.Group>(".back").find((node) => node.isVisible())!;
    back.fire("click");
    expect(texts()).toContain("Mini-game bonus: +50 coins in your next game");
  });

  it("leaves unfinished rooms without coins and opens a fresh round", () => {
    openRoom();
    placeBench();
    stage
      .find<Konva.Group>(".back")
      .find((node) => node.isVisible())!
      .fire("click");
    expect(texts().some((text) => text.startsWith("Mini-game bonus"))).toBe(false);
    openRoom();
    expect(texts()).toEqual(expect.arrayContaining(["3 remaining", "0 pts"]));
  });

  it("moves a placed piece, rejects invalid moves, and undoes movement", () => {
    openRoom();
    placeBench();
    drag("Square tower", 4, 0);
    press(placedPieces()[0], 32, 32);
    release(0, 3);
    expect(texts()).toEqual(expect.arrayContaining(["Piece moved.", "120 pts", "2 remaining"]));
    expect(placedPieces()[0].y()).toBe(3 * 64);
    for (const [x, y] of [
      [3, 0],
      [-1, 0],
    ]) {
      press(placedPieces()[0], 32, 32);
      release(x, y);
      expect(placedPieces()[0].y()).toBe(3 * 64);
      expect(placedPieces()).toHaveLength(2);
      expect(texts()).toContain("120 pts");
    }
    click("Undo");
    expect(placedPieces()[0].y()).toBe(0);
  });

  it("rotates a card and a placed triangle, then finishes for the same area-based reward", () => {
    openRoom();
    placeBench();
    drag("Triangle tower", 4, 0);
    select("Triangle tower");
    click("Rotate");
    click("Rotate");
    drag("Triangle tower", 4, 0);
    expect(placedPieces()).toHaveLength(3);
    expect(texts()).toContain("120 pts");

    const triangle = () => placedPieces()[2] as Konva.Line;
    const original = triangle().points();
    const releaseEvent = pointer("pointerup", triangle(), 100, 24);
    press(triangle(), 100, 24);
    window.dispatchEvent(releaseEvent);
    click("Rotate");
    expect(texts()).toContain("This piece overlaps another piece.");
    expect(triangle().points()).toEqual(original);

    press(triangle(), 100, 24);
    release(6, 2);
    click("Rotate");
    expect(triangle().points()).not.toEqual(original);
    click("Undo");
    expect(triangle().points()).toEqual(original);
    expect(texts()).toContain("120 pts");
    click("Finish Room");
    expect(texts()).toContain("Bonus coins earned   +5");
  });

  it("cancels an in-flight drag on reset or navigation and ignores the late release", () => {
    openRoom();
    for (const leave of [false, true]) {
      placeBench();
      press(placedPieces()[0], 32, 32);
      window.dispatchEvent(pointer("pointermove", grid(), 32, 3 * 64 + 32));
      expect(document.body.style.cursor).toBe("grabbing");
      if (leave) back();
      else click("Reset Room");
      release(0, 3);
      expect(document.body.style.cursor).toBe("default");
      if (leave) {
        expect(texts().some((text) => text.startsWith("Mini-game bonus"))).toBe(false);
        openRoom();
      }
      expect(placedPieces()).toHaveLength(0);
      expect(texts()).toEqual(expect.arrayContaining(["0 pts", "3 remaining"]));
    }
  });

  it("reaches 100% with all inventory, rejects another drag, and awards 30 coins", () => {
    openRoom();
    for (const y of [0, 2, 4]) drag("Bench", 0, y);
    for (const x of [4, 6]) {
      for (const y of [0, 2]) drag("Square tower", x, y);
      drag("Triangle tower", x, 4);
      click("Rotate");
      click("Rotate");
      drag("Triangle tower", x, 4);
    }
    expect(texts()).toEqual(expect.arrayContaining(["480 pts", "100%", "0 m²"]));
    drag("Triangle tower", 4, 4);
    expect(texts()).toContain("No pieces of this type remaining.");
    expect(placedPieces()).toHaveLength(11);
    click("Finish Room");
    expect(texts()).toContain("Bonus coins earned   +30");
  });

  it("still opens the existing timed quiz and submits a correct answer", () => {
    click("Mini-game");
    useFixedQuizQuestions = true;
    click("Geometry Quiz");
    useFixedQuizQuestions = false;
    expect(texts()).toContain("5 coins per correct answer, added to your next game");
    for (const key of "4*pi") window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    click("Submit");
    expect(texts()).toContain("Correct!");
    stage
      .find<Konva.Group>(".back")
      .find((node) => node.isVisible())!
      .fire("click");
    expect(texts()).toContain("Main menu");
  });
});
