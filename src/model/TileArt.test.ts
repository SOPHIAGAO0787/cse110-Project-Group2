/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { MAPS, TILESETS } from "./loadContent";
import { checkArt, defaultArt, loadTileset, parseArt, roadSides, type Tileset } from "./TileArt";
import type { MapConfig } from "./types";

// A small tileset with every kind of piece. Cells are only labels here, nothing is drawn.
function tileset(): Tileset {
  return {
    id: "test",
    sheet: "test.png",
    cellSize: 64,
    legend: {
      "#": { kind: "buildable", cells: [[0, 0]] },
      ".": { kind: "blocked", cells: [[1, 0]] },
      "-": { kind: "path", connects: ["E", "W"], cells: [[2, 0]] },
      "|": { kind: "path", connects: ["N", "S"], cells: [[3, 0]] },
      L: { kind: "path", connects: ["N", "E"], cells: [[0, 1]] },
      "7": { kind: "path", connects: ["W", "S"], cells: [[1, 1]] },
      r: { kind: "path", connects: ["E", "S"], cells: [[2, 1]] },
      J: { kind: "path", connects: ["N", "W"], cells: [[2, 1]], rotation: 180 },
    },
  };
}

// A 5 by 3 map. The road comes in from the left edge, turns down at column 2, turns right
// again and leaves by the right edge:
//   --7..
//   ..|#.
//   ..L--
function map(overrides: Partial<MapConfig> = {}): MapConfig {
  return {
    id: "test",
    name: "Test",
    colors: { buildable: "#0f0", path: "#963", blocked: "#000" },
    decoration: "trees",
    cols: 5,
    rows: 3,
    tiles: ["PPP..", "..P#.", "..PPP"],
    path: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ],
    startingCoins: 100,
    startingLives: 10,
    waves: [],
    ...overrides,
  };
}

describe("loadTileset", () => {
  it("accepts the real tilesets", () => {
    for (const set of TILESETS) {
      expect(() => loadTileset(set)).not.toThrow();
    }
  });

  it("accepts a valid tileset and returns it", () => {
    const set = tileset();
    expect(loadTileset(set)).toBe(set);
  });

  it("rejects a tileset without an id or a sheet", () => {
    expect(() => loadTileset({ ...tileset(), id: undefined })).toThrow(/id and a sheet/);
    expect(() => loadTileset({ ...tileset(), sheet: 3 })).toThrow(/id and a sheet/);
  });

  it("rejects a cell size that is not a whole positive number", () => {
    for (const cellSize of [0, -64, 12.5, "64"]) {
      expect(() => loadTileset({ ...tileset(), cellSize })).toThrow(/cellSize/);
    }
  });

  it("rejects an inset that is negative, fractional, or half the cell or more", () => {
    for (const inset of [-1, 0.5, 32, 40]) {
      expect(() => loadTileset({ ...tileset(), inset })).toThrow(/inset/);
    }
    expect(() => loadTileset({ ...tileset(), inset: 1 })).not.toThrow();
    expect(() => loadTileset({ ...tileset(), inset: 0 })).not.toThrow();
  });

  it("rejects a tileset without a legend", () => {
    expect(() => loadTileset({ ...tileset(), legend: undefined })).toThrow(/legend/);
    expect(() => loadTileset({ ...tileset(), legend: null })).toThrow(/legend/);
  });

  it("rejects a legend name that is not one visible character", () => {
    for (const name of ["", "ab", " "]) {
      const legend = { ...tileset().legend, [name]: { kind: "blocked", cells: [[0, 0]] } };
      expect(() => loadTileset({ ...tileset(), legend })).toThrow(/one visible character/);
    }
  });

  it("rejects an unknown kind", () => {
    const legend = { x: { kind: "water", cells: [[0, 0]] } };
    expect(() => loadTileset({ ...tileset(), legend })).toThrow(/unknown kind "water"/);
  });

  it("rejects an entry with no cells or a bad cell", () => {
    for (const cells of [[], undefined, [[0]], [[-1, 0]], [[0.5, 1]], [["a", 1]], [0, 1]]) {
      const legend = { x: { kind: "blocked", cells } };
      expect(() => loadTileset({ ...tileset(), legend })).toThrow(/cell/);
    }
  });

  it("rejects a rotation that is not a quarter turn", () => {
    const legend = { x: { kind: "blocked", cells: [[0, 0]], rotation: 45 } };
    expect(() => loadTileset({ ...tileset(), legend })).toThrow(/rotation/);
  });

  it("rejects a road piece without two or more valid sides", () => {
    for (const connects of [undefined, ["N"], ["N", "up"], []]) {
      const legend = { x: { kind: "path", cells: [[0, 0]], connects } };
      expect(() => loadTileset({ ...tileset(), legend })).toThrow(/connects/);
    }
  });

  it("rejects connects on a piece that is not a road", () => {
    const legend = { x: { kind: "buildable", cells: [[0, 0]], connects: ["N", "S"] } };
    expect(() => loadTileset({ ...tileset(), legend })).toThrow(/only road pieces/);
  });
});

