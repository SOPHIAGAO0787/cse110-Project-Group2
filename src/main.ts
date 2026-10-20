import Konva from "konva";

const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

layer.add(
  new Konva.Text({
    x: 0,
    y: stage.height() / 2 - 24,
    width: stage.width(),
    align: "center",
    text: "Geometry Tower Defense",
    fontSize: 48,
    fill: "white",
  })
);
