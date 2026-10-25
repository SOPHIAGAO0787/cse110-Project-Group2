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
      }),
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
  }),
);

// Placeholder for the shop column on the right
const SHOP_WIDTH = 260;
const MARGIN = 32; // gap between the map and the window edges / shop

const shopLayer = new Konva.Layer();
const shopPanel = new Konva.Rect({ fill: "#262637", stroke: "#3a3a52" });
const shopTitle = new Konva.Text({ text: "Shop", fontSize: 22, fill: "white" });
shopLayer.add(shopPanel, shopTitle);
stage.add(shopLayer);

// Scale the map to fit the space left of the shop, centered in that space
const mapWidth = tiles[0].length * TILE;
const mapHeight = tiles.length * TILE;

function fitToWindow() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  stage.size({ width: w, height: h });

  shopPanel.position({ x: w - SHOP_WIDTH, y: 0 });
  shopPanel.size({ width: SHOP_WIDTH, height: h });
  shopTitle.position({ x: w - SHOP_WIDTH + 20, y: 20 });

  const areaWidth = w - SHOP_WIDTH - 2 * MARGIN;
  const areaHeight = h - 2 * MARGIN;
  const scale = Math.min(areaWidth / mapWidth, areaHeight / mapHeight);
  layer.scale({ x: scale, y: scale });
  layer.position({
    x: MARGIN + (areaWidth - mapWidth * scale) / 2,
    y: MARGIN + (areaHeight - mapHeight * scale) / 2,
  });
}

fitToWindow();
window.addEventListener("resize", fitToWindow);
