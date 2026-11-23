import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionService } from "./QuestionService";
import { towerVariables } from "./TowerQuestionsHandling";
import { TOWERS, type QuestionEntry } from "../loadContent";
import { defaultConfig } from "../towerConfig";
import type { Question, QuestionTemplate, TowerConfig, TowerDef } from "../types";

// questionFor reads its questions from loadContent. These tests swap in their own groups so they
// don't break when someone edits questions.json. towerQuestions.test.ts checks the real file.
const pools = vi.hoisted(() => ({
  byGroup: {} as Record<string, QuestionEntry[]>,
  general: [] as Question[],
}));
vi.mock("../loadContent", async (importOriginal) => {
  const original = await importOriginal<typeof import("../loadContent")>();
  return { ...original, QUESTION_POOLS: pools.byGroup, GENERAL_QUESTIONS: pools.general };
});

// A fresh service for every test, since it remembers the last few questions it asked
let service: QuestionService;

// Mock question to eliminate dependency on questions.json
const q = (answer: number, tolerance = 0): Question => ({
  id: "test",
  prompt: "test prompt",
  answer,
  tolerance,
  hint: "test hint",
});

const fixed = (id: string): Question => ({
  id,
  prompt: `Question ${id}`,
  answer: 1,
  tolerance: 0,
  hint: "A hint.",
});

function template(id: string, fields: Partial<QuestionTemplate> = {}): QuestionTemplate {
  return {
    id,
    template: "The range has radius {radius}. What is its area?",
    answer: "pi * radius^2",
    hint: "Use π × {radius}².",
    ...fields,
  };
}

function towerOfKind(kind: string): TowerDef {
  const tower = TOWERS.find((t) => t.range.kind === kind);
  if (tower === undefined) throw new Error(`towers.json has no ${kind} tower`);
  return tower;
}

function sectorConfig(def: TowerDef, spread: number): TowerConfig {
  const base = defaultConfig(def);
  if (base.kind !== "sector") throw new Error(`${def.id} is not aimed like a cone`);
  return { ...base, spread };
}

const circle = towerOfKind("circle");
const sector = towerOfKind("sector");

// questionFor adds a title naming the group the question came from
const GENERAL_TITLE = "General Geometry Question";
const ownTitle = (tower: TowerDef) => `${tower.name} Question`;

// Sets the general group and one tower's own group for a test
function setPools(general: Question[], own: QuestionEntry[], tower: TowerDef = circle): void {
  pools.general.push(...general);
  pools.byGroup[tower.id] = own;
}

const random = (value: number) => vi.spyOn(Math, "random").mockReturnValue(value);

