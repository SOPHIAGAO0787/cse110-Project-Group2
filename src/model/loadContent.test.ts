import { describe, expect, it } from "vitest";
import {
  checkQuestions,
  findMap,
  findTileset,
  GENERAL_QUESTIONS,
  isTemplate,
  loadMap,
  MAPS,
  QUESTION_POOLS,
  QUESTIONS,
  TILESETS,
  TOWERS,
  VARIABLES_BY_KIND,
  type QuestionEntry,
} from "./loadContent";
import map1 from "../data/maps/map1.json";

// A tiny valid map: path runs left to right along row 1
function validMap() {
  return {
    id: "test",
    name: "Test",
    colors: { buildable: "#00ff00", path: "#996633", blocked: "#000000" },
    decoration: "trees",
    cols: 4,
    rows: 3,
    tiles: ["#...", "PPPP", "...#"],
    path: [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
    ],
    startingCoins: 100,
    startingLives: 20,
    waves: [{ groups: [{ enemy: "basic", count: 3, intervalSec: 1 }] }],
  };
}

describe("loadMap", () => {
  it("accepts the real Map 1", () => {
    const map = loadMap(map1);
    expect(map.cols).toBe(16);
    expect(map.tiles).toHaveLength(map.rows);
  });

  it("accepts a valid map", () => {
    expect(loadMap(validMap()).id).toBe("test");
  });

  it("rejects a map whose row count doesn't match rows", () => {
    const map = { ...validMap(), rows: 4 };
    expect(() => loadMap(map)).toThrow(/rows/);
  });

  it("rejects a map without colors", () => {
    const map = { ...validMap(), colors: undefined };
    expect(() => loadMap(map)).toThrow(/colors/);
  });

  it("rejects a map whose colors are null", () => {
    const map = { ...validMap(), colors: null };
    expect(() => loadMap(map)).toThrow(/colors/);
  });

  it("rejects a map missing one of its colors", () => {
    const map = { ...validMap(), colors: { buildable: "#00ff00", path: "#996633" } };
    expect(() => loadMap(map)).toThrow(/colors/);
  });

  it("rejects an unknown decoration", () => {
    const map = { ...validMap(), decoration: "flowers" };
    expect(() => loadMap(map)).toThrow(/flowers/);
  });

  it("rejects a row with the wrong width", () => {
    const map = { ...validMap(), tiles: ["#...", "PPPPP", "...#"] };
    expect(() => loadMap(map)).toThrow(/row 1/);
  });

  it("rejects an unknown tile character", () => {
    const map = { ...validMap(), tiles: ["#..x", "PPPP", "...#"] };
    expect(() => loadMap(map)).toThrow(/'x'/);
  });

  it("rejects a diagonal path segment", () => {
    const map = {
      ...validMap(),
      tiles: ["#...", "PPPP", "...P"],
      path: [
        { x: 0, y: 1 },
        { x: 3, y: 2 },
      ],
    };
    expect(() => loadMap(map)).toThrow(/diagonal/);
  });

  it("rejects a path point that is not on a 'P' tile", () => {
    const map = {
      ...validMap(),
      path: [
        { x: 0, y: 1 },
        { x: 3, y: 0 },
      ],
    };
    expect(() => loadMap(map)).toThrow(/\(3, 0\)/);
  });
});

describe("loadMap with a tileset", () => {
  // The road runs along row 1, so every piece on it is a straight one running east and west
  const art = ["#...", "....", "...#"];

  it("accepts a map that names a tileset and leaves the art to be worked out", () => {
    expect(loadMap({ ...validMap(), tileset: "meadow" }).tileset).toBe("meadow");
  });

  it("accepts a map whose art fits its tiles and route", () => {
    expect(loadMap({ ...validMap(), tileset: "meadow", art }).art).toEqual(art);
  });

  it("rejects a tileset that does not exist", () => {
    expect(() => loadMap({ ...validMap(), tileset: "volcano" })).toThrow(
      /Unknown tileset "volcano"/,
    );
  });

  it("rejects art without a tileset to read it with", () => {
    expect(() => loadMap({ ...validMap(), art })).toThrow(/test: has art but no tileset/);
  });

  it("rejects art that does not fit the map, naming the map", () => {
    const wrongKind = ["#...", "-.--", "...#"];
    expect(() => loadMap({ ...validMap(), tileset: "meadow", art: wrongKind })).toThrow(
      /^test: art/,
    );
  });

  it("checks the art only after the tiles and route, so a bad route is reported as such", () => {
    const map = { ...validMap(), tileset: "meadow", path: [{ x: 0, y: 0 }] };
    expect(() => loadMap(map)).toThrow(/not a 'P' tile/);
  });
});

