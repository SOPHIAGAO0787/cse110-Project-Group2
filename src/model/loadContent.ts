import enemiesJson from "../data/enemies.json";
import questionsJson from "../data/questions.json";
import towersJson from "../data/towers.json";
import map1 from "../data/maps/map1.json";
import map2 from "../data/maps/map2.json";
import map3 from "../data/maps/map3.json";
import map4 from "../data/maps/map4.json";
import meadow from "../data/tilesets/meadow.json";
import archipelago from "../data/tilesets/archipelago.json";
import canyon from "../data/tilesets/canyon.json";
import peak from "../data/tilesets/peak.json";
import { checkArt, loadTileset, type Tileset } from "./TileArt";
import type { EnemyDef, MapConfig, Question, QuestionTemplate, TowerDef } from "./types";

// "as" tells TypeScript what shape the JSON has. loadMap below also checks maps for mistakes.
export const TOWERS = towersJson as TowerDef[];
export const ENEMIES = enemiesJson as EnemyDef[];

// Numbers each kind of tower hands to a question template. towerQuestions.ts fills these in.
// Every tower also gets the common ones.
export const COMMON_VARIABLES = ["damage", "rate"];
export const VARIABLES_BY_KIND: Record<string, string[]> = {
  circle: ["radius", "diameter", "circumference", "area"],
  sector: ["degrees", "radius", "fraction", "fractionDecimal", "area", "arc"],
  rect: ["width", "depth", "area", "baseRate", "rateArea"],
};

// Names that may appear in an answer formula besides the variables
const FORMULA_WORDS = ["pi", "sqrt"];

export type QuestionEntry = Question | QuestionTemplate;

export function isTemplate(entry: QuestionEntry): entry is QuestionTemplate {
  return "template" in entry;
}

// questions.json: { "general": [...], "<tower id>": [...] }
// "general" holds fixed geometry questions. A tower's group holds its own fixed questions
// and templates that are filled in with the tower's real numbers.
export const QUESTION_POOLS = questionsJson as unknown as Record<string, QuestionEntry[]>;

export const GENERAL_QUESTIONS: Question[] = (QUESTION_POOLS.general ?? []).filter(
  (entry): entry is Question => !isTemplate(entry),
);

// Every fixed question from every group
export const QUESTIONS: Question[] = Object.values(QUESTION_POOLS)
  .flat()
  .filter((entry): entry is Question => !isTemplate(entry));

// Variable names a group's templates may use, or null if the group is not allowed
function variablesForGroup(group: string): string[] | null {
  if (group === "general") return [];
  const tower = TOWERS.find((t) => t.id === group);
  if (!tower) return null;
  return [...COMMON_VARIABLES, ...(VARIABLES_BY_KIND[tower.range.kind] ?? [])];
}

// Checks questions.json for mistakes. A typo then fails loudly in the tests
// instead of quietly breaking a question in the game.
export function checkQuestions(pools: Record<string, QuestionEntry[]>): void {
  const seen = new Set<string>();

  for (const [group, entries] of Object.entries(pools)) {
    const allowed = variablesForGroup(group);
    if (allowed === null) throw new Error(`questions.json: unknown group "${group}"`);

    for (const entry of entries) {
      if (seen.has(entry.id)) throw new Error(`questions.json: duplicate id "${entry.id}"`);
      seen.add(entry.id);

      if (typeof entry.hint !== "string" || entry.hint === "") {
        throw new Error(`questions.json: "${entry.id}" needs a hint`);
      }

      if (!isTemplate(entry)) {
        const ok =
          typeof entry.prompt === "string" &&
          entry.prompt !== "" &&
          Number.isFinite(entry.answer) &&
          Number.isFinite(entry.tolerance) &&
          entry.tolerance >= 0;
        if (!ok) {
          throw new Error(
            `questions.json: "${entry.id}" needs a prompt, a number answer and a tolerance >= 0`,
          );
        }
        continue;
      }

      if (typeof entry.template !== "string" || typeof entry.answer !== "string") {
        throw new Error(`questions.json: "${entry.id}" needs a template and a formula answer`);
      }
      for (const field of [entry.template, entry.hint]) {
        // fill() only replaces plain names, so a formula like {2 * radius} would reach the player
        for (const match of field.matchAll(/\{([^}]*)\}/g)) {
          if (!/^\w+$/.test(match[1])) {
            throw new Error(
              `questions.json: "${entry.id}" uses {${match[1]}}; only plain names like {radius} are filled in`,
            );
          }
        }
        for (const match of field.matchAll(/\{(\w+)\}/g)) {
          if (!allowed.includes(match[1])) {
            throw new Error(
              `questions.json: "${entry.id}" uses {${match[1]}}, which "${group}" does not provide`,
            );
          }
        }
      }
      for (const word of entry.answer.match(/[A-Za-z_]+/g) ?? []) {
        if (!allowed.includes(word) && !FORMULA_WORDS.includes(word.toLowerCase())) {
          throw new Error(`questions.json: "${entry.id}" answer uses unknown name "${word}"`);
        }
      }
      if (entry.tolerance !== undefined && !(entry.tolerance >= 0)) {
        throw new Error(`questions.json: "${entry.id}" has a negative tolerance`);
      }
    }
  }
}

