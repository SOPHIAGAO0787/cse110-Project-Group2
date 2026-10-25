import Konva from "konva";

const TILE = 48; // pixels per tile before scaling

// '#' = buildable, 'P' = enemy path, '.' = blocked
const tiles = [
  "................",
  "PPPPP...........",
  "##..P.###.......",
  "##..P.###...##..",
  "....PPPPPPPPP##.",
  "..###.......P...",
  "..###..###..P...",
  ".......###..PPPP",
  "................",
  "................",
];

// Corners of the path that enemies will walk through, in tile coordinates
const path = [
  { x: 0, y: 1 },
  { x: 4, y: 1 },
  { x: 4, y: 4 },
  { x: 12, y: 4 },
  { x: 12, y: 7 },
  { x: 15, y: 7 },
];

const colors: Record<string, string> = { P: "#c2a878", "#": "#4a7c59", ".": "#2e3b2e" };

const stage = new Konva.Stage({ container: "container" });
const layer = new Konva.Layer();
stage.add(layer);

tiles.forEach((row, y) => {
  [...row].forEach((ch, x) => {
    layer.add(
      new Konva.Rect({
        x: x * TILE,
        y: y * TILE,
        width: TILE,
        height: TILE,
        fill: colors[ch],
        stroke: "#00000022",
      })
    );
  });
});

// Dashed line through the tile centers so you can see the enemy route
layer.add(
  new Konva.Line({
    points: path.flatMap((p) => [(p.x + 0.5) * TILE, (p.y + 0.5) * TILE]),
    stroke: "#f4e9c8",
    strokeWidth: 2,
    dash: [6, 6],
  })
);

// Scale the whole map to fit the browser window, centered
const mapWidth = tiles[0].length * TILE;
const mapHeight = tiles.length * TILE;

function fitToWindow() {
  const scale = Math.min(window.innerWidth / mapWidth, window.innerHeight / mapHeight);
  stage.size({ width: window.innerWidth, height: window.innerHeight });
  layer.scale({ x: scale, y: scale });
  layer.position({
    x: (window.innerWidth - mapWidth * scale) / 2,
    y: (window.innerHeight - mapHeight * scale) / 2,
  });
}

fitToWindow();
window.addEventListener("resize", fitToWindow);