describe("TILESETS", () => {
  it("has a different id for every tileset", () => {
    const ids = TILESETS.map((tileset) => tileset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("finds a tileset by its id", () => {
    expect(findTileset("meadow").id).toBe("meadow");
  });

  it("throws for an unknown id", () => {
    expect(() => findTileset("nope")).toThrow(/Unknown tileset "nope"/);
  });
});

describe("MAPS", () => {
  it("has four maps with different ids", () => {
    expect(MAPS).toHaveLength(4);
    const ids: string[] = [];
    for (const map of MAPS) {
      expect(ids).not.toContain(map.id);
      ids.push(map.id);
    }
  });

  // The game screen's layout is made for this size
  it("makes every map 16 by 10 tiles", () => {
    for (const map of MAPS) {
      expect(map.cols).toBe(16);
      expect(map.rows).toBe(10);
    }
  });

  it("starts with map1", () => {
    expect(MAPS[0].id).toBe("map1");
  });
});

describe("findMap", () => {
  it("finds a map by its id", () => {
    expect(findMap("map2").name).toBe("Angle Canyon");
  });

  it("throws for an unknown id", () => {
    expect(() => findMap("map9")).toThrow(/map9/);
  });
});

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

function towerOfKind(kind: string) {
  const tower = TOWERS.find((t) => t.range.kind === kind);
  if (tower === undefined) throw new Error(`towers.json has no ${kind} tower`);
  return tower;
}

const circle = towerOfKind("circle");

// Runs checkQuestions on hand-written groups. Broken entries are cast, since catching them is the point.
function check(pools: Record<string, unknown[]>): () => void {
  return () => checkQuestions(pools as Record<string, QuestionEntry[]>);
}

const fixedQ = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  level: 1,
  prompt: "What is 2 + 2?",
  answer: 4,
  tolerance: 0,
  hint: "Add them.",
  ...fields,
});

const templateQ = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  level: 1,
  template: "The range has radius {radius}. What is its diameter?",
  answer: "2 * radius",
  hint: "Double {radius}.",
  ...fields,
});

describe("isTemplate", () => {
  it("tells templates from fixed questions", () => {
    expect(isTemplate(templateQ("t") as QuestionEntry)).toBe(true);
    expect(isTemplate(fixedQ("f") as QuestionEntry)).toBe(false);
  });
});

