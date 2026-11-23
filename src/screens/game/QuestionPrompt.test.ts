// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionPrompt } from "./QuestionPrompt";
import { QuestionService } from "../../model/questions/QuestionService";
import type { Question } from "../../model/types";

// Capture the button callbacks so tests can "click" Submit and Continue.
// makeClickable and setHoverCursor are replaced with copies of the real behavior.
// The rest of the module, like BUTTON_HEIGHT, stays real.
const handlers = vi.hoisted(() => ({}) as Record<string, () => void>);
vi.mock("../button", async (importOriginal) => {
  const original = await importOriginal<typeof import("../button")>();
  const Konva = (await import("konva")).default;
  return {
    ...original,
    makeButton: (label: string, onClick: () => void) => {
      handlers[label] = onClick;
      return new Konva.Group();
    },
    makeClickable: (button: Konva.Group, onClick: () => void) => {
      button.on("click tap", onClick);
      button.on("mouseenter", () => {
        document.body.style.cursor = "pointer";
      });
      button.on("mouseleave", () => {
        document.body.style.cursor = "default";
      });
    },
    setHoverCursor: (node: Konva.Node, cursor: string, isEnabled: () => boolean = () => true) => {
      node.on("mouseenter", () => {
        if (isEnabled()) document.body.style.cursor = cursor;
      });
      node.on("mouseleave", () => {
        document.body.style.cursor = "default";
      });
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

// Long prompt to test adjustable question panel height
const LONG_PROMPT = "What is the area of this shape? ".repeat(30);

const press = (key: string) => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
};
const type = (text: string) => {
  for (const ch of text) press(ch);
};

const inputShown = () => (prompt.group.find("Text")[1] as Konva.Text).text();
const feedbackShown = () =>
  prompt.group
    .find<Konva.Text>("Text")
    .find((t) => t.fill() === "#ff6b6b")!
    .text();
const clickSymbol = (symbol: string) =>
  prompt.group
    .find<Konva.Text>("Text")
    .find((t) => t.text() === symbol)!
    .getParent()!
    .fire("click");
const inputBox = () => prompt.group.find<Konva.Rect>("Rect").find((r) => r.width() === 200)!;
const panelHeight = () =>
  prompt.group
    .find<Konva.Rect>("Rect")
    .find((r) => r.width() === 320)!
    .height();

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

// The canvas mock can't measure text reliably, so tests that need widths fake it: 10px per character
function fakeTextWidth() {
  const p = prompt as unknown as { measure: (t: string) => number };
  vi.spyOn(p, "measure").mockImplementation((t) => t.length * 10);
}

let prompt: QuestionPrompt;

beforeEach(() => {
  prompt = new QuestionPrompt(new QuestionService());
  prompt.resize(800, 600);
});

afterEach(() => {
  prompt.cancel(); // make sure no key listener leaks between tests
  vi.restoreAllMocks();
  document.body.style.cursor = "";
});

describe("QuestionPrompt functionality", () => {
  describe("showing and hiding", () => {
    it("is hidden until ask() is called, then shows", () => {
      expect(prompt.group.visible()).toBe(false);
      void prompt.ask(question, anchor);
      expect(prompt.group.visible()).toBe(true);
    });

    it("removes its key listener once finished", async () => {
      const remove = vi.spyOn(window, "removeEventListener");
      const result = prompt.ask(question, anchor);
      type("5");
      press("Enter");
      await result;
      expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
  });

  describe("typing", () => {
    it("shows typed characters in the input box", () => {
      void prompt.ask(question, anchor);
      expect(inputShown()).toBe("");
      type("56");
      expect(inputShown()).toBe("56");
    });

    it("ignores spaces and letters in the input box", () => {
      void prompt.ask(question, anchor);
      type("1 e2p");
      press(" ");
      expect(inputShown()).toBe("12");
    });

    it("accepts fractions, parentheses, powers and operators from the keyboard", () => {
      void prompt.ask(question, anchor);
      type("(1+2)*3/4^5-.6");
      expect(inputShown()).toBe("(1+2)*3/4^5-.6");
    });

    it("Backspace removes the last character", () => {
      void prompt.ask(question, anchor);
      type("56");
      press("Backspace");
      expect(inputShown()).toBe("5");
    });

    it("Backspace on empty input does nothing", () => {
      void prompt.ask(question, anchor);
      press("Backspace");
      expect(inputShown()).toBe("");
    });

    it("stops accepting characters at the length limit (typed and buttons)", () => {
      void prompt.ask(question, anchor);
      type("1".repeat(30));
      expect(inputShown()).toBe("1".repeat(18));
      clickSymbol("π");
      expect(inputShown()).toBe("1".repeat(18));
    });

    it("does not insert in the middle when the text would go over the limit", () => {
      void prompt.ask(question, anchor);
      type("1".repeat(18));
      press("ArrowLeft");
      type("2");
      expect(inputShown()).toBe("1".repeat(18));
    });

    it("does not accept more typing after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      type("3");
      press("Enter"); // out of tries
      type("5"); // ignored: the prompt is in the "wrong" phase
      expect(inputShown()).toBe("3");
    });
  });

  describe("symbol buttons", () => {
    it("π and √ buttons insert their symbol", () => {
      void prompt.ask(question, anchor);
      clickSymbol("π");
      clickSymbol("√");
      expect(inputShown()).toBe("π√");
    });

    it("⌫ removes the character before the cursor, and does nothing at the start", () => {
      void prompt.ask(question, anchor);
      type("123");
      press("ArrowLeft");
      clickSymbol("⌫");
      expect(inputShown()).toBe("13");
      press("ArrowLeft");
      clickSymbol("⌫");
      expect(inputShown()).toBe("13");
    });

    it("C clears everything and resets the cursor", () => {
      void prompt.ask(question, anchor);
      type("12");
      press("ArrowLeft");
      clickSymbol("C");
      expect(inputShown()).toBe("");
      type("5");
      expect(inputShown()).toBe("5");
    });

    it("symbol buttons insert at the cursor", () => {
      void prompt.ask(question, anchor);
      type("25");
      press("ArrowLeft");
      clickSymbol("√");
      expect(inputShown()).toBe("2√5");
    });

    it("symbol buttons do nothing after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      type("3");
      press("Enter"); // out of tries
      clickSymbol("π");
      clickSymbol("C");
      expect(inputShown()).toBe("3");
    });
  });

  describe("cursor movement", () => {
    it("arrow keys move where the next character goes", () => {
      void prompt.ask(question, anchor);
      type("15");
      press("ArrowLeft");
      type("2");
      expect(inputShown()).toBe("125");
    });

    it("ArrowRight moves back toward the end", () => {
      void prompt.ask(question, anchor);
      type("15");
      press("ArrowLeft");
      press("ArrowLeft");
      press("ArrowRight");
      type("2");
      expect(inputShown()).toBe("125");
    });

    it("the cursor stops at both ends", () => {
      void prompt.ask(question, anchor);
      type("12");
      press("ArrowRight"); // already at the end
      type("3");
      expect(inputShown()).toBe("123");
      for (let i = 0; i < 10; i++) press("ArrowLeft");
      type("0");
      expect(inputShown()).toBe("0123");
    });

    it("Backspace deletes before the cursor, and does nothing at the start", () => {
      void prompt.ask(question, anchor);
      type("123");
      press("ArrowLeft");
      press("Backspace");
      expect(inputShown()).toBe("13");
      press("ArrowLeft");
      press("Backspace");
      expect(inputShown()).toBe("13");
    });

    it("resets the cursor after a wrong answer and for a new question", () => {
      void prompt.ask(question, anchor);
      type("45");
      press("ArrowLeft");
      press("Enter"); // wrong, input clears
      type("5");
      expect(inputShown()).toBe("5");

      void prompt.ask(question, anchor);
      type("1");
      expect(inputShown()).toBe("1");
    });

    it("arrow keys are ignored after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      type("3");
      press("Enter");
      expect(() => press("ArrowLeft")).not.toThrow();
      expect(inputShown()).toBe("3");
    });
  });

  describe("click to move the cursor", () => {
    it("clicking the input box puts the cursor at the nearest gap", () => {
      fakeTextWidth();
      void prompt.ask(question, anchor);
      type("1234"); // 40px wide, centered in the 200px box at x=60, so it starts at x=140

      // 12px into the text: the nearest gap is after the first character
      vi.spyOn(Konva.Node.prototype, "getRelativePointerPosition").mockReturnValue({
        x: 152,
        y: 0,
      });
      inputBox().fire("click");
      type("9");
      expect(inputShown()).toBe("19234");
    });

    it("clicking left or right of the text goes to the start or end", () => {
      fakeTextWidth();
      void prompt.ask(question, anchor);
      type("12");
      const pointer = vi.spyOn(Konva.Node.prototype, "getRelativePointerPosition");

      pointer.mockReturnValue({ x: 0, y: 0 });
      inputBox().fire("click");
      type("0");
      expect(inputShown()).toBe("012");

      pointer.mockReturnValue({ x: 999, y: 0 });
      inputBox().fire("click");
      type("3");
      expect(inputShown()).toBe("0123");
    });

    it("clicking the input box does nothing after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      type("3");
      press("Enter");
      expect(() => inputBox().fire("click")).not.toThrow();
      expect(inputShown()).toBe("3");
    });
  });

  describe("mouse cursor icons", () => {
    it("shows a text cursor over the input box while typing", () => {
      void prompt.ask(question, anchor);
      inputBox().fire("mouseenter");
      expect(document.body.style.cursor).toBe("text");
      inputBox().fire("mouseleave");
      expect(document.body.style.cursor).toBe("default");
    });

    it("does not show the text cursor after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      type("3");
      press("Enter");
      inputBox().fire("mouseenter");
      expect(document.body.style.cursor).not.toBe("text");
    });

    it("shows a hand over symbol buttons", () => {
      void prompt.ask(question, anchor);
      const button = prompt.group
        .find<Konva.Text>("Text")
        .find((t) => t.text() === "π")!
        .getParent()!;
      button.fire("mouseenter");
      expect(document.body.style.cursor).toBe("pointer");
    });

    it("resets the mouse cursor when the popup closes", async () => {
      const result = prompt.ask(question, anchor);
      inputBox().fire("mouseenter");
      press("Escape");
      await result;
      expect(document.body.style.cursor).toBe("default");
    });
  });

  describe("layout", () => {
    it("keeps the same panel height when a hint appears", () => {
      void prompt.ask(question, anchor);
      const before = panelHeight();
      type("4");
      press("Enter");
      expect(panelHeight()).toBe(before);
    });

    it("stacks the input box below the question and the symbols below the input box", () => {
      void prompt.ask(question, anchor);
      const promptText = prompt.group.find<Konva.Text>("Text")[0];
      const symbol = prompt.group.find<Konva.Text>("Text").find((t) => t.text() === "π")!;
      const symbolRow = symbol.getParent()!.getParent()!;
      expect(inputBox().y()).toBeGreaterThanOrEqual(promptText.y() + promptText.height());
      expect(symbolRow.y()).toBeGreaterThan(inputBox().y() + 40);
    });

    it("makes the panel taller for a longer question", () => {
      void prompt.ask(question, anchor);
      const short = panelHeight();
      void prompt.ask({ ...question, prompt: LONG_PROMPT }, anchor);
      expect(panelHeight()).toBeGreaterThan(short);
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
      expect(prompt.group.getChildren()[1].y()).toBe(600 - panelHeight());
    });

    it("keeps a tall popup on screen", () => {
      void prompt.ask({ ...question, prompt: LONG_PROMPT }, { x: 100, y: 590 });
      const panel = prompt.group.getChildren()[1];
      expect(panel.y() + panelHeight()).toBeLessThanOrEqual(600);
    });
  });
});

