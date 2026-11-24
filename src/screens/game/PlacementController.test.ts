// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlacementController } from "./PlacementController";
import { GameScreenView } from "./GameScreenView";
import { GridView } from "./GridView";
import { QuestionPrompt } from "./QuestionPrompt";
import { GameModel } from "../../model/GameModel";
import { MAPS, TOWERS } from "../../model/loadContent";
import { QuestionService } from "../../model/questions/QuestionService";
import { wrongAnswerCost } from "../../model/questions/TowerQuestionsHandling";
import { TowerProgress } from "../../model/TowerProgress";
import { Sound } from "../../core/Sound";
import type { MapConfig, Vec } from "../../model/types";

let view: GameScreenView;
let model: GameModel;
let controller: PlacementController;
let answer: (correct: boolean) => void;

// A game on this map with only the circle tower unlocked, as in a new save
function startGame(map: MapConfig): void {
  const questions = new QuestionService();
  const towerProgress = new TowerProgress();
  const noop = () => {};
  view = new GameScreenView(
    map.cols,
    map.rows,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    questions,
    new Sound(),
  );
  model = new GameModel(map, towerProgress);
  const gridView = new GridView(map, (tile) => model.grid.isBuildable(tile));
  controller = new PlacementController(
    view,
    model,
    map,
    towerProgress,
    questions,
    gridView,
    () => true,
    800,
  );
}

// The first tile a tower can be built on
function buildableTile(): Vec {
  for (let y = 0; y < model.map.rows; y++) {
    for (let x = 0; x < model.map.cols; x++) {
      if (model.grid.isBuildable({ x, y })) {
        return { x, y };
      }
    }
  }
  throw new Error("this map has no buildable tile");
}

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

// Drags the circle tower onto the map. Pressing Enter then opens its question.
function dragTower(): void {
  vi.spyOn(GridView.prototype, "tileUnderMouse").mockReturnValue(buildableTile());
  // The circle tower's card: the only tower a new save has, added to the shop last
  const card = view.shopGroup.getChildren()[view.shopGroup.getChildren().length - 1];
  card.fire("pointerdown");
  window.dispatchEvent(new Event("pointerup"));
}

// Drags the circle tower onto the map and presses Enter, which opens the question.
// The question stays open until the test calls answer().
function openQuestion(): void {
  vi.spyOn(QuestionPrompt.prototype, "ask").mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        answer = resolve;
      }),
  );
  dragTower();
  press("Enter");
}

// Lets the code after the question finish
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

afterEach(() => {
  controller.dispose();
  view.prompt.cancel();
  view.group.destroy();
  vi.restoreAllMocks();
});

describe("PlacementController question levels", () => {
  it.each([1, 2, 3, 4])("asks questions for map %i on that map", (mapNumber) => {
    const questionFor = vi.spyOn(QuestionService.prototype, "questionFor");
    startGame(MAPS[mapNumber - 1]);
    openQuestion();
    expect(questionFor).toHaveBeenCalledTimes(1);
    expect(questionFor.mock.calls[0][2]).toBe(mapNumber);
  });
});

describe("PlacementController Questions Solved", () => {
  // Ends the game and returns the Questions Solved count the result screen shows
  function questionsSolved(): number {
    model.lives.remaining = 0;
    model.tick(0);
    if (model.result === null) {
      throw new Error("the game did not end");
    }
    return model.result.questionsSolved;
  }

  it("counts a correct answer once the tower is placed", async () => {
    startGame(MAPS[0]);
    openQuestion();
    answer(true);
    await settle();
    expect(model.towers).toHaveLength(1);
    expect(questionsSolved()).toBe(1);
  });

  it("doesn't count a correct answer when the tower can't be placed after all", async () => {
    startGame(MAPS[0]);
    openQuestion();
    model.wallet.spend(model.wallet.coins); // the coins ran out while the question was open
    answer(true);
    await settle();
    expect(model.towers).toHaveLength(0);
    expect(questionsSolved()).toBe(0);
  });

  it("doesn't count a wrong answer", async () => {
    startGame(MAPS[0]);
    openQuestion();
    answer(false);
    await settle();
    expect(questionsSolved()).toBe(0);
  });
});

describe("PlacementController wrong answer cost", () => {
  let circle = TOWERS[0];
  for (const tower of TOWERS) {
    if (tower.id === "circle") {
      circle = tower;
    }
  }
  const cost = wrongAnswerCost(circle);

  // Opens the real question popup, with a question whose answer is 5
  function openRealQuestion(): void {
    vi.spyOn(QuestionService.prototype, "questionFor").mockReturnValue({
      id: "test",
      prompt: "2 + 3?",
      answer: 5,
      tolerance: 0,
      hint: "Add them.",
      title: "Test Question",
    });
    dragTower();
    press("Enter");
  }

  // Clicks the ✕ in the corner of the question popup
  function clickClose(): void {
    const label = view.prompt.group.find<Konva.Text>("Text").find((text) => text.text() === "✕");
    if (label === undefined) {
      throw new Error("the question popup has no close button");
    }
    const button = label.getParent();
    if (button === null) {
      throw new Error("the close label has no button");
    }
    button.fire("click");
  }

  it("takes the coins after the last wrong try, and says so", async () => {
    startGame(MAPS[0]);
    const message = vi.spyOn(view, "showMessage");
    const before = model.wallet.coins;
    openRealQuestion();
    press("4");
    press("Enter"); // wrong, one try left
    press("Enter"); // "4" again: wrong, no tries left
    expect(model.wallet.coins).toBe(before); // taken when the popup closes
    press("Enter"); // Continue
    await settle();
    expect(model.wallet.coins).toBe(before - cost);
    expect(model.towers).toHaveLength(0);
    expect(message).toHaveBeenCalledWith(`−${cost} coins for the missed question`);
  });

  it("takes the coins when the question is closed with Esc", async () => {
    startGame(MAPS[0]);
    const before = model.wallet.coins;
    openRealQuestion();
    press("Escape");
    await settle();
    expect(model.wallet.coins).toBe(before - cost);
    expect(model.towers).toHaveLength(0);
  });

  it("takes the coins when the question is closed with ✕", async () => {
    startGame(MAPS[0]);
    const before = model.wallet.coins;
    openRealQuestion();
    clickClose();
    await settle();
    expect(model.wallet.coins).toBe(before - cost);
  });

  it("takes nothing for a correct answer", async () => {
    startGame(MAPS[0]);
    const before = model.wallet.coins;
    openRealQuestion();
    press("5");
    press("Enter");
    await settle();
    expect(model.wallet.coins).toBe(before - circle.cost); // only the tower's price
    expect(model.towers).toHaveLength(1);
  });

  it("never takes the coins below 0", async () => {
    startGame(MAPS[0]);
    openRealQuestion();
    model.wallet.spend(model.wallet.coins - 1); // 1 coin left, less than the cost
    press("Escape");
    await settle();
    expect(model.wallet.coins).toBe(0);
  });

  it("is free to cancel a placement before its question opens", async () => {
    startGame(MAPS[0]);
    const before = model.wallet.coins;
    const ask = vi.spyOn(QuestionPrompt.prototype, "ask");
    dragTower();
    press("Escape");
    await settle();
    expect(ask).not.toHaveBeenCalled();
    expect(model.wallet.coins).toBe(before);
  });

  it("takes nothing when the game ends while the question is open", async () => {
    startGame(MAPS[0]);
    const before = model.wallet.coins;
    openQuestion();
    model.lives.remaining = 0;
    model.tick(0);
    answer(false);
    await settle();
    expect(model.wallet.coins).toBe(before);
  });
});