describe("checkQuestions", () => {
  it("accepts the real questions.json", () => {
    expect(() => checkQuestions(QUESTION_POOLS)).not.toThrow();
  });

  it("accepts fixed questions and templates in their groups", () => {
    expect(
      check({ general: [fixedQ("g1")], [circle.id]: [fixedQ("c1"), templateQ("c2")] }),
    ).not.toThrow();
  });

  describe("groups and ids", () => {
    it("rejects a group that is neither general nor a tower id", () => {
      expect(check({ towr: [fixedQ("a")] })).toThrow(/unknown group "towr"/);
    });

    it("rejects the same id twice, even in different groups", () => {
      expect(check({ general: [fixedQ("a")], [circle.id]: [fixedQ("a")] })).toThrow(
        /duplicate id "a"/,
      );
    });
  });

  describe("levels", () => {
    it("gives every question and template in questions.json a level of 1, 2 or 3", () => {
      for (const entries of Object.values(QUESTION_POOLS)) {
        for (const entry of entries) {
          expect([1, 2, 3]).toContain(entry.level);
        }
      }
    });

    it.each([
      ["no level", { level: undefined }],
      ["a level of 0", { level: 0 }],
      ["a level of 4", { level: 4 }],
      ["a level that isn't a number", { level: "1" }],
    ])("rejects a question with %s", (_label, fields) => {
      expect(check({ general: [fixedQ("a", fields)] })).toThrow(/"a" needs a level of 1, 2 or 3/);
    });

    it("rejects a template with no level", () => {
      expect(check({ [circle.id]: [templateQ("t", { level: undefined })] })).toThrow(
        /"t" needs a level of 1, 2 or 3/,
      );
    });
  });

  describe("hints", () => {
    it.each([
      ["no hint", { hint: undefined }],
      ["an empty hint", { hint: "" }],
      ["a hint that isn't text", { hint: 5 }],
    ])("rejects a fixed question with %s", (_label, fields) => {
      expect(check({ general: [fixedQ("a", fields)] })).toThrow(/"a" needs a hint/);
    });

    it.each([
      ["no hint", { hint: undefined }],
      ["an empty hint", { hint: "" }],
    ])("rejects a template with %s", (_label, fields) => {
      expect(check({ [circle.id]: [templateQ("t", fields)] })).toThrow(/"t" needs a hint/);
    });
  });

  describe("fixed questions", () => {
    it.each([
      ["no prompt", { prompt: undefined }],
      ["an empty prompt", { prompt: "" }],
      ["a text answer", { answer: "4" }],
      ["a NaN answer", { answer: NaN }],
      ["an Infinity answer", { answer: Infinity }],
      ["no tolerance", { tolerance: undefined }],
      ["a negative tolerance", { tolerance: -1 }],
    ])("rejects %s", (_label, fields) => {
      expect(check({ general: [fixedQ("a", fields)] })).toThrow(
        /needs a prompt, a number answer and a tolerance >= 0/,
      );
    });

    it("accepts a tolerance of 0", () => {
      expect(check({ general: [fixedQ("a", { tolerance: 0 })] })).not.toThrow();
    });
  });

  describe("templates", () => {
    it.each([
      ["a number answer instead of a formula", { answer: 8 }],
      ["no template text", { template: undefined }],
    ])("rejects %s", (_label, fields) => {
      expect(check({ [circle.id]: [templateQ("t", fields)] })).toThrow(
        /needs a template and a formula answer/,
      );
    });

    // fill() only replaces plain names, so these would reach the player as written
    it.each([
      ["a formula in the template", { template: "What is {2 * radius}?" }],
      ["a formula in the hint", { hint: "It is {radius + radius}." }],
      ["empty braces", { template: "Radius: {}" }],
    ])("rejects %s", (_label, fields) => {
      expect(check({ [circle.id]: [templateQ("t", fields)] })).toThrow(/only plain names/);
    });

    it("rejects a number the tower doesn't provide, in the template or the hint", () => {
      expect(
        check({ [circle.id]: [templateQ("t", { template: "The cone is {degrees}° wide." })] }),
      ).toThrow(/uses \{degrees\}.*does not provide/);
      expect(check({ [circle.id]: [templateQ("t", { hint: "Use {width}." })] })).toThrow(
        /does not provide/,
      );
    });

    it("rejects tower numbers in the general group", () => {
      expect(check({ general: [templateQ("t")] })).toThrow(/"general" does not provide/);
    });

    it("lets every tower use the common numbers", () => {
      for (const tower of TOWERS) {
        const entry = templateQ(`common-${tower.id}`, {
          template: "It deals {damage} damage {rate} times a second.",
          answer: "damage * rate",
          hint: "Multiply {damage} by {rate}.",
        });
        expect(check({ [tower.id]: [entry] })).not.toThrow();
      }
    });

    it("lets circle and cone templates use the numbers divided by π, but not block ones", () => {
      const piQ = (id: string) =>
        templateQ(id, {
          template: "The range covers {areaOverPi}π tiles². What is its radius?",
          answer: "sqrt(areaOverPi)",
        });
      expect(check({ [circle.id]: [piQ("c")] })).not.toThrow();
      expect(check({ [towerOfKind("sector").id]: [piQ("s")] })).not.toThrow();
      expect(check({ [towerOfKind("rect").id]: [piQ("r")] })).toThrow(/does not provide/);
    });

    it("rejects an unknown name in the answer formula", () => {
      expect(check({ [circle.id]: [templateQ("t", { answer: "2 * r" })] })).toThrow(
        /answer uses unknown name "r"/,
      );
    });

    it("allows pi and sqrt in the answer, in any case", () => {
      expect(
        check({
          [circle.id]: [
            templateQ("t1", { answer: "PI * radius^2" }),
            templateQ("t2", { answer: "sqrt(area / pi)" }),
          ],
        }),
      ).not.toThrow();
    });

    it("rejects a negative or NaN tolerance and accepts none", () => {
      expect(check({ [circle.id]: [templateQ("t", { tolerance: -0.1 })] })).toThrow(
        /negative tolerance/,
      );
      expect(check({ [circle.id]: [templateQ("t", { tolerance: NaN })] })).toThrow(
        /negative tolerance/,
      );
      expect(check({ [circle.id]: [templateQ("t")] })).not.toThrow();
    });
  });
});

describe("question lists", () => {
  it("has numbers for every kind of tower in towers.json", () => {
    for (const tower of TOWERS) {
      expect(VARIABLES_BY_KIND[tower.range.kind], tower.id).toBeDefined();
    }
  });

  it("GENERAL_QUESTIONS holds the general group's fixed questions and no templates", () => {
    const general = QUESTION_POOLS.general ?? [];
    expect(GENERAL_QUESTIONS).toEqual(general.filter((entry) => !isTemplate(entry)));
    for (const question of GENERAL_QUESTIONS) expect(isTemplate(question)).toBe(false);
  });

  it("QUESTIONS holds every fixed question from every group and no templates", () => {
    const fixed = Object.values(QUESTION_POOLS)
      .flat()
      .filter((entry) => !isTemplate(entry));
    expect(QUESTIONS).toEqual(fixed);
    for (const question of GENERAL_QUESTIONS) expect(QUESTIONS).toContain(question);
  });
});
