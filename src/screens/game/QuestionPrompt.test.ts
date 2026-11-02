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
const feedbackShown = () => (prompt.group.find("Text")[2] as Konva.Text).text();

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

  it("does not resolve until dismissed after the last wrong answer", async () => {
    const state = track(prompt.ask(question, anchor));
    type("4");
    press("Enter"); // wrong, one try left
    type("3");
    press("Enter"); // wrong again, out of tries
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

  it("resolves false when Continue is clicked after the last wrong answer", async () => {
    const result = prompt.ask(question, anchor);
    type("4");
    handlers["Submit"]();
    type("3");
    handlers["Submit"]();
    handlers["Continue"]();
    expect(await result).toBe(false);
  });

  it("does not accept more typing after the last wrong answer", async () => {
    const state = track(prompt.ask(question, anchor));
    type("4");
    press("Enter");
    type("3");
    press("Enter"); // out of tries
    type("5"); // ignored: the prompt is in the "wrong" phase
    press("Enter"); // dismisses
    await flush();
    expect(state.value).toBe(false);
  });

  it("ignores an empty submit and keeps the question open", async () => {
    const state = track(prompt.ask(question, anchor));
    press("Enter");
    press("Enter");
    await flush();

    expect(state.done).toBe(false);
    expect(prompt.group.visible()).toBe(true);
    expect(feedbackShown()).toContain("Type an answer");
  });

  it("does not use up a try on an empty submit", () => {
    void prompt.ask(question, anchor);
    press("Enter"); // blank: ignored
    type("4");
    press("Enter"); // first real wrong answer
    expect(feedbackShown()).toContain("1 try left"); // still has a second try
  });

  it("ignores an empty Submit button click", () => {
    void prompt.ask(question, anchor);
    handlers["Submit"]();
    expect(feedbackShown()).toContain("Type an answer");
    expect(prompt.group.visible()).toBe(true);
  });

  it("Escape closes the popup and resolves false", async () => {
    const result = prompt.ask(question, anchor);
    press("Escape");
    expect(await result).toBe(false);
    expect(prompt.group.visible()).toBe(false);
  });

  it("Escape does not submit a correct answer that was typed", async () => {
    const result = prompt.ask(question, anchor);
    type("5");
    press("Escape");
    expect(await result).toBe(false);
  });

  it("Escape also closes the popup after the last wrong answer", async () => {
    const result = prompt.ask(question, anchor);
    type("4");
    press("Enter");
    type("3");
    press("Enter"); // out of tries, Continue is showing
    press("Escape");
    expect(await result).toBe(false);
    expect(prompt.group.visible()).toBe(false);
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

  it("gives a second chance after a wrong answer", async () => {
    const result = prompt.ask(question, anchor);
    type("4");
    press("Enter"); // wrong, but one try left

    expect(prompt.group.visible()).toBe(true);
    expect(inputShown()).toBe("|"); // input cleared
    expect(feedbackShown()).toContain("1 try left");

    type("5");
    press("Enter");
    expect(await result).toBe(true);
  });

  it("shows the hint on the first wrong answer", () => {
    void prompt.ask(question, anchor);
    type("4");
    press("Enter");
    expect(feedbackShown()).toContain("Add them.");
  });

  it("starts with full tries when a new question is asked", async () => {
    const first = prompt.ask(question, anchor);
    type("4");
    press("Enter"); // uses one try
    prompt.cancel();
    await first;

    const state = track(prompt.ask(question, anchor));
    type("4");
    press("Enter"); // should be wrong with a try left, not final
    await flush();
    expect(state.done).toBe(false);
    expect(feedbackShown()).toContain("1 try left");
  });
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
