// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { describe, expect, it } from "vitest";
import { MAPS, TILESETS } from "../../model/loadContent";
import { loadTileset, parseArt, parseRoad, type TileSprite } from "../../model/TileArt";
import { TILE } from "./GameScreenView";
import { buildTerrain, createTerrain } from "./TerrainView";
import { registerTilesetImage } from "./tilesetImages";

// Stands in for the loaded sheet. Konva only reads its size when it draws, which these tests don't.
const sheet = new Image();

const sprite = (overrides: Partial<TileSprite> = {}): TileSprite => ({
  x: 0,
  y: 0,
  col: 0,
  row: 0,
  rotation: 0,
  ...overrides,
});

describe("buildTerrain", () => {
  it("makes one picture per sprite", () => {
    const group = buildTerrain([sprite(), sprite({ x: 1 }), sprite({ y: 1 })], sheet, 256);
    expect(group.find("Image")).toHaveLength(3);
  });

  it("makes no pictures for no sprites", () => {
    expect(buildTerrain([], sheet, 256).find("Image")).toHaveLength(0);
  });

  it("sizes each picture to one tile and puts its middle on the middle of its tile", () => {
    const image = buildTerrain([sprite({ x: 3, y: 2 })], sheet, 256).findOne<Konva.Image>("Image")!;
    expect(image.width()).toBe(TILE);
    expect(image.height()).toBe(TILE);
    // The picture turns around its offset, so its position is the tile's middle
    expect(image.x()).toBe(3.5 * TILE);
    expect(image.y()).toBe(2.5 * TILE);
    expect(image.offsetX()).toBe(TILE / 2);
    expect(image.offsetY()).toBe(TILE / 2);
  });

  it("cuts the picture's cell out of the sheet", () => {
    const image = buildTerrain([sprite({ col: 4, row: 1 })], sheet, 256).findOne<Konva.Image>(
      "Image",
    )!;
    expect(image.crop()).toEqual({ x: 1024, y: 256, width: 256, height: 256 });
  });

  it("shaves the inset off every edge of the cell", () => {
    const image = buildTerrain([sprite({ col: 4, row: 1 })], sheet, 256, 1).findOne<Konva.Image>(
      "Image",
    )!;
    expect(image.crop()).toEqual({ x: 1025, y: 257, width: 254, height: 254 });
  });

  it("turns a picture by the sprite's rotation", () => {
    const rotations = [0, 90, 180, 270] as const;
    const group = buildTerrain(
      rotations.map((rotation) => sprite({ rotation })),
      sheet,
      256,
    );
    expect(group.find<Konva.Image>("Image").map((image) => image.rotation())).toEqual([
      0, 90, 180, 270,
    ]);
  });

  it("does not take the mouse, so the tile underneath still gets it", () => {
    const group = buildTerrain([sprite()], sheet, 256);
    expect(group.listening()).toBe(false);
  });
});

describe("createTerrain", () => {
  const meadow = TILESETS.find((tileset) => tileset.id === "meadow")!;
  const map1 = MAPS.find((map) => map.id === "map1")!;

  it("returns null for a map without a tileset", () => {
    expect(createTerrain({ ...map1, tileset: undefined, art: undefined })).toBeNull();
  });

  it("returns null when the sheet has not loaded, so the plain look is used", () => {
    expect(createTerrain({ ...map1, tileset: "never-loaded", art: undefined })).toBeNull();
  });

  it("draws every tile of the map once the sheet has loaded", () => {
    registerTilesetImage("meadow", sheet);
    const terrain = createTerrain(map1)!;
    expect(terrain.find("Image")).toHaveLength(map1.cols * map1.rows);
  });

  it("cuts each picture out of the cell the map's art names, inset as the tileset says", () => {
    registerTilesetImage("meadow", sheet);
    const sprites = parseArt(map1, meadow);
    const inset = meadow.inset ?? 0;
    const images = createTerrain(map1)!.find<Konva.Image>("Image");

    images.forEach((image, i) => {
      expect(image.crop()).toEqual({
        x: sprites[i].col * meadow.cellSize + inset,
        y: sprites[i].row * meadow.cellSize + inset,
        width: meadow.cellSize - 2 * inset,
        height: meadow.cellSize - 2 * inset,
      });
    });
  });
});

describe("createTerrain with a road overlay", () => {
  // Ground in row 0 and the road cells in row 2 of the same sheet
  const overlay = loadTileset({
    id: "overlay-test",
    sheet: "overlay-test.png",
    cellSize: 64,
    legend: {
      "#": { kind: "buildable", cells: [[0, 0]] },
      ".": { kind: "blocked", cells: [[1, 0]] },
    },
    road: { straight: [[0, 2]], corner: [[1, 2]] },
  });
  TILESETS.push(overlay);
  const map1 = MAPS.find((map) => map.id === "map1")!;
  const map = { ...map1, tileset: "overlay-test", art: undefined };
  const roadTiles = map.tiles.join("").split("P").length - 1;

  it("draws every tile, then a road piece over each road tile", () => {
    registerTilesetImage("overlay-test", sheet);
    const images = createTerrain(map)!.find<Konva.Image>("Image");
    expect(roadTiles).toBeGreaterThan(0);
    expect(images).toHaveLength(map.cols * map.rows + roadTiles);
  });

  it("puts the road after the ground, so it is drawn on top", () => {
    registerTilesetImage("overlay-test", sheet);
    const images = createTerrain(map)!.find<Konva.Image>("Image");
    const ground = images.slice(0, map.cols * map.rows);
    const road = images.slice(map.cols * map.rows);

    // the ground under the road is a ground cell (row 0), never a road cell (row 2)
    expect(ground.every((image) => image.crop().y === 0)).toBe(true);
    expect(road.every((image) => image.crop().y === 2 * 64)).toBe(true);
  });

  it("cuts and turns each road piece as parseRoad says, on the right tile", () => {
    registerTilesetImage("overlay-test", sheet);
    const road = parseRoad(map, overlay);
    const images = createTerrain(map)!
      .find<Konva.Image>("Image")
      .slice(map.cols * map.rows);

    images.forEach((image, i) => {
      expect(image.crop()).toMatchObject({ x: road[i].col * 64, y: road[i].row * 64 });
      expect(image.rotation()).toBe(road[i].rotation);
      expect(image.x()).toBe((road[i].x + 0.5) * TILE);
      expect(image.y()).toBe((road[i].y + 0.5) * TILE);
    });
  });

  it("draws the road as one picture, so its joins cannot show seams, and leaves the ground alone", () => {
    registerTilesetImage("overlay-test", sheet);
    const [ground, road] = createTerrain(map)!.getChildren() as Konva.Group[];
    expect(road.isCached()).toBe(true);
    expect(ground.isCached()).toBe(false);
    // the pieces are still there inside the picture
    expect(road.find("Image")).toHaveLength(roadTiles);
  });

  it("has no extra group for a tileset without a road", () => {
    registerTilesetImage("meadow", sheet);
    const terrain = createTerrain({ ...map1, art: undefined })!;
    expect(terrain.getChildren().every((child) => child instanceof Konva.Image)).toBe(true);
  });
});
