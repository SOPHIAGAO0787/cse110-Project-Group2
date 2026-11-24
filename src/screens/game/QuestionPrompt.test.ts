// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionPrompt } from "./QuestionPrompt";
import { QuestionService, type PickedQuestion } from "../../model/questions/QuestionService";

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

const question: PickedQuestion = {
  id: "test",
  prompt: "What is 2 + 3?",
  answer: 5,
  tolerance: 0,
  hint: "Add them.",
  title: "Test Question",
};
const anchor = { x: 100, y: 100 };

// Long prompt to test adjustable question panel height
const LONG_PROMPT = "What is the area of this shape? ".repeat(30);

// Colors QuestionPrompt.ts uses
const WRONG_RED = "#dc2626"; // a wrong answer kept in the box
const ANSWER_GREEN = "#15803d"; // the right answer in the box
const FEEDBACK_RED = "#ff6b6b";
const FEEDBACK_GREEN = "#4ade80";

const PANEL_W = 320;

const press = (key: string) => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
};
const type = (text: string) => {
  for (const ch of text) press(ch);
};

// Uses up both tries with wrong answers. The first answer stays in the box,
// so the second one is "43". Afterwards the box shows the right answer.
const useAllTries = () => {
  type("4");
  press("Enter");
  type("3");
  press("Enter");
};

// The prompt's own parts, reached directly so the tests don't depend on the order
// they were added to the panel in
interface Parts {
  panel: Konva.Rect;
  titleText: Konva.Text;
  promptText: Konva.Text;
  inputBox: Konva.Rect;
  inputText: Konva.Text;
  answerLabel: Konva.Text;
  feedback: Konva.Text;
  closeButton: Konva.Group;
}
const parts = () => prompt as unknown as Parts;

const inputShown = () => parts().inputText.text();
const feedbackShown = () => parts().feedback.text();
const inputBox = () => parts().inputBox;
const panelHeight = () => parts().panel.height();
const clickSymbol = (symbol: string) =>
  prompt.group
    .find<Konva.Text>("Text")
    .find((t) => t.text() === symbol)!
    .getParent()!
    .fire("click");