describe("roadSides", () => {
  it("opens the first tile towards the edge it comes from, and the last one towards the edge it leaves by", () => {
    const sides = roadSides(map());
    expect([...sides.get("0,0")!].sort()).toEqual(["E", "W"]);
    expect([...sides.get("4,2")!].sort()).toEqual(["E", "W"]);
  });

  it("opens a straight piece onto the two sides it runs between", () => {
    const sides = roadSides(map());
    expect([...sides.get("1,0")!].sort()).toEqual(["E", "W"]);
    expect([...sides.get("2,1")!].sort()).toEqual(["N", "S"]);
    expect([...sides.get("3,2")!].sort()).toEqual(["E", "W"]);
  });

  it("opens a corner onto the side it arrived by and the side it leaves by", () => {
    const sides = roadSides(map());
    expect([...sides.get("2,0")!].sort()).toEqual(["S", "W"]); // came from the left, goes down
    expect([...sides.get("2,2")!].sort()).toEqual(["E", "N"]); // came from above, goes right
  });

  it("covers every tile of the route once", () => {
    // (0,0) to (2,0) is 3 tiles, down to (2,2) adds 2, right to (4,2) adds 2
    expect(roadSides(map()).size).toBe(7);
  });

  it("works for a route that goes up and left", () => {
    const sides = roadSides(
      map({
        tiles: ["..P..", "..P..", "PPP.."],
        path: [
          { x: 0, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 0 },
        ],
      }),
    );
    expect([...sides.get("2,2")!].sort()).toEqual(["N", "W"]); // came from the left, goes up
  });

  it("rejects a diagonal segment instead of looping forever", () => {
    const diagonal = map({
      path: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ],
    });
    expect(() => roadSides(diagonal)).toThrow(/diagonal/);
  });
});

describe("defaultArt", () => {
  it("draws ground on the plain tiles and a piece on every road tile that fits the route", () => {
    expect(defaultArt(map(), tileset())).toEqual(["--7..", "..|#.", "..L--"]);
  });

  it("uses the first legend entry of a kind for plain tiles", () => {
    const set = tileset();
    set.legend = { a: { kind: "buildable", cells: [[5, 5]] }, ...set.legend };
    expect(defaultArt(map(), set)[1][3]).toBe("a");
  });

  it("gives the same answer every time", () => {
    expect(defaultArt(map(), tileset())).toEqual(defaultArt(map(), tileset()));
  });

  it("fails when the tileset has no piece for a corner of the route", () => {
    const set = tileset();
    delete set.legend["7"];
    expect(() => defaultArt(map(), set)).toThrow(/no road piece opens onto SW.*tile 2, 0/);
  });

  it("fails when the tileset has no ground of a kind the map uses", () => {
    const set = tileset();
    delete set.legend["#"];
    expect(() => defaultArt(map(), set)).toThrow(/no buildable tile/);
  });

  it("fails on a road tile the enemies never walk over", () => {
    const stray = map({ tiles: ["PPP..", "..P#P", "..PPP"] });
    expect(() => defaultArt(stray, tileset())).toThrow(/never crosses it/);
  });
});

