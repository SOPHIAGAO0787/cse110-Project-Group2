import Konva from "konva";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tower } from "../../model/Tower";
import { TOWERS } from "../../model/loadContent";
import { SHOP_TOWERS } from "../../model/shop/loadShopContent";
import { TILE } from "./GameScreenView";
import { TowersView } from "./TowersView";

// Capture animation targets without running browser animation timers.
const tweens = vi.hoisted(() => [] as { radius?: number; node: Konva.Node }[]);
vi.mock("konva", async (importOriginal) => {
  const original = await importOriginal<typeof import("konva")>();
  return {
    default: {
      ...original.default,
      Tween: class {
        constructor(config: { radius?: number; node: Konva.Node }) {
          tweens.push(config);
        }
        play() {
          return this;
        }
      },
      Animation: class {
        start() {}
        stop() {}
      },
    },
  };
});

beforeEach(() => {
  tweens.length = 0;
});

describe("TowersView", () => {
  it("draws each placed tower once at its tile center without blocking grid clicks", () => {
    const def = TOWERS.find((item) => item.id === "circle")!;
    const view = new TowersView();
    view.add(new Tower(1, def, { x: 2, y: 3 }));

    expect(view.group.getChildren()).toHaveLength(1);
    expect(view.group.getChildren()[0].position()).toEqual({ x: 2.5 * TILE, y: 3.5 * TILE });
    expect(view.group.listening()).toBe(false);
  });

  it("uses the upgraded radius for firing rings on an existing sprite", () => {
    const circle = SHOP_TOWERS.find((item) => item.def.id === "circle")!;
    const tower = new Tower(1, circle.def, { x: 0, y: 2 });
    const view = new TowersView();
    view.add(tower);
    view.fire(tower.id);
    expect(tweens.find((config) => config.radius !== undefined)?.radius).toBe(
      circle.def.range.radius * TILE,
    );

    tweens.length = 0;
    tower.upgrade(circle.levels[1]);
    view.fire(tower.id);

    expect(tweens.find((config) => config.radius !== undefined)?.radius).toBe(
      circle.levels[1].radius * TILE,
    );
    expect(tweens.some((config) => config.node instanceof Konva.Circle)).toBe(true);
  });
});
