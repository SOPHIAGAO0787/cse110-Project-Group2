import Konva from "konva";
import {
  PIECES,
  ROOM_AREA,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  pieceArea,
  pieceCorners,
  roomPiece,
  pointsForArea,
  type PieceKind,
  type RoomCell,
  type RoomPiece,
} from "../../model/minigame/RoomBuilder";
import { makeBackButton, makeButton, setHoverCursor } from "../button";
import { Page } from "../Page";
import {
  BUTTON_FILL,
  CARD_BORDER,
  CARD_FILL,
  CIRCLE_TOWER_COLOR,
  FONT,
  LOSE_TEXT,
  MUTED_TEXT,
  SQUARE_TOWER_COLOR,
  TITLE_TEXT,
  TRIANGLE_TOWER_COLOR,
  WIN_TEXT,
} from "../theme";
import type { RoomBuilderController } from "./RoomBuilderController";

const CELL = 64;
const BOARD_WIDTH = ROOM_WIDTH * CELL;
const BOARD_HEIGHT = ROOM_HEIGHT * CELL;
const COLORS = {
  bench: SQUARE_TOWER_COLOR,
  square: CIRCLE_TOWER_COLOR,
  triangle: TRIANGLE_TOWER_COLOR,
};
const PIECE_KINDS: PieceKind[] = ["bench", "square", "triangle"];

function label(text: string, x: number, y: number, fontSize: number, bold = false) {
  return new Konva.Text({
    text,
    x,
    y,
    fontSize,
    fontFamily: FONT,
    fontStyle: bold ? "bold" : "normal",
    fill: TITLE_TEXT,
    listening: false,
  });
}

function panel(x: number, y: number, width: number, height: number) {
  return new Konva.Rect({
    x,
    y,
    width,
    height,
    fill: CARD_FILL,
    stroke: CARD_BORDER,
    strokeWidth: 2,
    cornerRadius: 16,
    listening: false,
  });
}

function shape(piece: Readonly<RoomPiece>, x: number, y: number, scale: number, fill: string) {
  const style = { x, y, fill, stroke: TITLE_TEXT, strokeWidth: 2 };
  if (piece.kind === "triangle") {
    const points = pieceCorners({ ...piece, x: 0, y: 0 }).flatMap(({ x, y }) => [
      x * scale,
      y * scale,
    ]);
    return new Konva.Line({ ...style, points, closed: true });
  }
  return new Konva.Rect({
    ...style,
    width: piece.width * scale,
    height: piece.height * scale,
    cornerRadius: 4,
  });
}

interface RoomDrag {
  pointerId: number;
  startX: number;
  startY: number;
  offset: RoomCell;
  moved: boolean;
}

export class RoomBuilderView {
  readonly page = new Page();
  private play = new Konva.Group();
  private results = new Konva.Group();
  private board = new Konva.Group({ x: 155, y: 230 });
  private pieces = new Konva.Group();
  private preview = new Konva.Group({ listening: false });
  private cards = new Konva.Group({ x: 822, y: 208 });
  private formula = label("", 822, 518, 20, true);
  private feedback = label("", 155, 625, 20, true);
  private statistics = new Konva.Group();
  private resultSummary = new Konva.Group();
  private rotate: Konva.Group;
  private undo: Konva.Group;
  private drag: RoomDrag | null = null;

  constructor(
    private controller: RoomBuilderController,
    onBack: () => void,
  ) {
    const back = makeBackButton(onBack);
    back.position({ x: 40, y: 26 });
    this.page.content.add(back, label("Room Builder", 100, 29, 32, true), this.play, this.results);
    this.play.add(
      label("Make every space count!", 48, 88, 30, true),
      label(
        "Drag pieces from the menu into the room. Drag placed pieces to move them, or click a piece and use Rotate.",
        48,
        126,
        20,
      ),
      panel(48, 163, 734, 493),
      panel(800, 163, 487, 493),
      label("8 m", 397, 199, 22, true),
      label("6 m", 102, 410, 22, true),
      label("Choose a piece", 822, 177, 24, true),
      this.board,
      this.cards,
      this.formula,
      this.feedback,
      this.statistics,
    );
    const rule = label(
      "Each cell is 1 m². Two matching triangle halves can share a 2 × 2 space.",
      76,
      178,
      17,
    );
    rule.fill(MUTED_TEXT);
    this.play.add(rule);

    this.buildBoard();
    this.play.add(this.preview);

    this.rotate = this.addButton(this.play, "Rotate", 822, 546, 140, () =>
      this.controller.rotate(),
    );
    this.undo = this.addButton(this.play, "Undo", 1124, 546, 140, () => this.controller.undo());
    this.addButton(this.play, "Reset Room", 822, 601, 200, () => this.controller.reset());
    this.addButton(this.play, "Finish Room", 1064, 601, 200, () => this.controller.finish());

    this.results.add(
      panel(320, 142, 695, 460),
      label("Room Complete!", 367, 180, 36, true),
      this.resultSummary,
    );
    this.addButton(this.results, "Play Again", 367, 512, 245, () => this.controller.reset());
    this.addButton(this.results, "Return to Menu", 720, 512, 245, onBack);
  }