describe("checkArt", () => {
  const art = ["--7..", "..|#.", "..L--"];

  it("accepts art that matches the tiles and the route", () => {
    expect(() => checkArt(map({ art }), tileset())).not.toThrow();
  });

  it("accepts a map without art if the tileset has every piece it needs", () => {
    expect(() => checkArt(map(), tileset())).not.toThrow();
  });

  it("rejects a map without art if the tileset lacks a piece", () => {
    const set = tileset();
    delete set.legend["L"];
    expect(() => checkArt(map(), set)).toThrow(/no road piece/);
  });

  it("rejects the wrong number of rows", () => {
    expect(() => checkArt(map({ art: art.slice(1) }), tileset())).toThrow(/2 rows but rows is 3/);
  });

  it("rejects a row of the wrong width", () => {
    const wide = [...art];
    wide[1] = "..|#..";
    expect(() => checkArt(map({ art: wide }), tileset())).toThrow(
      /row 1 has 6 tiles but cols is 5/,
    );
  });

  it("rejects a name that is not in the legend", () => {
    const typo = [...art];
    typo[0] = "--7x.";
    expect(() => checkArt(map({ art: typo }), tileset())).toThrow(
      /'x' at \(3, 0\) is not in the "test" legend/,
    );
  });

  it("rejects a picture of the wrong kind for its tile", () => {
    const wrong = [...art];
    wrong[1] = "..|..";
    expect(() => checkArt(map({ art: wrong }), tileset())).toThrow(
      /'\.' at \(3, 1\) is a blocked picture on a buildable tile/,
    );
    const road = [...art];
    road[0] = "#-7..";
    expect(() => checkArt(map({ art: road }), tileset())).toThrow(
      /a buildable picture on a path tile/,
    );
  });

  it("rejects a road piece that opens onto the wrong sides for the route", () => {
    const wrong = [...art];
    wrong[1] = "..-#.";
    expect(() => checkArt(map({ art: wrong }), tileset())).toThrow(
      /'-' at \(2, 1\) opens onto EW but the route there uses NS/,
    );
  });

  it("accepts a rotated piece whose sides fit, since only the legend's sides count", () => {
    const set = tileset();
    // J is the cell of r turned half a turn, so it opens onto N and W
    const turnedUp = map({
      tiles: ["..P..", "..P..", "PPP.."],
      path: [
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 0 },
      ],
      art: ["..|..", "..|..", "--J.."],
    });
    expect(() => checkArt(turnedUp, set)).not.toThrow();
  });
});

