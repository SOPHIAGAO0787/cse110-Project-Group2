import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionService } from "./QuestionService";
import { QUESTIONS, TOWERS } from "../loadContent";
import type { Question } from "../types";

const service = new QuestionService();

// Mock question to elimiate dependency on questions.json
const q = (answer: number, tolerance = 0): Question => ({
  id: "test",
  prompt: "test prompt",
  answer,
  tolerance,
  hint: "test hint",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuestionService (M1)", () => {
  describe("check", () => {
    it("accepts the correct answer", () => {
      expect(service.check(q(5), "5")).toBe(true);
    });

    it("accepts decimals and negatives", () => {
      expect(service.check(q(2.5), "2.5")).toBe(true);
      expect(service.check(q(-3), "-3")).toBe(true);
    });

    it("accepts fractions", () => {
      expect(service.check(q(0.75), "3/4")).toBe(true);
      expect(service.check(q(0.75), "6/8")).toBe(true);
      expect(service.check(q(-0.5), "-1/2")).toBe(true);
      expect(service.check(q(0.5), " 1 / 2 ")).toBe(true);
      expect(service.check(q(4 / 0.6, 0.001), "4/.6")).toBe(true);
    });

    it("accepts a fraction within the tolerance", () => {
      expect(service.check(q(0.33, 0.01), "1/3")).toBe(true);
    });

    it("rejects a wrong fraction", () => {
      expect(service.check(q(0.75), "1/4")).toBe(false);
    });

    it("rejects malformed fractions", () => {
      expect(service.check(q(5), "3/0")).toBe(false); // divide by zero
      expect(service.check(q(5), "1/2/3")).toBe(false);
      expect(service.check(q(5), "/")).toBe(false);
      expect(service.check(q(5), "3/")).toBe(false);
      expect(service.check(q(5), "/4")).toBe(false);
      expect(service.check(q(5), "a/b")).toBe(false);
    });

    it("ignores surrounding whitespace", () => {
      expect(service.check(q(5), "  5  ")).toBe(true);
    });

    it("rejects a wrong answer", () => {
      expect(service.check(q(5), "4")).toBe(false);
      expect(service.check(q(5), "5.1")).toBe(false);
    });

    it("accepts an answer within the tolerance", () => {
      const question = q(10, 0.5);
      expect(service.check(question, "9.5")).toBe(true);
      expect(service.check(question, "10.5")).toBe(true);
      expect(service.check(question, "10.2")).toBe(true);
    });

    it("rejects an answer outside the tolerance", () => {
      const question = q(10, 0.5);
      expect(service.check(question, "10.6")).toBe(false);
      expect(service.check(question, "9.4")).toBe(false);
    });

    it("does not reject answers because of floating point noise", () => {
      expect(service.check(q(0.3), String(0.1 + 0.2))).toBe(true);
    });

    it("treats empty input as wrong, even when the answer is 0", () => {
      expect(service.check(q(5), "")).toBe(false);
      expect(service.check(q(0), "")).toBe(false);
      expect(service.check(q(0), "   ")).toBe(false);
    });

    it("treats non-number input as wrong", () => {
      expect(service.check(q(5), "abc")).toBe(false);
      expect(service.check(q(5), "5abc")).toBe(false);
      expect(service.check(q(5), "-")).toBe(false);
      expect(service.check(q(5), ".")).toBe(false);
      expect(service.check(q(5), "5.5.5")).toBe(false);
      expect(service.check(q(10), "1e1")).toBe(false);
      expect(service.check(q(16), "0x10")).toBe(false);
      expect(service.check(q(5), "--5")).toBe(false);
      expect(service.check(q(5), "")).toBe(false);
      expect(service.check(q(5), "Infinity")).toBe(false);
      expect(service.check(q(5), "NaN")).toBe(false);
    });
  });

  describe("questionFor", () => {
    const tower = TOWERS[0];

    it("returns a question from questions.json", () => {
      expect(QUESTIONS).toContain(service.questionFor(tower));
    });

    it("picks by Math.random", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(service.questionFor(tower)).toBe(QUESTIONS[0]);

      // just under 1 must map to the last question, not past the end
      vi.spyOn(Math, "random").mockReturnValue(0.999999);
      expect(service.questionFor(tower)).toBe(QUESTIONS[QUESTIONS.length - 1]);
    });
  });
});
