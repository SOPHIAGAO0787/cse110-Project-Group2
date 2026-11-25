// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { TutorialView } from "./TutorialView";

let tutorial: TutorialView;
let onDone: Mock<() => void>;

// Clicks the visible button with this label
function click(label: string): void {
  const texts = tutorial.group.find<Konva.Text>("Text");
  for (const text of texts) {
    const button = text.getParent();
    if (text.text() === label && button !== null && button.isVisible()) {
      button.fire("click");
      return;
    }
  }
  throw new Error(`No visible "${label}" button`);
}

beforeEach(() => {
  tutorial = new TutorialView();
  onDone = vi.fn<() => void>();
  tutorial.start(onDone);
});

describe("TutorialView", () => {
  it("starts with the offer to take the tour", () => {
    expect(tutorial.isShowing()).toBe(true);
    expect(tutorial.stepText()).toBe("New here? Take the 1-minute tour.");
  });

  it("Show me goes to the first step", () => {
    click("Show me");
    expect(tutorial.stepText()).toBe(
      "Drag a tower from the shop to a tile that turns green, then press ✓ or Enter.",
    );
  });

  it("waits for the step's own action", () => {
    click("Show me");
    tutorial.advance("speed"); // a later step's action: this step stays
    expect(tutorial.stepText()).toContain("Drag a tower");

    tutorial.advance("question");
    expect(tutorial.stepText()).toBe(
      "Answer the question to build the tower. You can type π, fractions or decimals.",
    );
    tutorial.advance("towerPlaced");
    expect(tutorial.stepText()).toContain("Press Start Wave");
  });

  it("remembers an action done early, so its step passes as soon as it comes up", () => {
    click("Show me");
    tutorial.advance("speed"); // Space pressed during the first step
    tutorial.advance("question");
    tutorial.advance("towerPlaced");
    tutorial.advance("waveStarted");
    expect(tutorial.stepText()).toBe(
      "Each enemy you stop gives coins. Click a tower on the map to upgrade it.",
    );
  });

  it("ends with Skip on the offer", () => {
    click("Skip");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(tutorial.isShowing()).toBe(false);
  });

  it("ends with Skip tutorial on any step", () => {
    click("Show me");
    tutorial.advance("question");
    click("Skip tutorial");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(tutorial.isShowing()).toBe(false);
  });

  it("ends with Done on the last step", () => {
    click("Show me");
    tutorial.advance("question");
    tutorial.advance("towerPlaced");
    tutorial.advance("waveStarted");
    tutorial.advance("speed");
    click("Done");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(tutorial.isShowing()).toBe(false);
  });

  it("hides on stop without counting as done, and starts over from the offer", () => {
    click("Show me");
    tutorial.advance("question");
    tutorial.stop();
    expect(tutorial.isShowing()).toBe(false);
    expect(onDone).not.toHaveBeenCalled();

    tutorial.start(onDone); // a new game: the question from the old one no longer counts
    expect(tutorial.stepText()).toBe("New here? Take the 1-minute tour.");
    click("Show me");
    expect(tutorial.stepText()).toContain("Drag a tower");
  });

  it("ignores actions while hidden", () => {
    tutorial.stop();
    tutorial.advance("question");
    expect(tutorial.isShowing()).toBe(false);
  });

  it("only the buttons take the mouse, so drops on the tiles under the box still work", () => {
    for (const node of tutorial.group.getChildren()) {
      const isButton = node instanceof Konva.Group;
      expect(node.listening()).toBe(isButton);
    }
  });
});
