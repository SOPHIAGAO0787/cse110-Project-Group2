import Konva from "konva";

// A clickable rectangle with a label. Konva has no built-in buttons, so we make our own.
export function makeButton(label: string, onClick: () => void): Konva.Group {
  const button = new Konva.Group();
  const background = new Konva.Rect({ width: 200, height: 48, fill: "#4a7c59", cornerRadius: 6 });
  const text = new Konva.Text({
    text: label,
    width: 200,
    height: 48,
    align: "center",
    verticalAlign: "middle",
    fontSize: 20,
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
