import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import { MAPS } from "../model/loadContent";
import type { Progress } from "../model/Progress";
import type { MapConfig } from "../model/types";
import { BUTTON_HEIGHT, makeBackButton, makeButton } from "./button";
import { formatStars } from "./resultFormat";
import {
  CARD_BORDER,
  CARD_FILL,
  CIRCLE_TOWER_COLOR,
  FONT,
  HEADER_BACKGROUND,
  LOCKED_BUTTON_FILL,
  PAGE_BACKGROUND,
  SQUARE_TOWER_COLOR,
  TITLE_TEXT,
  TRIANGLE_TOWER_COLOR,
} from "./theme";

const HEADER_HEIGHT = 104;
const MARGIN = 32; // space around the big card

// The big white card is drawn at this size, then scaled to fit the window
const CARD_WIDTH = 1335;
const CARD_HEIGHT = 784;

// One map card: a colored top with a shape, and a white strip with the name and a button
const MAP_CARD_WIDTH = 417;
const MAP_CARD_HEIGHT = 214;
const MAP_CARD_TOP = 120; // height of the colored top
const MAP_CARD_STRIP = "#fafcff";
const MAP_CARD_STEP_X = 492; // from one card's left edge to the next card's left edge
const MAP_CARD_STEP_Y = 304; // from one card's top edge to the next card's top edge
const BUTTON_WIDTH = 117;

const LOCKED_TOP = "#dfdfdf";
const LOCKED_SHAPE = "#a9a9a9";
const SUN_COLOR = "#ffd53d";

// How each map's card looks
type CardShape = "circle" | "triangle" | "square";

interface CardLook {
  mapId: string;
  topColor: string;
  shape: CardShape;
  shapeColor: string;
}

const CARD_LOOKS: CardLook[] = [
  { mapId: "map1", topColor: "#e2fdbd", shape: "circle", shapeColor: CIRCLE_TOWER_COLOR },
  { mapId: "map2", topColor: "#f8edc5", shape: "triangle", shapeColor: TRIANGLE_TOWER_COLOR },
  { mapId: "map3", topColor: "#8accf0", shape: "square", shapeColor: SQUARE_TOWER_COLOR },
  { mapId: "map4", topColor: "#dbe7f3", shape: "triangle", shapeColor: "#7d93b8" },
];

// Lets the player pick a map. Locked maps can't be picked; won maps show their best stars.
//
//   ┌──────────────────────────────────────┐
//   │ header: game name                    │
//   ├──────────────────────────────────────┤
//   │  ┌────────────────────────────────┐  │
//   │  │ [←] Choose your map            │  │
//   │  │  [ map 1 ]  [ map 2 ]          │  │
//   │  │  [ map 3 ]  [ map 4 ]          │  │
//   │  └────────────────────────────────┘  │
//   └──────────────────────────────────────┘
export class MapSelectScreen implements Screen {
  group = new Konva.Group();
  private app: ScreenSwitcher;
  private progress: Progress;
  private background = new Konva.Rect({ fill: PAGE_BACKGROUND });
  private header = new Konva.Rect({ height: HEADER_HEIGHT, fill: HEADER_BACKGROUND });
  private headerTitle = new Konva.Text({
    x: 37,
    y: 28,
    text: "Geometry Tower Defense",
    fontSize: 48,
    fontFamily: FONT,
    fill: "white",
  });
  // Everything inside the big card. Drawn at CARD_WIDTH × CARD_HEIGHT and scaled in resize().
  private content = new Konva.Group();
  private mapCards = new Konva.Group();

  constructor(app: ScreenSwitcher, progress: Progress) {
    this.app = app;
    this.progress = progress;

    const card = new Konva.Rect({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fill: CARD_FILL,
      stroke: CARD_BORDER,
      strokeWidth: 2,
      cornerRadius: 24,
      // A solid shadow below the card, like the buttons have
      shadowColor: CARD_BORDER,
      shadowOffset: { x: 0, y: 8 },
      shadowBlur: 0,
    });
    // The back arrow goes in the top-left corner, with the title next to it
    const backButton = makeBackButton(() => this.app.switchTo("menu"));
    backButton.position({ x: 56, y: 42 });
    const title = new Konva.Text({
      x: 112,
      y: 47,
      text: "Choose your map",
      fontSize: 28,
      fontFamily: FONT,
      fontStyle: "bold",
      fill: TITLE_TEXT,
    });
    const sun = new Konva.Circle({ x: 1230, y: 90, radius: 40, fill: SUN_COLOR });
    this.mapCards.position({ x: 76, y: 178 });
    this.content.add(card, title, sun, this.mapCards, backButton);

    this.group.add(this.background, this.header, this.headerTitle, this.content);
  }

