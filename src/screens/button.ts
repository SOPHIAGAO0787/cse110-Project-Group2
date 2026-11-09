import Konva from "konva";
import { BUTTON_FILL, BUTTON_SHADOW, FONT } from "./theme";

// A clickable rectangle with a label. Konva has no built-in buttons, so we make our own.
export function makeButton(label: string, onClick: () => void): Konva.Group {
  const button = new Konva.Group();
  const background = new Konva.Rect({
    width: 200,
    height: 48,
    fill: BUTTON_FILL,
    cornerRadius: 9,
    // A solid shadow just below the button, like in the mockup
    shadowColor: BUTTON_SHADOW,
    shadowOffset: { x: 0, y: 4 },
    shadowBlur: 0,
  });
  const text = new Konva.Text({
    text: label,
    width: 200,
    height: 48,
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