checkQuestions(QUESTION_POOLS);

// Every picture sheet a map can be drawn with.
export const TILESETS: Tileset[] = [
  loadTileset(meadow),
  loadTileset(archipelago),
  loadTileset(canyon),
  loadTileset(peak),
];

// Returns the tileset with this id. Throws if there is none, so a typo in a map file fails loudly.
export function findTileset(id: string): Tileset {
  for (const tileset of TILESETS) {
    if (tileset.id === id) {
      return tileset;
    }
  }
  throw new Error(`Unknown tileset "${id}"`);
}

// Checks a map file for common mistakes and returns it typed.
// A typo in a map file then fails loudly in the tests instead of quietly breaking the game.
export function loadMap(data: unknown): MapConfig {
  const map = data as MapConfig;

  // Without all three colors some tiles would be drawn with no fill
  if (
    map.colors === undefined ||
    map.colors === null ||
    typeof map.colors.buildable !== "string" ||
    typeof map.colors.path !== "string" ||
    typeof map.colors.blocked !== "string"
  ) {
    throw new Error(`${map.id}: colors needs buildable, path and blocked`);
  }

  const decoration = map.decoration;
  if (
    decoration !== "trees" &&
    decoration !== "rocks" &&
    decoration !== "waves" &&
    decoration !== "mountains"
  ) {
    throw new Error(`${map.id}: unknown decoration "${decoration}"`);
  }

  if (map.tiles.length !== map.rows) {
    throw new Error(`${map.id}: has ${map.tiles.length} rows of tiles but rows is ${map.rows}`);
  }

  for (let y = 0; y < map.tiles.length; y++) {
    const row = map.tiles[y];
    if (row.length !== map.cols) {
      throw new Error(`${map.id}: row ${y} has ${row.length} tiles but cols is ${map.cols}`);
    }
    for (const ch of row) {
      if (ch !== "#" && ch !== "P" && ch !== ".") {
        throw new Error(`${map.id}: unknown tile '${ch}' in row ${y}`);
      }
    }
  }

  for (let i = 0; i < map.path.length; i++) {
    const point = map.path[i];
    const insideMap = point.x >= 0 && point.x < map.cols && point.y >= 0 && point.y < map.rows;
    if (!insideMap || map.tiles[point.y][point.x] !== "P") {
      throw new Error(`${map.id}: path point ${i} at (${point.x}, ${point.y}) is not a 'P' tile`);
    }
    if (i > 0) {
      const prev = map.path[i - 1];
      if (prev.x !== point.x && prev.y !== point.y) {
        throw new Error(`${map.id}: path points ${i - 1} and ${i} are diagonal`);
      }
    }
  }

  if (map.tileset === undefined) {
    if (map.art !== undefined) {
      throw new Error(`${map.id}: has art but no tileset to read it with`);
    }
  } else {
    // Last, because working out the road pieces needs a valid route
    checkArt(map, findTileset(map.tileset));
  }

  return map;
}

// Every map, in the order the player unlocks them.
export const MAPS: MapConfig[] = [loadMap(map1), loadMap(map2), loadMap(map3), loadMap(map4)];

// Returns the map with this id. Throws if there is none, so a typo in an id fails loudly.
export function findMap(id: string): MapConfig {
  for (const map of MAPS) {
    if (map.id === id) {
      return map;
    }
  }
  throw new Error(`Unknown map "${id}"`);
}
