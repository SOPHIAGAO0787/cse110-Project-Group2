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

  describe("configure", () => {
    const config = { kind: "sector", facing: 0, spread: 1 } as const;

    function dropped() {
      const m = new PlacementModel();
      m.startDrag(tile);
      m.endDrag(tile, true);
      return m;
    }

    it("placed -> configuring, keeping the tile", () => {
      const m = dropped();
      m.configure(config);
      expect(m.state).toEqual({ kind: "configuring", pos: tile, config });
    });

    it("updates the config while configuring", () => {
      const m = dropped();
      m.configure(config);
      const next = { ...config, facing: 2 };
      m.configure(next);
      expect(m.state).toEqual({ kind: "configuring", pos: tile, config: next });
    });

    it("is ignored when nothing is dropped", () => {
      const m = new PlacementModel();
      m.configure(config);
      expect(m.state.kind).toBe("idle");
      m.startDrag(tile);
      m.configure(config);
      expect(m.state.kind).toBe("dragging");
    });

    it("confirm from configuring returns the tile and goes idle", () => {
      const m = dropped();
      m.configure(config);
      expect(m.confirm()).toEqual(tile);
      expect(m.state.kind).toBe("idle");
    });

    it("cancel from configuring goes idle", () => {
      const m = dropped();
      m.configure(config);
      m.cancel();
      expect(m.state.kind).toBe("idle");
    });
  });
});
