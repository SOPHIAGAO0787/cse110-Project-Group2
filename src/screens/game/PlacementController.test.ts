// @vitest-environment jsdom
import "vitest-canvas-mock";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlacementController } from "./PlacementController";
import { GameScreenView } from "./GameScreenView";
import { GridView } from "./GridView";
import { QuestionPrompt } from "./QuestionPrompt";
import { GameModel } from "../../model/GameModel";
import { MAPS } from "../../model/loadContent";
import { QuestionService } from "../../model/questions/QuestionService";
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

// Drags the circle tower onto the map and presses Enter, which opens the question.
// The question stays open until the test calls answer().
function openQuestion(): void {
  vi.spyOn(GridView.prototype, "tileUnderMouse").mockReturnValue(buildableTile());
  vi.spyOn(QuestionPrompt.prototype, "ask").mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        answer = resolve;
      }),
  );
  // The circle tower's card: the only tower a new save has, added to the shop last
  const card = view.shopGroup.getChildren()[view.shopGroup.getChildren().length - 1];
  card.fire("pointerdown");
  window.dispatchEvent(new Event("pointerup"));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
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
