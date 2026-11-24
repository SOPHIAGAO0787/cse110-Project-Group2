// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Tileset } from "../../model/TileArt";
import { getTilesetImage, loadTilesetImages, registerTilesetImage } from "./tilesetImages";

// Stands in for Image, which never loads anything in a test. Setting src makes it finish loading,
// or fail if the url is listed in `failing`, the way a browser would a moment later.
class FakeImage {
  static failing: string[] = [];
  static requested: string[] = [];
  onload: () => void = () => {};
  onerror: () => void = () => {};

  set src(url: string) {
    FakeImage.requested.push(url);
    queueMicrotask(() => (FakeImage.failing.includes(url) ? this.onerror() : this.onload()));
  }
}

function tileset(id: string, sheet: string): Tileset {
  return { id, sheet, cellSize: 64, legend: {} };
}

beforeEach(() => {
  FakeImage.failing = [];
  FakeImage.requested = [];
  vi.stubGlobal("Image", FakeImage);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadTilesetImages", () => {
  it("loads each sheet from public/tilesets and remembers it under the tileset's id", async () => {
    await loadTilesetImages([tileset("load-a", "a.png"), tileset("load-b", "b.png")]);

    expect(FakeImage.requested.sort()).toEqual(["/tilesets/a.png", "/tilesets/b.png"]);
    expect(getTilesetImage("load-a")).toBeInstanceOf(FakeImage);
    expect(getTilesetImage("load-b")).toBeInstanceOf(FakeImage);
  });

  it("gives a different image to each tileset", async () => {
    await loadTilesetImages([tileset("diff-a", "a.png"), tileset("diff-b", "b.png")]);
    expect(getTilesetImage("diff-a")).not.toBe(getTilesetImage("diff-b"));
  });

  it("still finishes when a sheet fails to load, and warns about it", async () => {
    FakeImage.failing = ["/tilesets/broken.png"];
    await loadTilesetImages([tileset("fail-ok", "fine.png"), tileset("fail-bad", "broken.png")]);

    expect(getTilesetImage("fail-bad")).toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("keeps the sheets that did load when another one fails", async () => {
    FakeImage.failing = ["/tilesets/broken.png"];
    await loadTilesetImages([tileset("keep-bad", "broken.png"), tileset("keep-ok", "fine.png")]);
    expect(getTilesetImage("keep-ok")).toBeDefined();
  });

  it("does nothing for an empty list", async () => {
    await expect(loadTilesetImages([])).resolves.toBeUndefined();
    expect(FakeImage.requested).toEqual([]);
  });
});

describe("getTilesetImage", () => {
  it("returns undefined for a tileset that was never loaded", () => {
    expect(getTilesetImage("never-loaded")).toBeUndefined();
  });

  it("returns an image that was registered by hand", () => {
    const image = new FakeImage() as unknown as HTMLImageElement;
    registerTilesetImage("by-hand", image);
    expect(getTilesetImage("by-hand")).toBe(image);
  });
});
