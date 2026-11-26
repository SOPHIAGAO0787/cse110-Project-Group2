import { ROOM_DIFFICULTIES, roomReward, type RoomPuzzle } from "./RoomPuzzles";

const POINTS_PER_METER = 10;

export const PIECES = {
  bench: { name: "Bench", width: 4, height: 2, formula: "length × width", turns: 2 },
  square: {
    name: "Square tower",
    width: 2,
    height: 2,
    formula: "side × side",
    turns: 1,
  },
  triangle: {
    name: "Triangle tower",
    width: 2,
    height: 2,
    formula: "½ × base × height",
    turns: 4,
  },
} as const;

export type PieceKind = keyof typeof PIECES;

export function pieceDimensions(kind: PieceKind, turn = 0) {
  const { width, height } = PIECES[kind];
  return kind === "bench" && turn % 2 === 1 ? { width: height, height: width } : { width, height };
}

export function pieceArea(kind: PieceKind): number {
  const { width, height } = PIECES[kind];
  return (width * height) / (kind === "triangle" ? 2 : 1);
}

export function pointsForArea(area: number): number {
  return area * POINTS_PER_METER;
}

export interface RoomCell {
  x: number;
  y: number;
}

export interface RoomPiece extends RoomCell {
  kind: PieceKind;
  turn: number;
  width: number;
  height: number;
}

export function roomPiece(kind: PieceKind, cell: RoomCell, turn = 0): RoomPiece {
  const turns = PIECES[kind].turns;
  const orientation = ((turn % turns) + turns) % turns;
  return { ...cell, kind, turn: orientation, ...pieceDimensions(kind, orientation) };
}

export function pieceCorners({ kind, turn, x, y, width, height }: Readonly<RoomPiece>): RoomCell[] {
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  return kind === "triangle" ? corners.filter((_, index) => index !== (turn + 1) % 4) : corners;
}

function overlaps(a: RoomCell[], b: RoomCell[]): boolean {
  // All edge normals are horizontal, vertical, or diagonal. A separating (or touching)
  // projection on any of those axes means the shapes share no interior area.
  const axes = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  return axes.every(([dx, dy]) => {
    const aProjection = a.map(({ x, y }) => x * dx + y * dy);
    const bProjection = b.map(({ x, y }) => x * dx + y * dy);
    return (
      Math.min(...aProjection) < Math.max(...bProjection) &&
      Math.min(...bProjection) < Math.max(...aProjection)
    );
  });
}

export class RoomBuilder {
  private placements: RoomPiece[] = [];
  private history: { index: number; previous?: RoomPiece }[] = [];
  private complete = false;

  constructor(readonly puzzle: RoomPuzzle) {}

  get maxReward(): number {
    return ROOM_DIFFICULTIES[this.puzzle.layout.difficulty].maxReward;
  }

  get pieces(): readonly Readonly<RoomPiece>[] {
    return this.placements;
  }

  get canUndo(): boolean {
    return !this.complete && this.history.length > 0;
  }

  get stats() {
    const areaUsed = this.placements.reduce((area, piece) => area + pieceArea(piece.kind), 0);
    const area = this.puzzle.layout.area;
    return {
      areaUsed,
      areaRemaining: area - areaUsed,
      utilization: Math.round((areaUsed / area) * 100),
      potentialReward: roomReward(areaUsed, area, this.maxReward),
      score: pointsForArea(areaUsed),
      count: this.placements.length,
    };
  }

  remaining(kind: PieceKind): number {
    return (
      this.puzzle.inventory[kind] - this.placements.filter((piece) => piece.kind === kind).length
    );
  }

  placementError(piece: RoomPiece, movingIndex?: number): string | null {
    const { kind, x, y, width, height } = piece;
    const layout = this.puzzle.layout;
    if (this.complete) return "This room is complete.";
    if (movingIndex === undefined && this.remaining(kind) === 0)
      return "No pieces of this type remaining.";
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x + width > layout.width ||
      y + height > layout.height
    ) {
      return "This piece must fit inside the room.";
    }
    const corners = pieceCorners(piece);
    for (let row = y; row < y + height; row++) {
      for (let col = x; col < x + width; col++) {
        if (layout.cells[row][col]) continue;
        const cell = [
          { x: col, y: row },
          { x: col + 1, y: row },
          { x: col + 1, y: row + 1 },
          { x: col, y: row + 1 },
        ];
        if (overlaps(corners, cell)) return "This piece crosses a blocked cell.";
      }
    }
    return this.placements.some(
      (placed, index) => index !== movingIndex && overlaps(corners, pieceCorners(placed)),
    )
      ? "This piece overlaps another piece."
      : null;
  }

  place(kind: PieceKind, cell: RoomCell, turn = 0): string | null {
    const piece = roomPiece(kind, cell, turn);
    const error = this.placementError(piece);
    if (!error) {
      this.history.push({ index: this.placements.length });
      this.placements.push(piece);
    }
    return error;
  }

  move(index: number, cell: RoomCell): string | null {
    const piece = this.placements[index];
    if (!piece) return "Select a placed piece first.";
    return this.updatePiece(index, piece, roomPiece(piece.kind, cell, piece.turn));
  }

  rotate(index: number): string | null {
    const piece = this.placements[index];
    if (!piece) return "Select a placed piece first.";
    return this.updatePiece(index, piece, roomPiece(piece.kind, piece, piece.turn + 1));
  }

  private updatePiece(index: number, previous: RoomPiece, piece: RoomPiece): string | null {
    const error = this.placementError(piece, index);
    if (
      !error &&
      (piece.x !== previous.x || piece.y !== previous.y || piece.turn !== previous.turn)
    ) {
      this.history.push({ index, previous });
      this.placements[index] = piece;
    }
    return error;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const edit = this.history.pop();
    if (!edit) return false;
    if (edit.previous) this.placements[edit.index] = edit.previous;
    else this.placements.pop();
    return true;
  }

  reset(): void {
    this.placements = [];
    this.history = [];
    this.complete = false;
  }

  finish(): boolean {
    if (this.complete) return false;
    this.complete = true;
    return true;
  }
}