const centerOf = (node: Konva.Text) => node.x() + node.width() / 2;

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
  prompt.cancel(); // make sure no popup or key listener leaks between tests
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

    it("shows the question's title and prompt", () => {
      void prompt.ask(question, anchor);
      expect(parts().titleText.text()).toBe("Test Question");
      expect(parts().promptText.text()).toBe("What is 2 + 3?");
    });

    it("keeps its key listener while showing Correct!, and removes it once closed", async () => {
      const remove = vi.spyOn(window, "removeEventListener");
      const result = prompt.ask(question, anchor);
      type("5");
      press("Enter");
      await result;
      expect(remove).not.toHaveBeenCalledWith("keydown", expect.any(Function)); // still open

      press("Enter");
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
      useAllTries();
      type("7"); // ignored: the prompt is in the "wrong" phase
      expect(inputShown()).toBe("5"); // the right answer, shown in the box
    });

    it("does not accept more typing while showing Correct!", () => {
      void prompt.ask(question, anchor);
      type("5");
      press("Enter");
      type("7");
      expect(inputShown()).toBe("5");
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
      useAllTries();
      clickSymbol("π");
      clickSymbol("C");
      expect(inputShown()).toBe("5");
    });

    it("symbol buttons do nothing while showing Correct!", () => {
      void prompt.ask(question, anchor);
      type("5");
      press("Enter");
      clickSymbol("π");
      clickSymbol("C");
      expect(inputShown()).toBe("5");
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

    it("moves the cursor to the end after a wrong answer, and resets it for a new question", () => {
      void prompt.ask(question, anchor);
      type("45");
      press("ArrowLeft");
      press("Enter"); // wrong: "45" stays, with the cursor after it
      type("6");
      expect(inputShown()).toBe("456");

      void prompt.ask(question, anchor);
      type("1");
      expect(inputShown()).toBe("1");
    });

    it("arrow keys are ignored after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      useAllTries();
      expect(() => press("ArrowLeft")).not.toThrow();
      expect(inputShown()).toBe("5");
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
      useAllTries();
      expect(() => inputBox().fire("click")).not.toThrow();
      expect(inputShown()).toBe("5");
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
      useAllTries();
      inputBox().fire("mouseenter");
      expect(document.body.style.cursor).not.toBe("text");
    });

    it("does not show the text cursor while showing Correct!", () => {
      void prompt.ask(question, anchor);
      type("5");
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

    it("keeps the same panel height after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      const before = panelHeight();
      useAllTries();
      expect(panelHeight()).toBe(before);
    });

    it("keeps the same panel height when showing Correct!", () => {
      void prompt.ask(question, anchor);
      const before = panelHeight();
      type("5");
      press("Enter");
      expect(panelHeight()).toBe(before);
    });

    it("stacks the title, the question, the input box and the symbols from the top down", () => {
      void prompt.ask(question, anchor);
      const { titleText, promptText } = parts();
      const symbol = prompt.group.find<Konva.Text>("Text").find((t) => t.text() === "π")!;
      const symbolRow = symbol.getParent()!.getParent()!;
      expect(promptText.y()).toBeGreaterThanOrEqual(titleText.y() + titleText.height());
      expect(inputBox().y()).toBeGreaterThanOrEqual(promptText.y() + promptText.height());
      expect(symbolRow.y()).toBeGreaterThan(inputBox().y() + 40);
    });

    it("centers the title and the question in the panel", () => {
      void prompt.ask(question, anchor);
      expect(centerOf(parts().titleText)).toBe(PANEL_W / 2);
      expect(centerOf(parts().promptText)).toBe(PANEL_W / 2);
    });

    it("keeps the title clear of the close button, and starts the question below it", () => {
      void prompt.ask(question, anchor);
      const { titleText, promptText, closeButton } = parts();
      expect(titleText.x() + titleText.width()).toBeLessThanOrEqual(closeButton.x());
      expect(promptText.y()).toBeGreaterThanOrEqual(closeButton.y() + 30); // CLOSE_SIZE
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
  // A correct answer resolves true at once, so the tower is placed straight away,
  // but the popup stays open showing "Correct!" until the player closes it
  describe("correct answers resolve true", () => {
    it("resolves true when the typed answer is correct and Enter is pressed", async () => {
      const result = prompt.ask(question, anchor);
      type("5");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("resolves true when Submit is clicked with a correct answer", async () => {
      const result = prompt.ask(question, anchor);
      type("5");
      handlers["Submit"]();
      expect(await result).toBe(true);
    });

    it("ignores letters and other keys while typing, then accepts the answer", async () => {
      const result = prompt.ask(question, anchor);
      type("a");
      type("5");
      press("Shift");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer typed as a fraction", async () => {
      const result = prompt.ask({ ...question, answer: 0.75 }, anchor);
      type("3/4");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer entered with π symbol", async () => {
      const result = prompt.ask({ ...question, answer: Math.PI, tolerance: 0.01 }, anchor);
      clickSymbol("π");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer with √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      clickSymbol("√");
      type("25.0");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer with number next to √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("1");
      clickSymbol("√");
      type("25.0");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer with decimal next to √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("1.0");
      clickSymbol("√");
      type("25.0");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer with fraction next to √ symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("(5/3)");
      clickSymbol("√");
      type("9.0");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer entered with ^ symbol", async () => {
      const result = prompt.ask({ ...question, answer: 4 }, anchor);
      type("2^2");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer entered with + symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("4+1");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer entered with - symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("6-1");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("accepts an answer entered with * symbol", async () => {
      const result = prompt.ask(question, anchor);
      type("2.5*2");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("submits the whole text wherever the cursor is", async () => {
      const result = prompt.ask(question, anchor);
      type("5");
      press("ArrowLeft");
      press("Enter");
      expect(await result).toBe(true);
    });
  });

  describe("after a correct answer", () => {
    it("resolves true straight away, before the popup is closed", async () => {
      const state = track(prompt.ask(question, anchor));
      type("5");
      press("Enter");
      await flush();
      expect(state.value).toBe(true);
      expect(prompt.group.visible()).toBe(true);
    });

    it("shows Correct! in green, with the answer in green in the box", () => {
      void prompt.ask(question, anchor);
      type("5");
      press("Enter");
      expect(feedbackShown()).toBe("Correct!");
      expect(parts().feedback.fill()).toBe(FEEDBACK_GREEN);
      expect(inputShown()).toBe("5");
      expect(parts().inputText.fill()).toBe(ANSWER_GREEN);
    });

    it.each([
      ["Enter", () => press("Enter")],
      ["Escape", () => press("Escape")],
      ["Continue", () => handlers["Continue"]()],
      ["the close button", () => parts().closeButton.fire("click")],
    ])("closes with %s, and the result stays true", async (_label, close) => {
      const result = prompt.ask(question, anchor);
      type("5");
      press("Enter");
      close();
      expect(prompt.group.visible()).toBe(false);
      expect(await result).toBe(true);
    });

    it("cancel() closes it, and the result stays true", async () => {
      const result = prompt.ask(question, anchor);
      type("5");
      press("Enter");
      prompt.cancel();
      expect(prompt.group.visible()).toBe(false);
      expect(await result).toBe(true);
    });

    it("a new question can be asked while it is showing", async () => {
      void prompt.ask(question, anchor);
      type("5");
      press("Enter");

      const second = prompt.ask(question, anchor);
      expect(feedbackShown()).toBe("");
      expect(inputShown()).toBe("");
      type("5");
      press("Enter");
      expect(await second).toBe(true);
    });
  });

  describe("wrong answers and tries", () => {
    it("gives a second chance after a wrong answer", async () => {
      const result = prompt.ask(question, anchor);
      type("4");
      press("Enter"); // wrong, but one try left

      expect(prompt.group.visible()).toBe(true);
      expect(feedbackShown()).toContain("1 try left");

      press("Backspace");
      type("5");
      press("Enter");
      expect(await result).toBe(true);
    });

    it("keeps the wrong answer in the box in red", () => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      expect(inputShown()).toBe("4");
      expect(parts().inputText.fill()).toBe(WRONG_RED);
    });

    it.each([
      ["typing", () => type("1")],
      ["Backspace", () => press("Backspace")],
      ["a symbol button", () => clickSymbol("π")],
      ["C", () => clickSymbol("C")],
    ])("turns the kept answer black again after %s", (_label, edit) => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      edit();
      expect(parts().inputText.fill()).toBe("black");
    });

    it("keeps the answer red when only the cursor moves", () => {
      void prompt.ask(question, anchor);
      type("4");
      press("Enter");
      press("ArrowLeft");
      expect(parts().inputText.fill()).toBe(WRONG_RED);
    });

    it("lets the player fix the kept answer instead of retyping it", async () => {
      const result = prompt.ask(question, anchor);
      type("15");
      press("Enter"); // wrong: "15" stays, cursor at the end
      press("ArrowLeft");
      press("Backspace"); // removes the 1
      expect(inputShown()).toBe("5");
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
      useAllTries();
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
      useAllTries();
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

  describe("after the last wrong answer", () => {
    it("shows the right answer in green in the box, labeled", () => {
      void prompt.ask(question, anchor);
      useAllTries();
      expect(inputShown()).toBe("5");
      expect(parts().inputText.fill()).toBe(ANSWER_GREEN);
      expect(parts().answerLabel.visible()).toBe(true);
      expect(parts().answerLabel.getParent()).not.toBeNull();
    });

    it("says what the player answered, and gives the hint", () => {
      void prompt.ask(question, anchor);
      useAllTries();
      expect(feedbackShown()).toContain("Not quite.");
      expect(feedbackShown()).toContain("You answered 43.");
      expect(feedbackShown()).toContain("Add them.");
    });

    it.each([
      ["a whole number", 180, "180"],
      ["a decimal, rounded to 2 places", 2 / 3, "0.67"],
      ["a multiple of π, both ways", 9 * Math.PI, "9π (≈ 28.27)"],
      ["π itself, without a 1", Math.PI, "π (≈ 3.14)"],
      ["a decimal multiple of π", 6.25 * Math.PI, "6.25π (≈ 19.63)"],
    ])("shows %s", (_label, answer, shown) => {
      void prompt.ask({ ...question, answer, tolerance: 0.001 }, anchor);
      useAllTries();
      expect(inputShown()).toBe(shown);
    });
  });

  describe("a new question starts clean", () => {
    it("after the last wrong answer", () => {
      void prompt.ask(question, anchor);
      useAllTries();
      void prompt.ask(question, anchor);
      expect(inputShown()).toBe("");
      expect(parts().inputText.fill()).toBe("black");
      expect(parts().answerLabel.visible()).toBe(false);
      expect(inputBox().strokeWidth()).toBe(0);
    });

    it("after a correct answer", () => {
      void prompt.ask(question, anchor);
      type("5");
      press("Enter");
      void prompt.ask(question, anchor);
      expect(parts().inputText.fill()).toBe("black");
      expect(parts().feedback.fill()).toBe(FEEDBACK_RED);
      expect(inputBox().strokeWidth()).toBe(0);

      type("4");
      press("Enter"); // the wrong-answer message is red again
      expect(parts().feedback.fill()).toBe(FEEDBACK_RED);
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
      useAllTries(); // Continue is showing
      press("Escape");
      expect(await result).toBe(false);
      expect(prompt.group.visible()).toBe(false);
    });

    it("the close button closes the popup and resolves false", async () => {
      const result = prompt.ask(question, anchor);
      parts().closeButton.fire("click");
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