  // Rebuilds the map cards every time, so locks and stars match the latest games.
  show(): void {
    this.mapCards.destroyChildren();
    for (let i = 0; i < MAPS.length; i++) {
      const mapCard = this.makeMapCard(MAPS[i]);
      // Two cards per row
      mapCard.position({ x: (i % 2) * MAP_CARD_STEP_X, y: Math.floor(i / 2) * MAP_CARD_STEP_Y });
      this.mapCards.add(mapCard);
    }
    this.group.visible(true);
  }

  hide(): void {
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.background.size({ width, height });
    this.header.width(width);

    // Fit the big card into the space below the header and center it there
    const areaWidth = width - 2 * MARGIN;
    const areaHeight = height - HEADER_HEIGHT - 2 * MARGIN;
    const scale = Math.min(areaWidth / CARD_WIDTH, areaHeight / CARD_HEIGHT);
    this.content.scale({ x: scale, y: scale });
    this.content.position({
      x: MARGIN + (areaWidth - CARD_WIDTH * scale) / 2,
      y: HEADER_HEIGHT + MARGIN + (areaHeight - CARD_HEIGHT * scale) / 2,
    });
  }

  private makeMapCard(map: MapConfig): Konva.Group {
    const unlocked = this.progress.isUnlocked(map.id);
    const look = findLook(map.id);
    const mapCard = new Konva.Group();

    // The whole card gets the top color; the white strip then covers its bottom part
    let topColor = LOCKED_TOP;
    let shapeColor = LOCKED_SHAPE;
    if (unlocked) {
      topColor = look.topColor;
      shapeColor = look.shapeColor;
    }
    const background = new Konva.Rect({
      width: MAP_CARD_WIDTH,
      height: MAP_CARD_HEIGHT,
      fill: topColor,
      cornerRadius: 24,
    });
    const strip = new Konva.Rect({
      y: MAP_CARD_TOP,
      width: MAP_CARD_WIDTH,
      height: MAP_CARD_HEIGHT - MAP_CARD_TOP,
      fill: MAP_CARD_STRIP,
      cornerRadius: 24,
    });
    const name = new Konva.Text({
      x: 16,
      y: MAP_CARD_TOP,
      height: MAP_CARD_HEIGHT - MAP_CARD_TOP,
      verticalAlign: "middle",
      text: map.name,
      fontSize: 26,
      fontFamily: FONT,
      fontStyle: "bold",
      fill: "black",
    });
    mapCard.add(background, makeShape(look.shape, shapeColor), strip, name);

    // A won map shows its best stars in the top left
    const stars = this.progress.starsFor(map.id);
    if (stars > 0) {
      const starText = new Konva.Text({
        x: 20,
        y: 16,
        text: formatStars(stars),
        fontSize: 34,
        fill: TITLE_TEXT,
      });
      mapCard.add(starText);
    }

    let buttonOrLabel: Konva.Group;
    if (unlocked) {
      buttonOrLabel = makeButton("Play", () => this.play(map.id), BUTTON_WIDTH);
    } else {
      buttonOrLabel = makeLockedLabel();
    }
    buttonOrLabel.position({
      x: MAP_CARD_WIDTH - 16 - BUTTON_WIDTH,
      y: MAP_CARD_TOP + (MAP_CARD_HEIGHT - MAP_CARD_TOP - BUTTON_HEIGHT) / 2,
    });
    mapCard.add(buttonOrLabel);
    return mapCard;
  }

  private play(mapId: string): void {
    this.progress.currentMapId = mapId;
    this.app.switchTo("game");
  }
}

function findLook(mapId: string): CardLook {
  for (const look of CARD_LOOKS) {
    if (look.mapId === mapId) {
      return look;
    }
  }
  throw new Error(`No card look for map "${mapId}"`);
}

// The shape in the top right of a map card
function makeShape(shape: CardShape, color: string): Konva.Shape {
  if (shape === "circle") {
    return new Konva.Circle({ x: 338, y: 62, radius: 44, fill: color });
  }
  if (shape === "square") {
    return new Konva.Rect({ x: 308, y: 30, width: 60, height: 60, fill: color });
  }
  // A right triangle with the right angle at the bottom left
  return new Konva.Line({ points: [307, 16, 307, 106, 394, 106], closed: true, fill: color });
}

// Looks like a button but is grey and does nothing when clicked
function makeLockedLabel(): Konva.Group {
  const label = new Konva.Group();
  const background = new Konva.Rect({
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    fill: LOCKED_BUTTON_FILL,
    cornerRadius: 9,
  });
  const text = new Konva.Text({
    text: "Locked",
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    align: "center",
    verticalAlign: "middle",
    fontSize: 20,
    fontFamily: FONT,
    fontStyle: "bold",
    fill: "white",
  });
  label.add(background, text);
  return label;
}
