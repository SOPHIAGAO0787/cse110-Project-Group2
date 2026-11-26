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
  it("shows the next level's cost and stats on hover", () => {
    show(1, 75);
    expect(text()).toContain("Upgrade to Level 2 · 75 coins");
    expect(text()).toContain("Damage: 7 → 10");
    expect(text()).toContain("Speed: 0.8 → 1.2 shots/sec");
    expect(text()).toContain("Radius: 2 → 2.8 tiles");
    expect(text()).toContain("Use Upgrade below.");
    expect(hint.group.findOne(".upgrade-tower-button")?.visible()).toBe(true);
    expect(hint.group.findOne(".sell-tower-button")?.visible()).toBe(true);
    expect(hint.group.findOne(".sell-tower-button")?.listening()).toBe(true);
    expect(text()).toContain("Sell Tower (+25 coins)");
  });

  it("explains the purchased level cap before offering an upgrade", () => {
    show(0, 200);
    expect(text()).toContain("Unlock Level 2 in the Tower Shop first.");
    expect(text()).not.toContain("Spend 75 gameplay coins.");
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
    expect(text()).toContain("Speed: 1.05 → 1.65 shots/sec");
    expect(text()).toContain("Your aimed range stays the same.");
  });

  it("shows a final-level state without offering another purchase", () => {
    const tower = new Tower(1, circle.def, { x: 0, y: 2 });
    tower.upgrade(circle.levels[1]);
    tower.upgrade(circle.levels[2]);
    hint.show(tower, circle, 2, 200, { x: 200, y: 200 }, { x: 800, y: 600 });
    expect(text()).toContain("Maximum level reached");
    expect(text()).not.toContain("Spend 75 gameplay coins.");
  });

  it("keeps the panel inside the viewport at a bottom-right tower", () => {
    show(1, 200);
    expect(hint.group.x()).toBeGreaterThanOrEqual(8);
    expect(hint.group.x() + 280).toBeLessThanOrEqual(800);
    expect(hint.group.y() + 300).toBeLessThanOrEqual(600);
    for (const node of hint.group.find<Konva.Text>("Text")) {
      expect(node.y() + node.height()).toBeLessThan(300);
    }
  });
});
