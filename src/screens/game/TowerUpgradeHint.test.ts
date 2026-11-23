// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, describe, expect, it } from "vitest";
import { TowerUpgradeHint } from "./TowerUpgradeHint";
import { Tower } from "../../model/Tower";
import { SHOP_TOWERS } from "../../model/shop/loadShopContent";

const hint = new TowerUpgradeHint();
const circle = SHOP_TOWERS.find((shop) => shop.def.id === "circle")!;
const rectangle = SHOP_TOWERS.find((shop) => shop.def.id === "rectangle")!;
const text = () =>
  hint.group
    .find<Konva.Text>("Text")
    .map((node) => node.text())
    .join("\n");
afterEach(() => hint.hide());

function show(maxLevel: number, coins: number) {
  hint.show(
    new Tower(1, circle.def, { x: 0, y: 2 }),
    circle,
    maxLevel,
    coins,
    { x: 750, y: 550 },
    { x: 800, y: 600 },
  );
}

describe("TowerUpgradeHint", () => {
  it("shows the next level's cost, stat changes, and click instruction", () => {
    show(1, 75);
    expect(text()).toContain("Upgrade to Level 2 · 75 coins");
    expect(text()).toContain("Damage: 5 → 8");
    expect(text()).toContain("Speed: 1 → 1.2 shots/sec");
    expect(text()).toContain("Radius: 2.5 → 2.8 tiles");
    expect(text()).toContain("Click this tower to upgrade.");
    expect(hint.group.listening()).toBe(false);
  });

  it("explains the purchased level cap before offering an upgrade", () => {
    show(0, 200);
    expect(text()).toContain("Unlock Level 2 in the Tower Shop first.");
    expect(text()).not.toContain("Click this tower to upgrade.");
  });

  it("shows exactly how many more match coins are needed", () => {
    show(1, 50);
    expect(text()).toContain("Need 25 more coins.");
    expect(text()).toContain("You have 50 of 75.");
  });

  it("uses the placed rectangle's chosen block size for upgraded firing speed", () => {
    const tower = new Tower(
      1,
      rectangle.def,
      { x: 0, y: 2 },
      { kind: "rect", facing: "up", width: 2, depth: 2, side: 1 },
    );
    hint.show(tower, rectangle, 1, 200, { x: 200, y: 200 }, { x: 800, y: 600 });
    expect(text()).toContain("Speed: 1.05 → 1.35 shots/sec");
    expect(text()).toContain("Your aimed range stays the same.");
  });

  it("shows a final-level state without offering another purchase", () => {
    const tower = new Tower(1, circle.def, { x: 0, y: 2 });
    tower.upgrade(circle.levels[1]);
    tower.upgrade(circle.levels[2]);
    hint.show(tower, circle, 2, 200, { x: 200, y: 200 }, { x: 800, y: 600 });
    expect(text()).toContain("Maximum level reached");
    expect(text()).not.toContain("Click this tower to upgrade.");
  });

  it("keeps the panel inside the viewport at a bottom-right tower", () => {
    show(1, 200);
    expect(hint.group.x()).toBeGreaterThanOrEqual(8);
    expect(hint.group.x() + 280).toBeLessThanOrEqual(800);
    expect(hint.group.y() + 216).toBeLessThanOrEqual(600);
    for (const node of hint.group.find<Konva.Text>("Text")) {
      expect(node.y() + node.height()).toBeLessThan(216);
    }
  });
});
