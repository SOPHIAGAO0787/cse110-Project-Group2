import Konva from "konva";
import {
  PIECES,
  pieceArea,
  pieceCorners,
  roomPiece,
  pointsForArea,
  type PieceKind,
  type RoomCell,
  type RoomPiece,
} from "../../model/minigame/RoomBuilder";
import {
  ROOM_DIFFICULTIES,
  ROOM_LAYOUTS,
  type RoomDifficulty,
  type RoomLayout,
} from "../../model/minigame/RoomPuzzles";
import { makeBackButton, makeButton, setHoverCursor } from "../button";
import { Page } from "../Page";
import {
  BUTTON_FILL,
  CARD_BORDER,
  CARD_FILL,
  CIRCLE_TOWER_COLOR,
  FONT,
  LOSE_TEXT,
  PAGE_BACKGROUND,
  MUTED_TEXT,
  SQUARE_TOWER_COLOR,
  TITLE_TEXT,
  TRIANGLE_TOWER_COLOR,
  WIN_TEXT,
} from "../theme";
import type { RoomBuilderController } from "./RoomBuilderController";

const CELL = 64;
const DIFFICULTY_COLORS = { Easy: WIN_TEXT, Medium: TRIANGLE_TOWER_COLOR, Hard: LOSE_TEXT };
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
  private difficulty = new Konva.Group();
  private play = new Konva.Group();
  private results = new Konva.Group();
  private board = new Konva.Group();
  private boardCells = new Konva.Group();
  private grid = new Konva.Group({ listening: false });
  private roomTitle = label("", 48, 88, 30, true);
  private widthLabel = label("", 0, 0, 22, true).width(90).align("center");
  private heightLabel = label("", 0, 0, 22, true).width(70).align("right");
  private drawnLayout?: RoomLayout;
  private showingDifficulty = true;
  private resultTitle = label("", 367, 148, 36, true);
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
    onReturnToMenu: () => void,
  ) {
    const back = makeBackButton(() => (this.showingDifficulty ? onBack() : this.showDifficulty()));
    back.position({ x: 40, y: 26 });
    this.page.content.add(
      back,
      label("Room Builder", 100, 29, 32, true),
      this.difficulty,
      this.play,
      this.results,
    );
    this.play.add(
      this.roomTitle,
      label(
        "Drag pieces from the menu into the room. Drag placed pieces to move them, or click a piece and use Rotate.",
        48,
        126,
        20,
      ),
      panel(48, 163, 734, 493),
      panel(800, 163, 487, 493),
      this.widthLabel,
      this.heightLabel,
      label("Choose a piece", 822, 177, 24, true),
      label("Coins are awarded on finish.", 1052, 183, 15).fill(MUTED_TEXT),
      this.board,
      this.cards,
      this.formula,
      this.feedback,
      this.statistics,
    );
    const rule = label(
      "Each cell is 1 m². Shaded cells are blocked. Triangle halves can share a space.",
      76,
      178,
      17,
    );
    rule.fill(MUTED_TEXT);
    this.play.add(rule);

    this.board.add(this.boardCells, this.pieces, this.grid);
    this.play.add(this.preview);
    this.buildDifficultyCards();

    this.rotate = this.addButton(this.play, "Rotate", 822, 546, 140, () =>
      this.controller.rotate(),
    );
    this.undo = this.addButton(this.play, "Undo", 1124, 546, 140, () => this.controller.undo());
    this.addButton(this.play, "Reset Room", 822, 601, 200, () => this.controller.reset());
    this.addButton(this.play, "Finish Room", 1064, 601, 200, () => this.controller.finish());

    this.results.add(panel(320, 112, 695, 525), this.resultTitle, this.resultSummary);
    this.addButton(this.results, "Try Again", 367, 486, 275, () => this.controller.reset());
    this.addButton(this.results, "Next Puzzle", 693, 486, 275, () => this.controller.nextPuzzle());
    this.addButton(this.results, "Change Difficulty", 367, 555, 275, () => this.showDifficulty());
    this.addButton(this.results, "Return to Menu", 693, 555, 275, onReturnToMenu);
  }

  showDifficulty(): void {
    this.cancelDrag();
    this.showingDifficulty = true;
    this.render();
  }

  private buildDifficultyCards(): void {
    this.difficulty.add(
      label("Select Difficulty", 48, 100, 34, true),
      label(
        "Choose a difficulty to receive a random room and set of shapes. Every puzzle can be completed to 100%.",
        48,
        149,
        20,
      ),
    );
    const levels: RoomDifficulty[] = ["Easy", "Medium", "Hard"];
    for (const [index, difficulty] of levels.entries()) {
      const x = 48 + index * 421;
      const color = DIFFICULTY_COLORS[difficulty];
      const { description, maxReward } = ROOM_DIFFICULTIES[difficulty];
      const examples = ROOM_LAYOUTS.filter((layout) => layout.difficulty === difficulty);
      const example = examples[index === 1 ? 2 : 0];
      const cellSize = 18;
      this.difficulty.add(
        panel(x, 218, 398, 420),
        label(difficulty, x + 26, 249, 30, true).fill(color),
        label(description, x + 26, 468, 22)
          .width(348)
          .lineHeight(1.2),
        label(`Maximum reward   ${maxReward} coins`, x + 26, 541, 20, true),
      );
      example.cells.forEach((row, rowIndex) =>
        row.forEach((available, colIndex) => {
          if (!available) return;
          this.difficulty.add(
            new Konva.Rect({
              x: x + (398 - example.width * cellSize) / 2 + colIndex * cellSize,
              y: 300 + rowIndex * cellSize,
              width: cellSize,
              height: cellSize,
              fill: color,
              stroke: CARD_FILL,
              strokeWidth: 1,
              listening: false,
            }),
          );
        }),
      );
      this.addButton(this.difficulty, difficulty, x + 26, 574, 346, () => {
        this.controller.chooseDifficulty(difficulty);
        this.showingDifficulty = false;
      });
    }
  }

  private buildBoard(layout: RoomLayout): void {
    this.drawnLayout = layout;
    this.boardCells.destroyChildren();
    this.grid.destroyChildren();
    const width = layout.width * CELL;
    const height = layout.height * CELL;
    const scale = Math.min(1, 576 / width, 384 / height);
    const x = 415 - (width * scale) / 2;
    const y = 230 + (384 - height * scale) / 2;
    this.board.position({ x, y }).scale({ x: scale, y: scale });
    this.preview.position({ x, y }).scale({ x: scale, y: scale });
    this.widthLabel.position({ x: 370, y: y - 27 }).text(`${layout.width} m`);
    this.heightLabel
      .position({ x: x - 80, y: y + (height * scale) / 2 - 11 })
      .text(`${layout.height} m`);

    const surface = new Konva.Rect({
      name: "room-grid",
      width,
      height,
      fill: "#f1f7fb",
      stroke: TITLE_TEXT,
      strokeWidth: 3,
    });
    this.boardCells.add(surface);
    layout.cells.forEach((row, rowIndex) =>
      row.forEach((available, colIndex) => {
        const cellX = colIndex * CELL;
        const cellY = rowIndex * CELL;
        this.boardCells.add(
          new Konva.Rect({
            x: cellX,
            y: cellY,
            width: CELL,
            height: CELL,
            fill: available ? undefined : PAGE_BACKGROUND,
            listening: false,
          }),
        );
        this.grid.add(
          new Konva.Rect({
            x: cellX,
            y: cellY,
            width: CELL,
            height: CELL,
            stroke: TITLE_TEXT,
            strokeWidth: 1,
            opacity: 0.24,
          }),
        );
        if (!available) {
          this.boardCells.add(
            new Konva.Line({
              points: [cellX + 9, cellY + CELL - 9, cellX + CELL - 9, cellY + 9],
              stroke: MUTED_TEXT,
              strokeWidth: 2,
              opacity: 0.55,
              listening: false,
            }),
          );
        }
      }),
    );
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
    const { width, height } = this.controller.room.puzzle.layout;
    const inside =
      pointer.x >= 0 && pointer.x < width * CELL && pointer.y >= 0 && pointer.y < height * CELL;
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
    const x = inside ? cell.x * CELL : position.x;
    const y = inside ? cell.y * CELL : position.y;
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
    this.difficulty.visible(this.showingDifficulty);
    const { bonus } = this.controller;
    this.play.visible(!this.showingDifficulty && bonus === null);
    this.results.visible(!this.showingDifficulty && bonus !== null);
    if (this.showingDifficulty) return;

    const { room, selected } = this.controller;
    const { layout } = room.puzzle;
    const stats = room.stats;
    const title = `${layout.difficulty} — ${layout.name}`;
    if (bonus !== null) {
      this.resultTitle.text(
        stats.areaRemaining === 0 ? "Perfect Room! 100% Utilization" : "Room Complete!",
      );
      this.resultSummary.destroyChildren();
      this.resultSummary.add(label(title, 369, 203, 24, true));
      const lines = [
        `Final score   ${stats.score} points`,
        `Area filled   ${stats.areaUsed} / ${layout.area} m²`,
        `Area remaining   ${stats.areaRemaining} m²`,
        `Room utilization   ${stats.utilization}%`,
        `Pieces placed   ${stats.count}`,
        `Maximum reward   ${room.maxReward} coins`,
        `Performance reward   ${stats.potentialReward} coins`,
        `Bonus coins awarded   +${bonus}`,
      ];
      lines.forEach((line, index) =>
        this.resultSummary.add(
          label(line, index < 4 ? 369 : 684, 251 + 41 * (index % 4), 21, true),
        ),
      );
      if (bonus < stats.potentialReward) {
        this.resultSummary.add(
          label("The shared 50-coin savings cap reduced your award.", 369, 432, 18).fill(
            MUTED_TEXT,
          ),
        );
      }
      return;
    }

    if (this.drawnLayout !== layout) this.buildBoard(layout);
    this.roomTitle.text(title);
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
      ["Area used", `${stats.areaUsed} / ${layout.area} m²`],
      ["Geometric area left", `${stats.areaRemaining} m²`],
      ["Room utilization", `${stats.utilization}%`],
      ["Pieces placed", String(stats.count)],
      ["Potential reward", `${stats.potentialReward} / ${room.maxReward} coins`],
    ];
    items.forEach(([title, value], index) => {
      const x = 71 + 202 * index;
      this.statistics.add(label(title, x, 686, 18), label(value, x, 712, 28, true));
    });
  }
}