describe("parseArt", () => {
  it("returns one sprite per tile, row by row", () => {
    const sprites = parseArt(map(), tileset());
    expect(sprites).toHaveLength(15);
    expect(sprites[0]).toMatchObject({ x: 0, y: 0 });
    expect(sprites[4]).toMatchObject({ x: 4, y: 0 });
    expect(sprites[5]).toMatchObject({ x: 0, y: 1 });
    expect(sprites[14]).toMatchObject({ x: 4, y: 2 });
  });

  it("looks each name up in the legend", () => {
    const sprites = parseArt(map(), tileset());
    expect(sprites[0]).toMatchObject({ col: 2, row: 0, rotation: 0 }); // '-' at (0,0)
    expect(sprites[2]).toMatchObject({ col: 1, row: 1, rotation: 0 }); // '7' at (2,0)
    expect(sprites[7]).toMatchObject({ col: 3, row: 0, rotation: 0 }); // '|' at (2,1)
    expect(sprites[8]).toMatchObject({ col: 0, row: 0, rotation: 0 }); // '#' at (3,1)
    expect(sprites[12]).toMatchObject({ col: 0, row: 1, rotation: 0 }); // 'L' at (2,2)
  });

  it("passes the legend's rotation on", () => {
    const turnedUp = map({
      tiles: ["..P..", "..P..", "PPP.."],
      path: [
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 0 },
      ],
      art: ["..|..", "..|..", "--J.."],
    });
    const sprites = parseArt(turnedUp, tileset());
    expect(sprites[12]).toMatchObject({ x: 2, y: 2, col: 2, row: 1, rotation: 180 });
  });

  it("uses the map's own art instead of working it out", () => {
    const set = tileset();
    set.legend.b = { kind: "blocked", cells: [[7, 7]] };
    const mine = map({ art: ["--7..", "b.|#.", "..L--"] });
    expect(parseArt(mine, set)[5]).toMatchObject({ x: 0, y: 1, col: 7, row: 7 });
    expect(parseArt(map(), set)[5]).toMatchObject({ x: 0, y: 1, col: 1, row: 0 });
  });

  describe("tiles with several pictures", () => {
    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ];
    const grass = tileset();
    grass.legend["#"] = { kind: "buildable", cells };
    // 16 by 10 tiles of the same name
    const field = map({
      cols: 16,
      rows: 10,
      tiles: Array.from({ length: 10 }, () => "#".repeat(16)),
      path: [],
      art: Array.from({ length: 10 }, () => "#".repeat(16)),
    });

    it("picks the same picture for the same tile every time, always one from the list", () => {
      const sprites = parseArt(field, grass);
      expect(parseArt(field, grass)).toEqual(sprites);
      for (const sprite of sprites) {
        expect(cells).toContainEqual([sprite.col, sprite.row]);
      }
    });

    it("uses all of the pictures over a patch instead of just one", () => {
      const used = new Set(parseArt(field, grass).map((sprite) => `${sprite.col},${sprite.row}`));
      expect(used.size).toBe(cells.length);
    });
  });
});

describe("the real maps", () => {
  it("draws every map that has a tileset with art that fits its tiles", () => {
    for (const m of MAPS) {
      if (m.tileset === undefined) continue;
      const set = TILESETS.find((t) => t.id === m.tileset)!;
      expect(() => checkArt(m, set)).not.toThrow();
      const sprites = parseArt(m, set);
      expect(sprites).toHaveLength(m.cols * m.rows);
    }
  });

  it("has a piece in the meadow for every road shape in every map", () => {
    const meadow = TILESETS.find((t) => t.id === "meadow")!;
    for (const m of MAPS) {
      expect(() => defaultArt(m, meadow)).not.toThrow();
    }
  });
});

describe("the tileset sheets", () => {
  // Each sheet as a base64 data url, so the test can read the picture's size without Node's
  // file functions. A PNG starts with an 8 byte signature, then the IHDR chunk, whose width and
  // height are the two numbers at bytes 16 and 20.
  const sheets = import.meta.glob<string>("../../public/tilesets/*.png", {
    query: "?inline",
    import: "default",
    eager: true,
  });

  function sheetSize(file: string): { width: number; height: number } {
    const dataUrl = sheets[`../../public/tilesets/${file}`];
    if (dataUrl === undefined) {
      throw new Error(`public/tilesets/${file} is missing`);
    }
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  it("has a sheet file for every tileset", () => {
    for (const set of TILESETS) {
      expect(() => sheetSize(set.sheet)).not.toThrow();
    }
  });

  it("keeps every legend cell inside its sheet", () => {
    for (const set of TILESETS) {
      const { width, height } = sheetSize(set.sheet);
      for (const [name, def] of Object.entries(set.legend)) {
        for (const [col, row] of def.cells) {
          const inside = (col + 1) * set.cellSize <= width && (row + 1) * set.cellSize <= height;
          expect(inside, `${set.id} '${name}' cell [${col}, ${row}] is off the sheet`).toBe(true);
        }
      }
    }
  });
});
