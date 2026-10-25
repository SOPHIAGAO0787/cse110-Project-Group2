import Konva from "konva";
import { TILE } from "./core/constants";
import map1 from "./data/maps/map1.json";
import type { MapConfig } from "./model/types";
import { GridView } from "./screens/game/views/GridView";

const map: MapConfig = map1;

const stage = new Konva.Stage({
  container: "container",
  width: map.cols * TILE,
  height: map.rows * TILE,
});

const mapLayer = new Konva.Layer();
mapLayer.add(new GridView(map).group);
stage.add(mapLayer);
