import { afterEach, describe, expect, it, vi } from "vitest";
import { towerVariables } from "./TowerQuestionsHandling";
import { QuestionService } from "./QuestionService";
import { defaultConfig, fireRateFor, rangeReach } from "../towerConfig";
import {
  COMMON_VARIABLES,
  GENERAL_QUESTIONS,
  QUESTION_POOLS,
  TOWERS,
  VARIABLES_BY_KIND,
} from "../loadContent";
import type { TowerConfig, TowerDef } from "../types";

afterEach(() => {
  vi.restoreAllMocks();
});

const round = (n: number, places = 2): number => Math.round(n * 10 ** places) / 10 ** places;

function towerOfKind(kind: string): TowerDef {
  const tower = TOWERS.find((t) => t.range.kind === kind);
  if (tower === undefined) throw new Error(`towers.json has no ${kind} tower`);
  return tower;
}

// The real tower, with a range radius chosen by the test
function circleWithRadius(radius: number): TowerDef {
  const tower = towerOfKind("circle");
  if (tower.range.kind !== "circle") throw new Error("not a circle tower");
  return { ...tower, range: { ...tower.range, radius } };
}

// The tower's default aim, with the cone opened to `spread` radians
function sectorConfig(def: TowerDef, spread: number): TowerConfig {
  const base = defaultConfig(def);
  if (base.kind !== "sector") throw new Error(`${def.id} is not aimed like a cone`);
  return { ...base, spread };
}

// The tower's default block, resized
function rectConfig(def: TowerDef, width: number, depth: number): TowerConfig {
  const base = defaultConfig(def);
  if (base.kind !== "rect") throw new Error(`${def.id} is not aimed like a block`);
  return { ...base, width, depth };
}

const towerCases = TOWERS.map((tower) => [tower.id, tower] as const);

describe("towerVariables", () => {
  describe("every tower", () => {
    // checkQuestions allows exactly these names, so a template can never ask for a missing one
    it.each(towerCases)("gives %s exactly the names its templates may use", (_id, tower) => {
      const names = Object.keys(towerVariables(tower)).sort();
      const allowed = [...COMMON_VARIABLES, ...(VARIABLES_BY_KIND[tower.range.kind] ?? [])].sort();
      expect(names).toEqual(allowed);
    });

    it.each(towerCases)("gives %s its damage and rounded fire rate", (_id, tower) => {
      const vars = towerVariables(tower);
      expect(vars.damage).toBe(tower.damage);
      expect(vars.rate).toBe(round(fireRateFor(tower, defaultConfig(tower))));
    });

    it.each(towerCases)("uses %s's default settings when none are given", (_id, tower) => {
      expect(towerVariables(tower)).toEqual(towerVariables(tower, defaultConfig(tower)));
    });

    it.each(towerCases)("gives %s only finite numbers", (_id, tower) => {
      for (const [name, value] of Object.entries(towerVariables(tower))) {
        expect(Number.isFinite(value), name).toBe(true);
      }
    });
  });

  describe("circle towers", () => {
    it("works out the diameter, circumference and area", () => {
      const vars = towerVariables(circleWithRadius(2.5));
      expect(vars.radius).toBe(2.5);
      expect(vars.diameter).toBe(5);
      expect(vars.circumference).toBe(15.71); // 2π × 2.5 = 15.7079…
      expect(vars.area).toBe(19.63); // π × 2.5² = 19.6349…
    });

    // The player only sees 1.24, so the other numbers must come from 1.24, not 1.236
    it("rounds the radius first and works from the rounded value", () => {
      const vars = towerVariables(circleWithRadius(1.236));
      expect(vars.radius).toBe(1.24);
      expect(vars.diameter).toBe(2.48); // 2 × 1.236 would give 2.47
      expect(vars.circumference).toBe(7.79); // from 1.236: 7.77
      expect(vars.area).toBe(4.83); // from 1.236: 4.80
    });
  });

  describe("cone (sector) towers", () => {
    const sector = towerOfKind("sector");

    it("turns a 45° cone into an eighth of a circle", () => {
      const vars = towerVariables(sector, sectorConfig(sector, Math.PI / 4));
      expect(vars.degrees).toBe(45);
      expect(vars.fraction).toBe(0.125);
      expect(vars.fractionDecimal).toBe(0.125);
    });

    it("keeps the exact fraction for formulas and rounds the one the player sees", () => {
      const vars = towerVariables(sector, sectorConfig(sector, Math.PI / 3));
      expect(vars.degrees).toBe(60);
      expect(vars.fraction).toBe(60 / 360);
      expect(vars.fractionDecimal).toBe(0.167);
    });

    it("shows whole degrees and works from them", () => {
      const vars = towerVariables(sector, sectorConfig(sector, 0.5)); // 28.65°
      expect(vars.degrees).toBe(29);
      expect(vars.fraction).toBe(29 / 360);
    });

    it("rounds the radius to one decimal place", () => {
      const config = sectorConfig(sector, Math.PI / 4);
      expect(towerVariables(sector, config).radius).toBe(round(rangeReach(sector, config), 1));
    });

    it.each([Math.PI / 6, Math.PI / 4, Math.PI / 2, 1])(
      "works out the area and arc from the numbers the player sees (spread %f)",
      (spread) => {
        const vars = towerVariables(sector, sectorConfig(sector, spread));
        expect(vars.area).toBe(round(vars.fraction * Math.PI * vars.radius ** 2));
        expect(vars.arc).toBe(round(vars.fraction * 2 * Math.PI * vars.radius));
      },
    );
  });

  describe("block (rect) towers", () => {
    const rect = towerOfKind("rect");

    it("uses the block's size", () => {
      const vars = towerVariables(rect, rectConfig(rect, 2, 3));
      expect(vars.width).toBe(2);
      expect(vars.depth).toBe(3);
      expect(vars.area).toBe(6);
    });

    it("gives the base rate and the rate area from towers.json", () => {
      const vars = towerVariables(rect);
      expect(vars.baseRate).toBe(round(rect.fireRatePerSec));
      if (rect.range.kind !== "rect") throw new Error("not a rect tower");
      expect(vars.rateArea).toBe(rect.range.rateArea);
    });
  });
});

// Builds every template in the real questions.json through QuestionService, so a formula that
// can't be worked out (and would be skipped quietly in the game) fails here instead.
describe("questions.json templates", () => {
  it.each(towerCases)("can all be asked for %s with its default settings", (_id, tower) => {
    const pool = QUESTION_POOLS[tower.id] ?? [];
    const service = new QuestionService();
    const random = vi.spyOn(Math, "random");
    const asked = new Set<string>();

    for (let i = 0; i < pool.length; i++) {
      // First draw: skip the general group (only drawn when there are general questions).
      // Second draw: the i-th of the tower's own questions.
      if (GENERAL_QUESTIONS.length > 0) random.mockReturnValueOnce(0.99);
      random.mockReturnValueOnce((i + 0.5) / pool.length);

      const question = service.questionFor(tower);
      asked.add(question.id);

      expect(Number.isFinite(question.answer), question.id).toBe(true);
      expect(question.tolerance, question.id).toBeGreaterThanOrEqual(0);
      for (const text of [question.prompt, question.hint]) {
        expect(text, question.id).not.toMatch(/[{}]|undefined|NaN/);
      }
    }

    // A template that didn't build shifts the pool, so some id would be missing here
    expect([...asked].sort()).toEqual(pool.map((entry) => entry.id).sort());
  });
});
