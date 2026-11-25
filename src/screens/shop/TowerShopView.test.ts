// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHOP_TOWERS } from "../../model/shop/loadShopContent";
import { TowerShopView } from "./TowerShopView";

let view: TowerShopView;

afterEach(() => view.group.destroy());

function renderTower(id: string, level = 0) {
  view = new TowerShopView({
    onSelect: vi.fn(),
    onAction: vi.fn(),
    onBack: vi.fn(),
    onSettings: vi.fn(),
  });
  view.render({
    towers: SHOP_TOWERS,
    selectedId: id,
    levels: new Map([[id, level]]),
    coins: 200,
  });
  return view.group.findOne<Konva.Group>(`.tower-${id}`)!;
}

function displayedText(card: Konva.Group): string {
  return card
    .find<Konva.Text>("Text")
    .map((node) => node.text())
    .join("\n");
}

describe("tower shop cards", () => {
  it("shows the triangle's fixed area and the tradeoff between cone width and reach", () => {
    const text = displayedText(renderTower("triangle"));
    expect(text).toContain("0.8 / sec");
    expect(text).toContain("7.5 tiles²");
    expect(text).toContain("Wider cones reach less far; narrower cones reach farther.");
    expect(text).not.toContain("Radius:");
  });

  it("shows the rectangle's area and size-dependent firing speed", () => {
    const text = displayedText(renderTower("rectangle"));
    expect(text).toContain("0.7–1.05 / sec");
    expect(text).toContain("up to 6 tiles²");
    expect(text).toContain("Smaller blocks fire faster; aim to choose the size.");
    expect(text).not.toContain("Radius:");
  });

  it("keeps the circle's purchased stats and next upgrade visible", () => {
    const text = displayedText(renderTower("circle", 1));
    expect(text).toContain("Level 2 of 3 unlocked");
    expect(text).toContain("1.2 / sec");
    expect(text).toContain("2.8 tiles");
    expect(text).toContain("Damage: 8 → 10");
    expect(text).toContain("Radius: 2.8 → 3 tiles");
    expect(text).toContain("Upgrade tower · 125 coins");
  });

  it.each(["triangle", "rectangle"])(
    "keeps %s descriptions and previews above the unlock button",
    (id) => {
      const card = renderTower(id, -1);
      const nodes = card.find<Konva.Text>("Text");
      const note = nodes.find((node) =>
        node.text().startsWith(id === "triangle" ? "Wider cones" : "Smaller blocks"),
      )!;
      const preview = nodes.find((node) => node.text().startsWith("After unlocking"))!;
      expect(note.y() + note.height()).toBeLessThan(378);
      expect(preview.y()).toBeGreaterThan(note.y() + note.height());
      for (const node of nodes.filter((node) => node.y() >= 388)) {
        expect(node.y() + node.height()).toBeLessThan(492);
      }
      expect(nodes.some((node) => node.text().startsWith("Unlock tower ·"))).toBe(true);
    },
  );

  it("previews the rectangle's faster firing rates at the next level", () => {
    const text = displayedText(renderTower("rectangle", 1));
    expect(text).toContain("Attack speed: 0.9–1.35 → 1.1–1.65 / sec");
    expect(text).toContain("Upgrade tower · 175 coins");
  });

  it.each(["triangle", "rectangle"])("disables the %s purchase button at Level 3", (id) => {
    const card = renderTower(id, 2);
    const text = displayedText(card);
    expect(text).toContain("Level 3 of 3 unlocked");
    expect(text).toContain("No further upgrades available");
    const button = card
      .find<Konva.Text>("Text")
      .find((node) => node.text() === "Maximum level reached")!
      .getParent()!;
    expect(button.listening()).toBe(false);
  });

  it.each(["triangle", "rectangle", "circle"])(
    "selects %s before purchasing from its own card",
    (id) => {
      let selectedId = "circle";
      const onSelect = vi.fn((selected: string) => {
        selectedId = selected;
      });
      const onAction = vi.fn(() => expect(selectedId).toBe(id));
      view = new TowerShopView({ onSelect, onAction, onBack: vi.fn(), onSettings: vi.fn() });
      view.render({ towers: SHOP_TOWERS, selectedId, levels: new Map(), coins: 200 });
      const card = view.group.findOne<Konva.Group>(`.tower-${id}`)!;
      const button = card
        .find<Konva.Text>("Text")
        .find((node) => node.text().startsWith("Unlock tower ·"))!
        .getParent()!;
      button.fire("click", {}, true);
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(id);
      expect(onAction).toHaveBeenCalledTimes(1);
    },
  );
});
