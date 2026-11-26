import roomData from "../../data/roomPuzzles.json";

export const ROOM_DIFFICULTIES = {
  Easy: { maxReward: 20, description: "Practice fitting shapes into simple rooms." },
  Medium: { maxReward: 30, description: "Fit different shapes into more challenging rooms." },
  Hard: {
    maxReward: 40,
    description: "Solve challenging layouts with more strategic piece placement.",
  },
} as const;

export type RoomDifficulty = keyof typeof ROOM_DIFFICULTIES;

export interface RoomInventory {
  id: string;
  bench: number;
  square: number;
  triangle: number;
}

export interface RoomLayout {
  id: string;
  name: string;
  difficulty: RoomDifficulty;
  width: number;
  height: number;
  cells: readonly (readonly boolean[])[];
  area: number;
  inventories: readonly RoomInventory[];
}

export interface RoomPuzzle {
  layout: RoomLayout;
  inventory: RoomInventory;
}

function isDifficulty(value: string): value is RoomDifficulty {
  return Object.hasOwn(ROOM_DIFFICULTIES, value);
}

export const ROOM_LAYOUTS: readonly RoomLayout[] = roomData.map(
  ({ blocks, difficulty, ...room }) => {
    if (!isDifficulty(difficulty)) throw new Error(`Unknown room difficulty: ${difficulty}`);
    // Each symbol abbreviates four whole grid cells to keep the masks easy to read.
    const cells = blocks.flatMap((row) => {
      const expanded = Array.from(row).flatMap((cell) => [cell === "#", cell === "#"]);
      return [expanded, expanded];
    });
    return {
      ...room,
      difficulty,
      cells,
      width: cells[0].length,
      height: cells.length,
      area: cells.flat().filter(Boolean).length,
    };
  },
);

export function selectRoomPuzzle(
  difficulty: RoomDifficulty,
  previous?: RoomPuzzle,
  random = Math.random,
): RoomPuzzle {
  const layouts = ROOM_LAYOUTS.filter((layout) => layout.difficulty === difficulty);
  const layout = layouts[Math.floor(random() * layouts.length)];
  const alternatives = layout.inventories.filter(
    (inventory) => layout.id !== previous?.layout.id || inventory.id !== previous.inventory.id,
  );
  const inventories = alternatives.length > 0 ? alternatives : layout.inventories;
  return { layout, inventory: inventories[Math.floor(random() * inventories.length)] };
}

export function roomReward(areaUsed: number, usableArea: number, maxReward: number): number {
  return Math.floor((areaUsed * maxReward) / usableArea);
}
