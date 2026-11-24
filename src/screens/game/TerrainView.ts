import Konva from "konva";
import { findTileset } from "../../model/loadContent";
import { parseArt, parseRoad, type TileSprite } from "../../model/TileArt";
import type { MapConfig } from "../../model/types";
import { TILE } from "./GameScreenView";
import { getTilesetImage } from "./tilesetImages";

// One picture per tile, cut from the sheet. Rotated pictures turn around their middle.
// `listening: false` so the tile underneath still gets the mouse.
export function buildTerrain(
  sprites: TileSprite[],
  sheet: HTMLImageElement,
  cellSize: number,
  inset = 0,
): Konva.Group {
  const group = new Konva.Group({ listening: false });
  for (const sprite of sprites) {
    group.add(
      new Konva.Image({
        image: sheet,
        x: (sprite.x + 0.5) * TILE,
        y: (sprite.y + 0.5) * TILE,
        width: TILE,
        height: TILE,
        offsetX: TILE / 2,
        offsetY: TILE / 2,
        rotation: sprite.rotation,
        crop: {
          x: sprite.col * cellSize + inset,
          y: sprite.row * cellSize + inset,
          width: cellSize - 2 * inset,
          height: cellSize - 2 * inset,
        },
      }),
    );
  }
  return group;
}

// The road overlay is drawn into one picture once, this many pixels per tile unit, and the screen
// then scales that single picture. Drawn piece by piece, the joins between pieces land between
// screen pixels at most zooms and show as thin light lines through the see-through road.
// 4 gives 192 pixels per tile, more than any screen shows a tile at.
const ROAD_PIXEL_RATIO = 4;

// The textured ground for a map, or null when the map has no tileset or its sheet has not
// loaded. GridView then draws the plain colored look instead.
export function createTerrain(map: MapConfig): Konva.Group | null {
  if (map.tileset === undefined) {
    return null;
  }
  const sheet = getTilesetImage(map.tileset);
  if (sheet === undefined) {
    return null;
  }
  const tileset = findTileset(map.tileset);
  const ground = buildTerrain(parseArt(map, tileset), sheet, tileset.cellSize, tileset.inset);

  // A tileset with a road overlay draws it over the ground. One without just has the ground.
  const road = parseRoad(map, tileset);
  if (road.length === 0) {
    return ground;
  }
  const roadPicture = buildTerrain(road, sheet, tileset.cellSize, tileset.inset);
  roadPicture.cache({ pixelRatio: ROAD_PIXEL_RATIO });

  const terrain = new Konva.Group({ listening: false });
  terrain.add(ground, roadPicture);
  return terrain;
}