  private buildBoard(): void {
    const grid = new Konva.Group({ listening: false });
    for (let x = 1; x < ROOM_WIDTH; x++) {
      grid.add(
        new Konva.Line({
          points: [x * CELL, 0, x * CELL, BOARD_HEIGHT],
          stroke: TITLE_TEXT,
          opacity: 0.18,
        }),
      );
    }
    for (let y = 1; y < ROOM_HEIGHT; y++) {
      grid.add(
        new Konva.Line({
          points: [0, y * CELL, BOARD_WIDTH, y * CELL],
          stroke: TITLE_TEXT,
          opacity: 0.18,
        }),
      );
    }
    const surface = new Konva.Rect({
      name: "room-grid",
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      fill: "#f1f7fb",
      stroke: TITLE_TEXT,
      strokeWidth: 3,
      cornerRadius: 4,
    });
    this.board.add(surface, this.pieces, grid);
    surface.on("pointerdown", () => {
      if (this.drag) return;
      this.controller.selected = null;
      this.controller.feedback = "";
      this.render();
    });
  }

  private addButton(
    parent: Konva.Group,
    title: string,
    x: number,
    y: number,
    width: number,
    action: () => void,
  ) {
    const button = makeButton(
      title,
      () => {
        this.cancelDrag();
        action();
        if (this.page.group.visible()) this.render();
      },
      width,
    );
    button.position({ x, y });
    parent.add(button);
    return button;
  }

