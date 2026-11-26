import Konva from "konva";
import { CARD_BORDER, CARD_FILL, FONT, HEADER_BACKGROUND, PAGE_BACKGROUND } from "./theme";

const HEADER_HEIGHT = 104;
const MARGIN = 32; // space around the card

// The card is drawn at this size, then scaled to fit the window
export const CARD_WIDTH = 1335;
export const CARD_HEIGHT = 784;
export const CARD_CORNER_RADIUS = 24;

// The parts that the screens outside the game share: a grey background, a header with the
// game's name, and one big white card. A screen makes a Page, uses its group as its own
// group, and adds its own things to `content`.
//
//   ┌──────────────────────────────────────┐
//   │ header: game name                    │
//   ├──────────────────────────────────────┤
//   │  ┌────────────────────────────────┐  │
//   │  │ content (the card)             │  │
//   │  └────────────────────────────────┘  │
//   └──────────────────────────────────────┘
export class Page {
  group = new Konva.Group();
  // Starts with only the card in it. Positions inside are measured from the card's top-left
  // corner, as if the card were always CARD_WIDTH × CARD_HEIGHT; resize() scales the group.
  content = new Konva.Group();
  private background = new Konva.Rect({ fill: PAGE_BACKGROUND });
  private header = new Konva.Rect({ height: HEADER_HEIGHT, fill: HEADER_BACKGROUND });

  constructor() {
    const headerTitle = new Konva.Text({
      x: 37,
      y: 28,
      text: "Geometry Tower Defense",
      fontSize: 48,
      fontFamily: FONT,
      fill: "white",
    });
    const card = new Konva.Rect({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fill: CARD_FILL,
      stroke: CARD_BORDER,
      strokeWidth: 2,
      cornerRadius: CARD_CORNER_RADIUS,
      // A solid shadow below the card, like the buttons have
      shadowColor: CARD_BORDER,
      shadowOffset: { x: 0, y: 8 },
      shadowBlur: 0,
    });
    this.content.add(card);
    this.group.add(this.background, this.header, headerTitle, this.content);
  }

  resize(width: number, height: number): void {
    this.background.size({ width, height });
    this.header.width(width);

    // Fit the card into the space below the header and center it there
    const areaWidth = width - 2 * MARGIN;
    const areaHeight = height - HEADER_HEIGHT - 2 * MARGIN;
    const scale = Math.min(areaWidth / CARD_WIDTH, areaHeight / CARD_HEIGHT);
    this.content.scale({ x: scale, y: scale });
    this.content.position({
      x: MARGIN + (areaWidth - CARD_WIDTH * scale) / 2,
      y: HEADER_HEIGHT + MARGIN + (areaHeight - CARD_HEIGHT * scale) / 2,
    });
  }
}
