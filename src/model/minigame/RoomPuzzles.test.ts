import { describe, expect, it } from "vitest";
import roomData from "../../data/roomPuzzles.json";
import { PIECES, pieceArea, RoomBuilder, type PieceKind } from "./RoomBuilder";
import { ROOM_SOLUTIONS } from "./RoomPuzzles.fixtures";
import {
  ROOM_DIFFICULTIES,
  ROOM_LAYOUTS,
  roomReward,
  selectRoomPuzzle,
  type RoomDifficulty,
} from "./RoomPuzzles";

const kinds = Object.keys(PIECES) as PieceKind[];
const difficulties: RoomDifficulty[] = ["Easy", "Medium", "Hard"];
const puzzles = ROOM_LAYOUTS.flatMap((layout) =>
  layout.inventories.map((inventory) => ({
    key: `${layout.id}/${inventory.id}`,
    layout,
    inventory,
  })),
);

it("defines nine unique connected full-cell rooms with four distinct inventories each", () => {
  expect(new Set(ROOM_LAYOUTS.map(({ id }) => id)).size).toBe(9);
  expect(ROOM_LAYOUTS).toHaveLength(9);
  for (const definition of roomData) {
    expect(definition.blocks.every((row) => /^[#.]+$/.test(row))).toBe(true);
  }
  for (const difficulty of difficulties) {
    expect(ROOM_LAYOUTS.filter((layout) => layout.difficulty === difficulty)).toHaveLength(3);
  }
  for (const layout of ROOM_LAYOUTS) {
    const { cells, width, height } = layout;
    expect(cells).toHaveLength(height);
    expect(cells.every((row) => row.length === width)).toBe(true);
    expect(layout.area).toBe(cells.flat().filter((cell) => cell === true).length);
    const start = cells.flat().indexOf(true);
    const queue = [start];
    const reached = new Set(queue);
    for (const index of queue) {
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const next = ny * width + nx;
        if (cells[ny]?.[nx] && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    expect(reached.size).toBe(layout.area);
    expect(layout.inventories).toHaveLength(4);
    expect(new Set(layout.inventories.map(({ id }) => id)).size).toBe(4);
    expect(
      new Set(layout.inventories.map((counts) => kinds.map((kind) => counts[kind]).join(","))).size,
    ).toBe(4);
  }
  expect(Object.keys(ROOM_SOLUTIONS).sort()).toEqual(puzzles.map(({ key }) => key).sort());
});

it.each(puzzles)(
  "$key has an exact solution through production placement",
  ({ key, layout, inventory }) => {
    for (const kind of kinds) {
      expect(Number.isInteger(inventory[kind])).toBe(true);
      expect(inventory[kind]).toBeGreaterThanOrEqual(0);
    }
    expect(kinds.reduce((sum, kind) => sum + inventory[kind] * pieceArea(kind), 0)).toBe(
      layout.area,
    );
    const room = new RoomBuilder({ layout, inventory });
    const solution = ROOM_SOLUTIONS[key];
    for (const [kind, x, y, turn] of solution) {
      expect(room.place(kind, { x, y }, turn)).toBeNull();
    }
    expect(room.stats).toEqual({
      areaUsed: layout.area,
      areaRemaining: 0,
      utilization: 100,
      score: layout.area * 10,
      count: inventory.bench + inventory.square + inventory.triangle,
      potentialReward: ROOM_DIFFICULTIES[layout.difficulty].maxReward,
    });
    expect(kinds.map((kind) => room.remaining(kind))).toEqual([0, 0, 0]);
  },
);

describe("randomized puzzle selection", () => {
  it.each(difficulties)("reaches every %s map and inventory in the verified set", (difficulty) => {
    const layouts = ROOM_LAYOUTS.filter((layout) => layout.difficulty === difficulty);
    const selected = layouts.flatMap((layout, li) =>
      layout.inventories.map((_, ii) => {
        const samples = [(li + 0.5) / layouts.length, (ii + 0.5) / layout.inventories.length];
        const puzzle = selectRoomPuzzle(difficulty, undefined, () => samples.shift() ?? 0);
        expect(puzzle.layout.difficulty).toBe(difficulty);
        expect(ROOM_SOLUTIONS[`${puzzle.layout.id}/${puzzle.inventory.id}`]).toBeDefined();
        return puzzle;
      }),
    );
    expect(selected).toEqual(
      puzzles
        .filter(({ layout }) => layout.difficulty === difficulty)
        .map(({ layout, inventory }) => ({ layout, inventory })),
    );
  });

  it("can pick another inventory on the same layout, without repeating the pair", () => {
    const first = selectRoomPuzzle("Easy", undefined, () => 0);
    const next = selectRoomPuzzle("Easy", first, () => 0);
    expect(next.layout).toBe(first.layout);
    expect(next.inventory).not.toBe(first.inventory);
  });
});

it.each([
  ["Easy", 20, 5, 10, 15],
  ["Medium", 30, 7, 15, 22],
  ["Hard", 40, 10, 20, 30],
] as const)(
  "pays %s based on exact filled area, flooring fractional coins",
  (difficulty, max, quarter, half, threeQuarters) => {
    expect(ROOM_DIFFICULTIES[difficulty].maxReward).toBe(max);
    expect([0, 10, 20, 30, 40].map((area) => roomReward(area, 40, max))).toEqual([
      0,
      quarter,
      half,
      threeQuarters,
      max,
    ]);
    expect(Math.round((62 / 125) * 100)).toBe(50);
    expect(roomReward(62, 125, max)).toBe(max / 2 - 1);
  },
);
