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
  makeClickable(button, onClick);
  return button;
}

// Icon buttons are square and smaller than text buttons
const ICON_BUTTON_SIZE = 40;

// A square button with a left arrow, for going back to the previous screen.
// It is named "back" so tests can find it.
export function makeBackButton(onClick: () => void): Konva.Group {
  const middle = ICON_BUTTON_SIZE / 2;
  const arrow = new Konva.Arrow({
    points: [middle + 9, middle, middle - 9, middle],
    pointerLength: 9,
    pointerWidth: 14,
    stroke: "white",
    fill: "white",
    strokeWidth: 4,
    lineCap: "round",
  });
  return makeIconButton("back", arrow, onClick);
}

// A square button with a gear, for opening the settings. It is named "settings" so tests can find it.
export function makeSettingsButton(onClick: () => void): Konva.Group {
  const middle = ICON_BUTTON_SIZE / 2;
  const gear = new Konva.Group();
  // The teeth are the points of a star; the hole is a circle in the button's color
  gear.add(
    new Konva.Star({
      x: middle,
      y: middle,
      numPoints: 8,
      innerRadius: 10,
      outerRadius: 14,
      fill: "white",
    }),
  );
  gear.add(new Konva.Circle({ x: middle, y: middle, radius: 4, fill: BUTTON_FILL }));
  return makeIconButton("settings", gear, onClick);
}

function makeIconButton(
  name: string,
  icon: Konva.Shape | Konva.Group,
  onClick: () => void,
): Konva.Group {
  const button = new Konva.Group({ name: name });
  const background = new Konva.Rect({
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    fill: BUTTON_FILL,
    cornerRadius: 9,
    shadowColor: BUTTON_SHADOW,
    shadowOffset: { x: 0, y: 4 },
    shadowBlur: 0,
  });
  button.add(background, icon);
  makeClickable(button, onClick);
  return button;
}

// Runs onClick when the button is clicked, and shows a hand cursor while the mouse is over it
function makeClickable(button: Konva.Group, onClick: () => void): void {
  button.on("click tap", onClick);
  button.on("mouseenter", () => {
    document.body.style.cursor = "pointer";
  });
  button.on("mouseleave", () => {
    document.body.style.cursor = "default";
  });
}
