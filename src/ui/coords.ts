import type { Vec } from "../model/types";
// View pixel and tile conversions

//tile position -> center pixel
export const tileToPixel = (v: Vec, size: number): Vec => ({
  x: (v.x + 0.5) * size,
  y: (v.y + 0.5) * size,
});