beforeEach(() => {
  service = new QuestionService();
  pools.general.length = 0;
  for (const key of Object.keys(pools.byGroup)) delete pools.byGroup[key];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuestionService functionality", () => {
  describe("reading basic numbers", () => {
    it("accepts decimals and negatives", () => {
      expect(service.check(q(2.5), "2.5")).toBe(true);
      expect(service.check(q(-3), "-3")).toBe(true);
      expect(service.check(q(0.6), ".6")).toBe(true);
    });

    it("ignores surrounding whitespace", () => {
      expect(service.check(q(5), "  5  ")).toBe(true);
    });
  });

  describe("reading fractions", () => {
    it("accepts fractions", () => {
      expect(service.check(q(0.75), "3/4")).toBe(true);
      expect(service.check(q(0.75), "6/8")).toBe(true);
      expect(service.check(q(-0.5), "-1/2")).toBe(true);
      expect(service.check(q(0.5), " 1 / 2 ")).toBe(true);
      expect(service.check(q(4 / 0.6, 0.001), "4/.6")).toBe(true);
    });
  });

  describe("reading symbols and expressions", () => {
    it("accepts π, sqrt, and their text aliases", () => {
      expect(service.check(q(Math.PI, 0.001), "π")).toBe(true);
      expect(service.check(q(Math.PI, 0.001), "PI")).toBe(true);
      expect(service.check(q(2 * Math.PI, 0.001), "2π")).toBe(true);
      expect(service.check(q(2 * Math.PI, 0.001), "2 π")).toBe(true);
      expect(service.check(q(Math.SQRT2, 0.001), "√2")).toBe(true);
      expect(service.check(q(2, 0.001), "SQRT(4)")).toBe(true);
      expect(service.check(q(Math.SQRT2 / 2, 0.001), "√2/2")).toBe(true);
    });

    it("follows operator precedence and parentheses", () => {
      expect(service.check(q(7), "1+2*3")).toBe(true);
      expect(service.check(q(9), "(1+2)*3")).toBe(true);
      expect(service.check(q(21), "3(4+3)")).toBe(true);
      expect(service.check(q(1 / 6, 1e-6), "1/2/3")).toBe(true); // left to right
    });

    it("accepts powers", () => {
      expect(service.check(q(9), "3^2")).toBe(true);
      expect(service.check(q(0.5), "2^-1")).toBe(true);
      expect(service.check(q(512), "2^3^2")).toBe(true); // right to left
      expect(service.check(q(-9), "-3^2")).toBe(true);
      expect(service.check(q(25), "(-5)^2")).toBe(true);
    });
  });

  // GENERAL_SHARE in QuestionService.ts is 0.3: a draw below it asks a general question.
  // questionFor returns a copy with a title, so these compare ids, not the objects themselves.
  describe("questionFor: choosing a group", () => {
    const [g1, g2] = [fixed("g1"), fixed("g2")];
    const [o1, o2, o3] = [fixed("o1"), fixed("o2"), fixed("o3")];

    it("asks a general question when Math.random is below 0.3", () => {
      setPools([g1, g2], [o1]);
      random(0.29);
      expect(service.questionFor(circle).id).toBe("g1");
    });

    it("asks the tower's own question from 0.3 up", () => {
      setPools([g1, g2], [o1]);
      random(0.3);
      expect(service.questionFor(circle).id).toBe("o1");
    });

    it("picks the last question just under 1, not past the end", () => {
      setPools([g1], [o1, o2, o3]);
      random(0.999999);
      expect(service.questionFor(circle).id).toBe("o3");
    });

    it("asks only general questions when the tower has none of its own", () => {
      setPools([g1, g2], []);
      random(0.99);
      expect(service.questionFor(circle).id).toBe("g2");

      delete pools.byGroup[circle.id]; // a tower with no group at all
      // a new service, so g2 isn't skipped for having just been asked
      expect(new QuestionService().questionFor(circle).id).toBe("g2");
    });

    it("asks only the tower's own questions when there are no general ones", () => {
      setPools([], [o1, o2]);
      random(0);
      expect(service.questionFor(circle).id).toBe("o1");
    });

    it("never asks another tower's questions", () => {
      setPools([], [o1]);
      pools.byGroup[sector.id] = [fixed("theirs")];
      random(0.99);
      expect(service.questionFor(circle).id).toBe("o1");
    });

    it("throws when there are no questions at all", () => {
      setPools([], []);
      expect(() => service.questionFor(circle)).toThrow(/no questions/);
    });

    it("returns a fixed question from the tower's group unchanged, apart from the title", () => {
      setPools([], [o1]);
      expect(service.questionFor(circle)).toEqual({ ...o1, title: ownTitle(circle) });
    });
  });

  describe("questionFor: titles", () => {
    const [g1, o1] = [fixed("g1"), fixed("o1")];

    it("titles a general question as general geometry", () => {
      setPools([g1], [o1]);
      random(0);
      expect(service.questionFor(circle).title).toBe(GENERAL_TITLE);
    });

    it("titles the tower's own questions with the tower's name", () => {
      setPools([g1], [o1]);
      random(0.5);
      expect(service.questionFor(circle).title).toBe(ownTitle(circle));
    });

    it("titles a template question with the tower's name", () => {
      setPools([], [template("t")]);
      expect(service.questionFor(circle).title).toBe(ownTitle(circle));
    });

    it("titles a general question as general even when the tower has no questions", () => {
      setPools([g1], []);
      expect(service.questionFor(circle).title).toBe(GENERAL_TITLE);
    });

    it("doesn't write the title onto the shared question", () => {
      setPools([g1], []);
      service.questionFor(circle);
      expect(g1).not.toHaveProperty("title");
    });
  });

  // RECENT_COUNT in QuestionService.ts is 5
  describe("questionFor: not repeating questions", () => {
    const six = ["o1", "o2", "o3", "o4", "o5", "o6"].map((id) => fixed(id));

    // With Math.random at 0, the first question that isn't skipped is always picked
    it("asks six different questions in a row from a pool of six", () => {
      setPools([], six);
      random(0);
      const ids = six.map(() => service.questionFor(circle).id);
      expect(ids).toEqual(["o1", "o2", "o3", "o4", "o5", "o6"]);
    });

    it("remembers only the last five", () => {
      setPools([], six);
      random(0);
      for (let i = 0; i < 6; i++) service.questionFor(circle);
      // o2 to o6 are the last five, so o1 can come back
      expect(service.questionFor(circle).id).toBe("o1");
    });

    it("asks a recent question again when there is nothing else to ask", () => {
      setPools([], [fixed("o1")]);
      expect(service.questionFor(circle).id).toBe("o1");
      expect(service.questionFor(circle).id).toBe("o1");
    });

    it("skips recent template questions too, though they are built fresh each time", () => {
      setPools([], [template("t1"), template("t2")]);
      random(0);
      expect(service.questionFor(circle).id).toBe("t1");
      expect(service.questionFor(circle).id).toBe("t2");
    });

    it("skips recent general questions too", () => {
      setPools([fixed("g1"), fixed("g2")], [fixed("o1")]);
      random(0); // below 0.3, so the general group every time
      expect(service.questionFor(circle).id).toBe("g1");
      expect(service.questionFor(circle).id).toBe("g2");
    });

    it("keeps separate memories for separate services", () => {
      setPools([], six);
      random(0);
      service.questionFor(circle);
      expect(new QuestionService().questionFor(circle).id).toBe("o1");
    });
  });

  describe("questionFor: templates", () => {
    it("fills the prompt and hint with the tower's numbers", () => {
      const vars = towerVariables(circle);
      setPools([], [template("t")]);

      const question = service.questionFor(circle);
      expect(question.id).toBe("t");
      expect(question.prompt).toBe(`The range has radius ${vars.radius}. What is its area?`);
      expect(question.hint).toBe(`Use π × ${vars.radius}².`);
      expect(question.answer).toBeCloseTo(Math.PI * vars.radius ** 2, 9);
    });

    it("uses the settings the player chose", () => {
      const cone = template("cone", {
        template: "The cone is {degrees}° wide. What fraction of a circle is it?",
        answer: "degrees / 360",
        hint: "Divide {degrees} by 360.",
      });
      setPools([], [cone], sector);

      const question = service.questionFor(sector, sectorConfig(sector, Math.PI / 2));
      expect(question.prompt).toBe("The cone is 90° wide. What fraction of a circle is it?");
      expect(question.hint).toBe("Divide 90 by 360.");
      expect(question.answer).toBe(0.25);
    });

    it("uses the tower's default settings when none are given", () => {
      setPools([], [template("cone", { template: "{degrees}°", answer: "degrees" })], sector);
      expect(service.questionFor(sector)).toEqual(
        service.questionFor(sector, defaultConfig(sector)),
      );
    });

    it.each([
      ["2 pi radius", (v: Record<string, number>) => 2 * Math.PI * v.radius],
      ["sqrt(area / pi)", (v: Record<string, number>) => Math.sqrt(v.area / Math.PI)],
      ["diameter^2 / 4", (v: Record<string, number>) => v.diameter ** 2 / 4],
      ["(radius + 1)(radius - 1)", (v: Record<string, number>) => (v.radius + 1) * (v.radius - 1)],
      ["damage * rate", (v: Record<string, number>) => v.damage * v.rate],
    ])("works out the formula %s", (formula, expected) => {
      setPools([], [template("t", { answer: formula })]);
      const question = service.questionFor(circle);
      expect(question.answer).toBeCloseTo(expected(towerVariables(circle)), 9);
    });

    describe("tolerance", () => {
      it.each([
        ["a fixed tolerance", { tolerance: 0.5 }, () => 0.5],
        ["a relative tolerance", { relativeTolerance: 0.01 }, (a: number) => Math.abs(a) * 0.01],
        [
          "the fixed one when both are given",
          { tolerance: 0.5, relativeTolerance: 0.01 },
          () => 0.5,
        ],
        ["0 when none is given", {}, () => 0],
      ])("uses %s", (_label, fields, expected) => {
        setPools([], [template("t", fields)]);
        const question = service.questionFor(circle);
        expect(question.tolerance).toBeCloseTo(expected(question.answer), 12);
      });

      it("accepts answers within a relative tolerance", () => {
        setPools([], [template("t", { relativeTolerance: 0.01 })]);
        const question = service.questionFor(circle);
        expect(service.check(question, String(question.answer * 1.005))).toBe(true);
        expect(service.check(question, String(question.answer * 1.02))).toBe(false);
      });
    });

    describe("templates that can't be asked", () => {
      it("skips a template that needs a number this tower doesn't have", () => {
        const cone = template("cone", { template: "The cone is {degrees}° wide.", answer: "1" });
        setPools([], [cone, fixed("o1")]);
        random(0.99);
        expect(service.questionFor(circle).id).toBe("o1");
      });

      it("skips it when only the hint needs the missing number", () => {
        setPools([], [template("t", { hint: "Divide {degrees} by 360." }), fixed("o1")]);
        random(0.99);
        expect(service.questionFor(circle).id).toBe("o1");
      });

      it.each(["radius +", "radius / (damage - damage)", "sqrt(0 - radius)", "radius * cones"])(
        "skips a template whose formula %s can't be worked out",
        (formula) => {
          setPools([], [template("t", { answer: formula }), fixed("o1")]);
          random(0.99);
          expect(service.questionFor(circle).id).toBe("o1");
        },
      );

      it("falls back to the general group when none of the tower's templates work", () => {
        const g1 = fixed("g1");
        setPools([g1], [template("t", { answer: "radius +" })]);
        random(0.99);
        expect(service.questionFor(circle).id).toBe("g1");
      });
    });
  });
});

