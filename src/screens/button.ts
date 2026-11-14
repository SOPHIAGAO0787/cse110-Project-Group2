import Konva from "konva";
import { BUTTON_FILL, BUTTON_SHADOW, FONT } from "./theme";

// Every button is this tall. Exported so a screen can line other things up with its buttons.
export const BUTTON_HEIGHT = 48;

// A clickable rectangle with a label. Konva has no built-in buttons, so we make our own.
// Most buttons are 200 wide; pass a width for a smaller or larger one.
export function makeButton(label: string, onClick: () => void, width = 200): Konva.Group {
  const button = new Konva.Group();
  const background = new Konva.Rect({
    width: width,
    height: BUTTON_HEIGHT,
    fill: BUTTON_FILL,
    cornerRadius: 9,
    // A solid shadow just below the button, like in the mockup
    shadowColor: BUTTON_SHADOW,
    shadowOffset: { x: 0, y: 4 },
    shadowBlur: 0,
  });
  const text = new Konva.Text({
    text: label,
    width: width,
    height: BUTTON_HEIGHT,
    align: "center",
    verticalAlign: "middle",
    fontSize: 20,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: "white",
  });
  button.add(background, text);

  button.on("click tap", onClick);
  // Show a hand cursor while the mouse is over the button
  button.on("mouseenter", () => {
    document.body.style.cursor = "pointer";
  });
  button.on("mouseleave", () => {
    document.body.style.cursor = "default";
  });
  return button;
}