describe("QuestionPrompt answer output", () => {
  describe("correct answers resolve true", () => {
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

    it("ignores letters and other keys while typing, then accepts the answer", async () => {
      const result = prompt.ask(question, anchor);
      type("a");
      type("5");
      press("Shift");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer typed as a fraction", async () => {
      const result = prompt.ask({ ...question, answer: 0.75 }, anchor);
      type("3/4");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer entered with π symbol", async () => {
      const result = prompt.ask({ ...question, answer: Math.PI, tolerance: 0.01 }, anchor);
      clickSymbol("π");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer with √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      clickSymbol("√");
      type("25.0");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer with number next to √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("1");
      clickSymbol("√");
      type("25.0");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer with decimal next to √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("1.0");
      clickSymbol("√");
      type("25.0");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer with fraction next to √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("(5/3)");
      clickSymbol("√");
      type("9.0");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer entered with ^ symbol", async () => {
      const result = prompt.ask({ ...question, answer: 4 }, anchor);
      type("2^2");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer entered with + symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("4+1");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer entered with - symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("6-1");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("accepts an answer entered with * symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("2.5*2");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });

    it("submits the whole text wherever the cursor is", async () => {
      const result = prompt.ask(question, anchor);
      type("5");
      press("ArrowLeft");
      press("Enter");
      expect(await result).toBe(true);
      expect(prompt.group.visible()).toBe(false);
    });
  });

  describe("wrong answers and tries", () => {
    it("gives a second chance after a wrong answer", async () => {
      const result = prompt.ask(question, anchor);
      type("4");
      press("Enter"); // wrong, but one try left

      expect(prompt.group.visible()).toBe(true);
      expect(inputShown()).toBe(""); // input cleared
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

    it("resolves false when Continue is clicked after the last wrong answer", async () => {
      const result = prompt.ask(question, anchor);
      type("4");
      handlers["Submit"]();
      type("3");
      handlers["Submit"]();
      handlers["Continue"]();
      expect(await result).toBe(false);
      expect(prompt.group.visible()).toBe(false);
    });

    it("resolves false when dismissed after typing more following the last wrong answer", async () => {
      const state = track(prompt.ask(question, anchor));
      type("4");
      press("Enter");
      type("3");
      press("Enter"); // out of tries
      type("5"); // ignored
      press("Enter"); // dismisses
      await flush();
      expect(state.value).toBe(false);
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

  describe("blank answers", () => {
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

    it("submitting after entering C symbol does not use up a try", () => {
      void prompt.ask(question, anchor);
      type("4123123123");
      clickSymbol("C");
      press("Enter"); // blank, so ignored
      expect(feedbackShown()).toContain("Type an answer");
    });
  });

  describe("closing without answering resolves false", () => {
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

    it("Escape closes the popup even with additional attempts remaining", async () => {
      const result = prompt.ask(question, anchor);
      type("4");
      press("Enter"); // not out of tries
      press("Escape");
      expect(await result).toBe(false);
      expect(prompt.group.visible()).toBe(false);
    });

    it("Escape closes the popup after the last wrong answer", async () => {
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
  });
});
