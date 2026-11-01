// @vitest-environment jsdom
import type Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionPrompt } from "./QuestionPrompt";
import { QuestionService } from "../../model/questions/QuestionService";
import type { Question } from "../../model/types";

// Capture the button callbacks so tests can "click" Submit and Continue
const handlers = vi.hoisted(() => ({}) as Record<string, () => void>);
vi.mock("../button", async () => {
  const Konva = (await import("konva")).default;
  return {
    makeButton: (label: string, onClick: () => void) => {
      handlers[label] = onClick;
      return new Konva.Group();
    },
  };
});

const question: Question = {
  id: "test",
  prompt: "What is 2 + 3?",
  answer: 5,
  tolerance: 0,
  hint: "Add them.",
};
const anchor = { x: 100, y: 100 };

const press = (key: string) => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
};
const type = (text: string) => {
  for (const ch of text) press(ch);
};

const inputShown = () => (prompt.group.find("Text")[1] as Konva.Text).text();

// Lets us check "has the promise settled yet?" without awaiting forever
function track(promise: Promise<boolean>) {
  const state: { done: boolean; value: boolean | null } = { done: false, value: null };
  void promise.then((v) => {
    state.done = true;
    state.value = v;
  });
  return state;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

let prompt: QuestionPrompt;

beforeEach(() => {
  prompt = new QuestionPrompt(new QuestionService());
  prompt.resize(800, 600);
});

afterEach(() => {
  prompt.cancel(); // make sure no key listener leaks between tests
  vi.restoreAllMocks();
});

describe("QuestionPrompt", () => {
  it("is hidden until ask() is called, then shows", () => {
    expect(prompt.group.visible()).toBe(false);
    void prompt.ask(question, anchor);
    expect(prompt.group.visible()).toBe(true);
  });

  it("resolves true when the typed answer is correct and Enter is pressed", async () => {
    const result = prompt.ask(question, anchor);
    type("5");
    press("Enter");
    expect(await result).toBe(true);
    expect(prompt.group.visible()).toBe(false);
  });

  it("resolves true when Submit is clicked with a correct answer", async () => {
    const result = prompt.ask(question, anchor);
    type("5");
    handlers["Submit"]();
    expect(await result).toBe(true);
    expect(prompt.group.visible()).toBe(false);
  });

  it("ignores letters and other keys while typing", async () => {
    const result = prompt.ask(question, anchor);
    type("a");
    type("5");
    press("Shift");
    press("Escape");
    press("Enter");
    expect(await result).toBe(true);
  });

  it("shows typed characters in the input box", () => {
    void prompt.ask(question, anchor);
    expect(inputShown()).toBe("|");
    type("56");
    expect(inputShown()).toBe("56|");
  });

  it("Backspace removes the last character", () => {
    void prompt.ask(question, anchor);
    type("56");
    press("Backspace");
    expect(inputShown()).toBe("5|");
  });

  it("Backspace on empty input does nothing", () => {
    void prompt.ask(question, anchor);
    press("Backspace");
    expect(inputShown()).toBe("|");
  });

  it("ignores letters in the input box", () => {
    void prompt.ask(question, anchor);
    type("a5b");
    expect(inputShown()).toBe("5|");
  });

  it("does not resolve on a wrong answer until the player dismisses it", async () => {
    const state = track(prompt.ask(question, anchor));
    type("4");
    press("Enter"); // wrong: shows the hint, stays open
    await flush();

    expect(state.done).toBe(false);
    expect(prompt.group.visible()).toBe(true);

    press("Enter"); // dismiss
    await flush();
    expect(state.done).toBe(true);
    expect(state.value).toBe(false);
    expect(prompt.group.visible()).toBe(false);
  });

  it("resolves false when Continue is clicked after a wrong answer", async () => {
    const result = prompt.ask(question, anchor);
    type("4");
    handlers["Submit"]();
    handlers["Continue"]();
    expect(await result).toBe(false);
    expect(prompt.group.visible()).toBe(false);
  });

  it("does not accept more typing after a wrong answer", async () => {
    const state = track(prompt.ask(question, anchor));
    type("4");
    press("Enter"); // wrong
    type("5"); // should be ignored: the prompt is in the "wrong" phase
    press("Enter"); // dismisses
    await flush();
    expect(state.value).toBe(false);
  });

  it("treats an empty submit as a wrong answer", async () => {
    const state = track(prompt.ask(question, anchor));
    press("Enter");
    await flush();
    expect(state.done).toBe(false); // wrong phase, waiting for dismiss
    press("Enter");
    await flush();
    expect(state.value).toBe(false);
  });

  it("cancel() resolves false and hides the popup", async () => {
    const result = prompt.ask(question, anchor);
    prompt.cancel();
    expect(await result).toBe(false);
    expect(prompt.group.visible()).toBe(false);
  });

  it("cancel() with no question open does nothing", () => {
    expect(() => prompt.cancel()).not.toThrow();
  });

  it("asking a second question cancels the first", async () => {
    const first = prompt.ask(question, anchor);
    const second = prompt.ask(question, anchor);
    expect(await first).toBe(false);

    type("5");
    press("Enter");
    expect(await second).toBe(true);
  });

  it("removes its key listener once finished", async () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const result = prompt.ask(question, anchor);
    type("5");
    press("Enter");
    await result;
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  describe("placement", () => {
    it("puts the popup to the right of the anchor when there is room", () => {
      void prompt.ask(question, { x: 100, y: 300 });
      const panel = prompt.group.getChildren()[1]; // [dim, panelGroup]
      expect(panel.x()).toBe(100 + 16);
    });

    it("flips to the left when it would run off the right edge", () => {
      void prompt.ask(question, { x: 700, y: 300 });
      const panel = prompt.group.getChildren()[1];
      expect(panel.x()).toBe(700 - 16 - 320);
    });

    it("keeps the popup inside the screen vertically", () => {
      void prompt.ask(question, { x: 100, y: 0 });
      const panel = prompt.group.getChildren()[1];
      expect(panel.y()).toBe(0);

      void prompt.ask(question, { x: 100, y: 600 });
      expect(prompt.group.getChildren()[1].y()).toBe(600 - 240);
    });
  });
});