describe("QuestionService answer output", () => {
  describe("correct and wrong answers", () => {
    it("accepts the correct answer", () => {
      expect(service.check(q(5), "5")).toBe(true);
    });

    it("rejects a wrong answer", () => {
      expect(service.check(q(5), "4")).toBe(false);
      expect(service.check(q(5), "5.1")).toBe(false);
    });

    it("rejects a wrong fraction", () => {
      expect(service.check(q(0.75), "1/4")).toBe(false);
    });

    it("does not reject answers because of floating point noise", () => {
      expect(service.check(q(0.3), String(0.1 + 0.2))).toBe(true);
    });
  });

  describe("tolerance", () => {
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

    it("accepts a fraction within the tolerance", () => {
      expect(service.check(q(0.33, 0.01), "1/3")).toBe(true);
    });

    it("uses the tolerance with π answers", () => {
      const question = q(Math.PI, 0.01);
      expect(service.check(question, "π")).toBe(true);
      expect(service.check(question, "3.14")).toBe(true);
      expect(service.check(question, "3.2")).toBe(false);
    });
  });

  describe("rejected input", () => {
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
      expect(service.check(q(5), "--5")).toBe(false);
      expect(service.check(q(5), "Infinity")).toBe(false);
      expect(service.check(q(5), "NaN")).toBe(false);
    });

    it("rejects scientific and hex notation", () => {
      expect(service.check(q(10), "1e1")).toBe(false);
      expect(service.check(q(16), "0x10")).toBe(false);
    });

    it("rejects malformed fractions", () => {
      expect(service.check(q(5), "3/0")).toBe(false); // divide by zero
      expect(service.check(q(5), "/")).toBe(false);
      expect(service.check(q(5), "3/")).toBe(false);
      expect(service.check(q(5), "/4")).toBe(false);
      expect(service.check(q(5), "a/b")).toBe(false);
    });

    it("rejects malformed expressions even when the answer would match a mis-parse", () => {
      expect(service.check(q(55), "5 5")).toBe(false);
      expect(service.check(q(5), "5+")).toBe(false);
      expect(service.check(q(5), "+5")).toBe(false);
      expect(service.check(q(5), "()")).toBe(false);
      expect(service.check(q(5), "(5")).toBe(false);
      expect(service.check(q(5), "5)")).toBe(false);
      expect(service.check(q(5), "2**3")).toBe(false);
      expect(service.check(q(5), "√")).toBe(false);
      expect(service.check(q(5), "3^")).toBe(false);
      expect(service.check(q(5), "2π3")).toBe(false);
    });

    it("rejects impossible math", () => {
      expect(service.check(q(0), "1/(1-1)")).toBe(false);
      expect(service.check(q(2), "√(-4)")).toBe(false);
      expect(service.check(q(0), "9^9^9")).toBe(false); // overflows to Infinity
    });
  });
});
