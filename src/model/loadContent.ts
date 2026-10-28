import enemiesJson from "../data/enemies.json";
import questionsJson from "../data/questions.json";
import towersJson from "../data/towers.json";
import type { EnemyDef, MapConfig, Question, TowerDef } from "./types";

// "as" tells TypeScript what shape the JSON has. loadMap below also checks maps for mistakes.
export const TOWERS = towersJson as TowerDef[];
export const ENEMIES = enemiesJson as EnemyDef[];
export const QUESTIONS = questionsJson as Question[];

// Checks a map file for common mistakes and returns it typed.
// A typo in a map file then fails loudly in the tests instead of quietly breaking the game.
export function loadMap(data: unknown): MapConfig {
  const map = data as MapConfig;

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

  return map;
}
