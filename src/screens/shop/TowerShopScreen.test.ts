import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TowerShopView } from "./TowerShopView";
import { TowerShopScreen } from "./TowerShopScreen";

type ShopCallbacks = ConstructorParameters<typeof TowerShopView>[0];
type ShopState = Parameters<TowerShopView["render"]>[0];

// Record what the screen asks the view to display.
const view = vi.hoisted(() => ({
  render: vi.fn(),
  showPopup: vi.fn(),
  clickAction: () => {},
}));

// Replace drawing with simple functions for these tests.
vi.mock("./TowerShopView", () => ({
  TowerShopView: class {
    group = {};
    render = view.render;
    showPopup = view.showPopup;

    constructor(callbacks: ShopCallbacks) {
      view.clickAction = callbacks.onAction;
    }
  },
}));

function displayedState(): ShopState {
  return view.render.mock.lastCall![0];
}

describe("Tower shop UI interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    new TowerShopScreen({
      switchTo: vi.fn(),
    });
  });

  it("provides the tower's cost and abilities to the view", () => {
    const state = displayedState();
    const tower = state.towers.find((item) => item.def.id === "circle")!;

    expect(tower.def.name).toBe("Circle Tower");
    expect(tower.def.description).toBe("Hits enemies inside a circle around it.");
    expect(tower.unlockCost).toBe(50);
    expect(tower.levels[0].damage).toBe(5);
    expect(tower.levels[0].attackSpeed).toBe(1);
    expect(tower.levels[0].radius).toBe(2.5);
  });

  it("provides the next upgrade's cost and improved abilities", () => {
    const tower = displayedState().towers.find((item) => item.def.id === "circle")!;

    const current = tower.levels[0];
    const next = tower.levels[1];

    expect(current.upgradeCost).toBe(75);
    expect(next.damage).toBeGreaterThan(current.damage);
    expect(next.attackSpeed).toBeGreaterThan(current.attackSpeed);
    expect(next.radius).toBeGreaterThan(current.radius);
  });

  it("updates the displayed state after an affordable unlock", () => {
    view.clickAction();

    const state = displayedState();

    expect(state.coins).toBe(150);
    expect(state.levels.get("circle")).toBe(0);
    expect(view.showPopup).not.toHaveBeenCalled();
  });

  it("requests a popup without changing coins or level when funds are insufficient", () => {
    view.clickAction(); // Unlock: 200 - 50 = 150
    view.clickAction(); // Upgrade: 150 - 75 = 75

    const rendersBeforeAttempt = view.render.mock.calls.length;

    view.clickAction(); // Next upgrade costs 125; only 75 remain.

    expect(view.showPopup).toHaveBeenCalledWith(
      "You need 125 coins, but have 75.\nEarn 50 more coins.",
    );
    expect(displayedState().coins).toBe(75);
    expect(displayedState().levels.get("circle")).toBe(1);
    expect(view.render).toHaveBeenCalledTimes(rendersBeforeAttempt);
  });
});
