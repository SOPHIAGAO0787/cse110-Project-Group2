// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHOP_TOWERS } from "../../model/shop/loadShopContent";
import { TowerShopView } from "./TowerShopView";

let view: TowerShopView;

afterEach(() => view.group.destroy());

function renderTower(id: string, level = 0) {
  view = new TowerShopView({ onSelect: vi.fn(), onAction: vi.fn(), onBack: vi.fn() });
  view.render({
    towers: SHOP_TOWERS,
    selectedId: id,
    levels: new Map([[id, level]]),
    coins: 200,
  });
  return view.group.find<Konva.Text>("Text");
}

describe("tower shop abilities", () => {
  it("shows the triangle's fixed area and the tradeoff between cone width and reach", () => {
    const text = renderTower("triangle")
      .map((node) => node.text())
      .join("\n");

    expect(text).toContain("Attack speed: 0.8 shots/sec");
    expect(text).toContain("Aimed cone: 7.5 tiles²");
    expect(text).toContain("Wider cones reach less far; narrower cones reach farther.");
    expect(text).not.toContain("Range radius:");
  });

  it("shows the rectangle's area and size-dependent firing speed", () => {
    const text = renderTower("rectangle")
      .map((node) => node.text())
      .join("\n");

    expect(text).toContain("Attack speed: 0.7–1.05 shots/sec");
    expect(text).toContain("Aimed block: up to 6 tiles²");
    expect(text).toContain("Smaller blocks fire faster; aim to choose the size.");
    expect(text).not.toContain("Range radius:");
  });

  it("keeps the circle's purchased stats and next upgrade visible", () => {
    const text = renderTower("circle", 1)
      .map((node) => node.text())
      .join("\n");

    expect(text).toContain("Damage: 8");
    expect(text).toContain("Attack speed: 1.2 shots/sec");
    expect(text).toContain("Range radius: 2.8 tiles");
    expect(text).toContain("Range radius: 2.8 → 3 tiles");
    expect(text).toContain("Upgrade · 125 coins");
  });

  it.each(["triangle", "rectangle"])(
    "keeps %s abilities above the upgrade preview and unlock button",
    (id) => {
      const nodes = renderTower(id, -1);
      const abilities = nodes.find((node) => node.text().startsWith("Damage:"))!;
      const status = nodes.find((node) =>
        node
          .text()
          .startsWith(
            id === "triangle" ? "Next upgrade after unlocking:" : "No further upgrades available",
          ),
      )!;

      expect(abilities.y() + abilities.height()).toBeLessThan(status.y());
      expect(status.y() + status.height()).toBeLessThan(520);
      expect(nodes.some((node) => node.text().startsWith("Unlock ·"))).toBe(true);
      expect(nodes.some((node) => node.text() === "No further upgrades available")).toBe(
        id === "rectangle",
      );
    },
  );

  it.each(["triangle"])("stops offering upgrades for %s at Level 3", (id) => {
    const nodes = renderTower(id, 2);
    expect(nodes.some((node) => node.text() === "Level 3")).toBe(true);
    expect(nodes.some((node) => node.text() === "No further upgrades available")).toBe(true);
    expect(nodes.some((node) => node.text().startsWith("Upgrade ·"))).toBe(false);
  });
});