  private beginDrag(event: PointerEvent, offset: RoomCell): void {
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
      moved: false,
    };
    document.body.style.cursor = "grabbing";
    window.addEventListener("pointermove", this.onDrag);
    window.addEventListener("pointerup", this.onDrop);
    window.addEventListener("pointercancel", this.onCancel);
    window.addEventListener("blur", this.cancelDrag);
  }

  cancelDrag = (): void => {
    if (!this.drag) return;
    this.drag = null;
    this.preview.destroyChildren();
    window.removeEventListener("pointermove", this.onDrag);
    window.removeEventListener("pointerup", this.onDrop);
    window.removeEventListener("pointercancel", this.onCancel);
    window.removeEventListener("blur", this.cancelDrag);
    document.body.style.cursor = "default";
  };

  private dragPosition(event: PointerEvent, drag: RoomDrag) {
    this.board.getStage()?.setPointersPositions(event);
    const pointer = this.board.getRelativePointerPosition();
    if (!pointer) return null;
    const inside =
      pointer.x >= 0 && pointer.x < BOARD_WIDTH && pointer.y >= 0 && pointer.y < BOARD_HEIGHT;
    const x = pointer.x - drag.offset.x;
    const y = pointer.y - drag.offset.y;
    return {
      x,
      y,
      inside,
      cell: { x: Math.floor(x / CELL), y: Math.floor(y / CELL) },
    };
  }

  private onDrag = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 4;
    if (!drag.moved) return;
    const position = this.dragPosition(event, drag);
    if (!position) return;
    const { cell, inside } = position;
    const next = this.controller.preview(cell);
    if (!next) return;
    const x = this.board.x() + (inside ? cell.x * CELL : position.x);
    const y = this.board.y() + (inside ? cell.y * CELL : position.y);
    const color = inside && next.valid ? WIN_TEXT : LOSE_TEXT;
    this.preview.destroyChildren();
    this.preview.add(shape(next.piece, x, y, CELL, color).stroke(color).dash([8, 5]).opacity(0.65));
    document.body.style.cursor = "grabbing";
  };

  private onDrop = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const position = this.dragPosition(event, drag);
    this.cancelDrag();
    if (drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 4) {
      this.controller.drop(position?.inside ? position.cell : null);
    }
    this.render();
  };

  private onCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.drag?.pointerId) this.cancelDrag();
  };

  private drawPiece(piece: Readonly<RoomPiece>, index: number): void {
    const { kind, x, y, width, height } = piece;
    const selected = this.controller.selected?.index === index;
    const node: Konva.Shape = shape(piece, x * CELL, y * CELL, CELL, COLORS[kind])
      .name("placed-room-piece")
      .stroke(selected ? BUTTON_FILL : TITLE_TEXT)
      .strokeWidth(selected ? 4 : 2);
    const text =
      kind === "triangle"
        ? `${pieceArea(kind)} m²`
        : `${width} × ${height} m\n${pieceArea(kind)} m²`;
    const corners = pieceCorners(piece);
    const centerX = (corners.reduce((sum, point) => sum + point.x, 0) * CELL) / corners.length;
    const centerY = (corners.reduce((sum, point) => sum + point.y, 0) * CELL) / corners.length;
    const caption = label(text, centerX - 40, centerY - (kind === "triangle" ? 9 : 19), 19, true)
      .width(80)
      .align("center");
    setHoverCursor(node, "grab", () => !this.drag);
    node.on("pointerdown", ({ evt }) => {
      if (evt.button !== 0 || this.drag) return;
      const pointer = this.board.getRelativePointerPosition();
      if (!pointer) return;
      this.controller.selectPlaced(index);
      // Retain the grabbed cell within the shape while snapping its origin to the grid.
      this.beginDrag(evt, {
        x: (Math.floor(pointer.x / CELL) - x) * CELL,
        y: (Math.floor(pointer.y / CELL) - y) * CELL,
      });
      this.render();
    });
    this.pieces.add(node, caption);
  }

  private renderCards(): void {
    this.cards.destroyChildren();
    for (const [index, kind] of PIECE_KINDS.entries()) {
      const remaining = this.controller.room.remaining(kind);
      const selected =
        this.controller.selected?.kind === kind && this.controller.selected.index === undefined;
      const piece = roomPiece(kind, { x: 0, y: 0 }, this.controller.cardTurn(kind));
      const { width, height } = piece;
      const area = pieceArea(kind);
      const card = new Konva.Group({
        y: index * 102,
        opacity: remaining ? 1 : 0.48,
      });
      const dimensions =
        kind === "triangle" ? `Base ${width} m · height ${height} m` : `${width} m × ${height} m`;
      card.add(
        new Konva.Rect({
          width: 442,
          height: 92,
          cornerRadius: 12,
          fill: selected ? "#e7f4ff" : CARD_FILL,
          stroke: selected ? BUTTON_FILL : CARD_BORDER,
          strokeWidth: 2,
        }),
        shape(piece, 22, 25, 10, COLORS[kind]).listening(false),
        label(PIECES[kind].name, 92, 11, 22, true),
        label(`${dimensions} = ${area} m²`, 92, 39, 17),
        label(`${remaining} remaining`, 92, 63, 17),
        label(`${pointsForArea(area)} points`, 325, 15, 19, true),
      );
      setHoverCursor(card, "grab", () => remaining > 0 && !this.drag);
      card.on("pointerdown", ({ evt }) => {
        if (evt.button !== 0 || this.drag) return;
        if (this.controller.selectCard(kind)) this.beginDrag(evt, { x: 0, y: 0 });
        this.render();
      });
      this.cards.add(card);
    }
  }

  render(): void {
    const { room, selected, bonus } = this.controller;
    this.play.visible(bonus === null);
    this.results.visible(bonus !== null);
    const stats = room.stats;
    if (bonus !== null) {
      this.resultSummary.destroyChildren();
      const lines = [
        `Final score   ${stats.score} points`,
        `Area filled   ${stats.areaUsed} / ${ROOM_AREA} m²`,
        `Room utilization   ${stats.utilization}%`,
        `Pieces placed   ${stats.count}`,
        `Bonus coins earned   +${bonus}`,
      ];
      lines.forEach((line, index) =>
        this.resultSummary.add(label(line, 369, 241 + 48 * index, 25, true)),
      );
      return;
    }
    this.pieces.destroyChildren();
    room.pieces.forEach((piece, index) => this.drawPiece(piece, index));
    this.renderCards();
    this.formula.text(
      selected
        ? `Area = ${PIECES[selected.kind].formula}`
        : "Select a piece to see its area formula.",
    );
    this.rotate.visible(selected !== null && PIECES[selected.kind].turns > 1);
    this.undo.listening(room.canUndo).opacity(room.canUndo ? 1 : 0.45);
    this.feedback.text(this.controller.feedback);
    this.statistics.destroyChildren();
    this.statistics.add(panel(48, 673, 1239, 82));
    const items = [
      ["Score", `${stats.score} pts`],
      ["Area used", `${stats.areaUsed} / ${ROOM_AREA} m²`],
      ["Geometric area left", `${stats.areaRemaining} m²`],
      ["Room utilization", `${stats.utilization}%`],
      ["Pieces placed", String(stats.count)],
    ];
    items.forEach(([title, value], index) => {
      const x = 71 + 240 * index;
      this.statistics.add(label(title, x, 686, 18), label(value, x, 712, 28, true));
    });
  }
}
