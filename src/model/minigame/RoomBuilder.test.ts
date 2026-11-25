import { describe, expect, it } from "vitest";
import { pieceCorners, roomPiece, RoomBuilder, type PieceKind } from "./RoomBuilder";

describe("RoomBuilder", () => {
  it("starts with 48 m² remaining and the full inventory", () => {
    const room = new RoomBuilder();
    expect(room.pieces).toHaveLength(0);
    expect(room.stats).toEqual({
      areaUsed: 0,
      areaRemaining: 48,
      utilization: 0,
      score: 0,
      count: 0,
    });
    expect([room.remaining("bench"), room.remaining("square"), room.remaining("triangle")]).toEqual(
      [3, 4, 4],
    );
  });

  it.each<[PieceKind, number]>([
    ["bench", 8],
    ["square", 4],
    ["triangle", 2],
  ])("places a %s and scores its geometric area", (kind, area) => {
    const room = new RoomBuilder();
    expect(room.place(kind, { x: 0, y: 0 })).toBeNull();
    expect(room.stats).toMatchObject({
      areaUsed: area,
      areaRemaining: 48 - area,
      utilization: Math.round((area / 48) * 100),
      score: area * 10,
      count: 1,
    });
  });

  it("rotates a bench to fit along the right and bottom boundaries", () => {
    const room = new RoomBuilder();
    expect(room.place("bench", { x: 6, y: 2 })).toMatch(/fit/);
    expect(room.place("bench", { x: 6, y: 2 }, 1)).toBeNull();
    expect(room.pieces[0]).toMatchObject({ width: 2, height: 4 });
    expect(room.stats.score).toBe(80);
  });

  it.each([
    [-1, 0],
    [0, -1],
    [7, 0],
    [0, 5],
    [0.5, 0],
    [0, NaN],
    [Infinity, 0],
  ])("rejects invalid coordinates (%s, %s) without changing the room", (x, y) => {
    const room = new RoomBuilder();
    expect(room.place("square", { x, y })).toMatch(/fit/);
    expect(room.remaining("square")).toBe(4);
    expect(room.stats.score).toBe(0);
  });

  it("rejects overlap between a triangle and a square and allows edge contact", () => {
    const room = new RoomBuilder();
    room.place("triangle", { x: 0, y: 0 });
    expect(room.place("square", { x: 1, y: 0 })).toMatch(/overlaps/);
    expect(room.place("square", { x: 2, y: 0 })).toBeNull();
    expect(room.stats).toMatchObject({ areaUsed: 6, score: 60, count: 2 });
    expect(room.remaining("square")).toBe(3);
  });

  it("rejects a piece with exhausted inventory even when its footprint fits", () => {
    const room = new RoomBuilder();
    for (let x = 0; x < 8; x += 2) room.place("square", { x, y: 0 });
    expect(room.remaining("square")).toBe(0);
    expect(room.place("square", { x: 0, y: 2 })).toMatch(/remaining/);
    expect(room.stats.count).toBe(4);
  });

  it("undoes only the latest piece and restores its cells and inventory", () => {
    const room = new RoomBuilder();
    room.place("bench", { x: 0, y: 0 });
    room.place("triangle", { x: 4, y: 0 });
    expect(room.undo()).toBe(true);
    expect(room.remaining("triangle")).toBe(4);
    expect(room.stats).toMatchObject({
      count: 1,
      score: 80,
      areaRemaining: 40,
    });
    expect(room.place("square", { x: 4, y: 0 })).toBeNull();
  });

  it.each([0, 1, 2, 3])("uses distinct corners in triangle orientation %s", (turn) => {
    const corners = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    const piece = roomPiece("triangle", { x: 0, y: 0 }, turn);
    expect(pieceCorners(piece)).toEqual(corners.filter((_, index) => index !== (turn + 1) % 4));
    const room = new RoomBuilder();
    expect(room.place("triangle", piece, turn)).toBeNull();
    expect(room.place("triangle", piece, turn + 1)).toMatch(/overlaps/);
    expect(room.place("triangle", piece, turn + 2)).toBeNull();
    expect(room.stats.score).toBe(40);
  });

  it("checks the triangle interior against a rectangular bench even when its bounds meet the bench", () => {
    const room = new RoomBuilder();
    room.place("triangle", { x: 3, y: 1 });
    expect(room.place("bench", { x: 4, y: 0 })).toBeNull();
    room.undo();
    expect(room.place("bench", { x: 4, y: 1 })).toMatch(/overlaps/);
  });

  it("moves a piece through its own old footprint without changing score or inventory", () => {
    const room = new RoomBuilder();
    for (let x = 0; x < 8; x += 2) room.place("square", { x, y: 0 });
    const stats = room.stats;
    expect(room.move(0, { x: 0, y: 1 })).toBeNull();
    expect(room.pieces[0]).toMatchObject({ x: 0, y: 1 });
    expect(room.stats).toEqual(stats);
    expect(room.remaining("square")).toBe(0);
    expect(room.move(0, { x: 1, y: 1 })).toMatch(/overlaps/);
    expect(room.move(0, { x: -1, y: 1 })).toMatch(/fit/);
    expect(room.pieces[0]).toMatchObject({ x: 0, y: 1 });
    expect(room.undo()).toBe(true);
    expect(room.pieces[0]).toMatchObject({ x: 0, y: 0 });
    expect(room.stats).toEqual(stats);
  });

  it("rotates and undoes a placed triangle without changing its score", () => {
    const room = new RoomBuilder();
    room.place("triangle", { x: 0, y: 0 });
    expect(room.rotate(0)).toBeNull();
    expect(room.pieces[0].turn).toBe(1);
    expect(room.undo()).toBe(true);
    expect(room.pieces[0].turn).toBe(0);
    expect(room.stats.score).toBe(20);
    expect(room.undo()).toBe(true);
    expect(room.remaining("triangle")).toBe(4);
  });

  it("keeps the original orientation when a rotation overlaps or runs out of room", () => {
    const room = new RoomBuilder();
    room.place("bench", { x: 0, y: 4 });
    expect(room.rotate(0)).toMatch(/fit/);
    room.place("triangle", { x: 0, y: 0 });
    room.place("triangle", { x: 0, y: 0 }, 2);
    expect(room.rotate(1)).toMatch(/overlaps/);
    expect(room.pieces.map((piece) => piece.turn)).toEqual([0, 0, 2]);
    expect(room.undo()).toBe(true);
    expect(room.pieces).toHaveLength(2);
  });

  it("fills 100% of the room with complementary triangles and all other pieces", () => {
    const room = new RoomBuilder();
    for (let y = 0; y < 6; y += 2) expect(room.place("bench", { x: 0, y })).toBeNull();
    for (const x of [4, 6]) {
      for (const y of [0, 2]) expect(room.place("square", { x, y })).toBeNull();
      expect(room.place("triangle", { x, y: 4 })).toBeNull();
      expect(room.place("triangle", { x, y: 4 }, 2)).toBeNull();
    }
    expect(room.stats).toEqual({
      areaUsed: 48,
      areaRemaining: 0,
      utilization: 100,
      score: 480,
      count: 11,
    });
  });

  it("can undo an empty room safely", () => {
    expect(new RoomBuilder().undo()).toBe(false);
  });

  it("resets a room and restores inventory", () => {
    const room = new RoomBuilder();
    room.place("square", { x: 0, y: 0 });
    room.reset();
    expect(room.stats).toMatchObject({ count: 0, score: 0 });
    expect(room.remaining("square")).toBe(4);
  });

  it("finishes once, prevents edits, and can restart", () => {
    const room = new RoomBuilder();
    room.place("bench", { x: 0, y: 0 });
    expect(room.finish()).toBe(true);
    expect(room.finish()).toBe(false);
    expect(room.undo()).toBe(false);
    expect(room.move(0, { x: 0, y: 1 })).toMatch(/complete/);
    expect(room.rotate(0)).toMatch(/complete/);
    expect(room.place("square", { x: 4, y: 0 })).toMatch(/complete/);
    expect(room.stats.score).toBe(80);
    room.reset();
    expect(room.place("square", { x: 0, y: 0 })).toBeNull();
    expect(room.finish()).toBe(true);
  });
});
