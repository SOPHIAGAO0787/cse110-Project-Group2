import {
  PIECES,
  pieceArea,
  pointsForArea,
  roomPiece,
  RoomBuilder,
  type PieceKind,
  type RoomCell,
} from "../../model/minigame/RoomBuilder";
import type { EffectName } from "../../core/Sound";

export class RoomBuilderController {
  readonly room = new RoomBuilder();
  selected: { kind: PieceKind; index?: number } | null = null;
  feedback = "";
  bonus: number | null = null;
  private cardTurns = { bench: 0, square: 0, triangle: 0 };

  constructor(
    private award: (areaUsed: number) => number,
    private playEffect: (effect: EffectName) => void,
  ) {}

  selectCard(kind: PieceKind): boolean {
    this.selected = { kind };
    const available = this.room.remaining(kind) > 0;
    this.feedback = available ? "" : "No pieces of this type remaining.";
    return available;
  }

  selectPlaced(index: number): void {
    this.selected = { kind: this.room.pieces[index].kind, index };
    this.feedback = "";
  }

  cardTurn(kind: PieceKind): number {
    return this.cardTurns[kind];
  }

  rotate(): void {
    if (!this.selected) return;
    const { kind, index } = this.selected;
    if (PIECES[kind].turns === 1) return;
    if (index === undefined) {
      this.cardTurns[kind] = (this.cardTurns[kind] + 1) % PIECES[kind].turns;
      this.feedback = "Piece rotated. Drag it from the menu.";
    } else {
      this.feedback = this.room.rotate(index) ?? "Piece rotated.";
    }
  }

  preview(cell: RoomCell) {
    if (!this.selected) return null;
    const { kind, index } = this.selected;
    const turn = index === undefined ? this.cardTurns[kind] : this.room.pieces[index].turn;
    const piece = roomPiece(kind, cell, turn);
    return { piece, valid: !this.room.placementError(piece, index) };
  }

  drop(cell: RoomCell | null): void {
    if (!this.selected) return;
    if (!cell) {
      this.feedback = "Drop the piece inside the room.";
      return;
    }
    const { kind, index } = this.selected;
    if (index !== undefined) {
      this.feedback = this.room.move(index, cell) ?? "Piece moved.";
      return;
    }
    const error = this.room.place(kind, cell, this.cardTurns[kind]);
    this.feedback = error ?? `Piece placed! +${pointsForArea(pieceArea(kind))} points.`;
    if (!error) this.playEffect("place");
  }

  undo(): void {
    if (!this.room.undo()) return;
    if (this.selected?.index !== undefined && !this.room.pieces[this.selected.index]) {
      this.selected = null;
    }
    this.feedback = "Last change undone.";
  }

  reset(): void {
    this.room.reset();
    this.selected = null;
    this.cardTurns = { bench: 0, square: 0, triangle: 0 };
    this.feedback = "";
    this.bonus = null;
  }

  finish(): void {
    if (!this.room.finish()) return;
    this.bonus = this.award(this.room.stats.areaUsed);
    this.playEffect("win");
  }
}
