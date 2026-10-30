import type { Vec } from "../model/types";
// View pixel and tile conversions

//tile position -> center pixel
export const tileToPixel = (v: Vec, size: number): Vec => ({
  x: (v.x + 0.5) * size,
  y: (v.y + 0.5) * size,
});

//pixel -> exact tile position
export const pixelToVec = (px: number, py: number, size: number): Vec =>
  //temporary conversion without grid
  ({ x: px / size - 0.5, y: py / size - 0.5 });

//pixel -> tile at location
export const pixelToTile = (px: number, py: number, size: number): Vec =>
  //use once grid is implemented
  ({ x: Math.floor(px / size), y: Math.floor(py / size) });
