import { App } from "./app/App";
import { TILESETS } from "./model/loadContent";
import { loadTilesetImages } from "./screens/game/tilesetImages";
import { FONT } from "./screens/theme";

// Konva draws text only once, so wait for the font to load before showing any screen.
// The map pictures load now too, because a map is drawn the moment it opens.
const normalFont = document.fonts.load("20px " + FONT);
const boldFont = document.fonts.load("bold 20px " + FONT);
Promise.all([normalFont, boldFont, loadTilesetImages(TILESETS)]).then(() => {
  new App("container");
});
