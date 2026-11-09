import { App } from "./app/App";
import { FONT } from "./screens/theme";

// Konva draws text only once, so wait for the font to load before showing any screen
const normalFont = document.fonts.load("20px " + FONT);
const boldFont = document.fonts.load("bold 20px " + FONT);
Promise.all([normalFont, boldFont]).then(() => {
  new App("container");
});
