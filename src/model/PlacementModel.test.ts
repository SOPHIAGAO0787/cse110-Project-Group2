import { describe, it, expect } from "vitest";
import { PlacementModel } from "./PlacementModel";

describe("PlacementModel", () => {
  const tile = { x: 2, y: 3 };

  it("starts idle", () => {
    expect(new PlacementModel().state.kind).toBe("idle");
  });

  it("startDrag -> dragging", () => {
    const m = new PlacementModel();
    m.startDrag(tile);
    expect(m.state.kind).toBe("dragging");
  });

  it("drop on a valid tile -> placed", () => {
    const m = new PlacementModel();
    m.startDrag(tile);
    m.endDrag(tile, true);
    expect(m.state).toEqual({ kind: "placed", pos: tile });
  });

  it("drop on a bad tile -> idle", () => {
    const m = new PlacementModel();
    m.startDrag(tile);
    m.endDrag(tile, false);
    expect(m.state.kind).toBe("idle");
  });

  it("endDrag is ignored when not dragging", () => {
    const m = new PlacementModel();
    m.endDrag(tile, true);
    expect(m.state.kind).toBe("idle");
  });

  it("confirm() returns the tile and goes back to idle", () => {
    const m = new PlacementModel();
    m.startDrag(tile);
    m.endDrag(tile, true);
    expect(m.confirm()).toEqual(tile);
    expect(m.state.kind).toBe("idle");
  });

  it("confirm() returns null when nothing is placed", () => {
    expect(new PlacementModel().confirm()).toBeNull();
  });

  it("cancel() goes back to idle", () => {
    const m = new PlacementModel();
    m.startDrag(tile);
    m.endDrag(tile, true);
    m.cancel();
    expect(m.state.kind).toBe("idle");
  });
});