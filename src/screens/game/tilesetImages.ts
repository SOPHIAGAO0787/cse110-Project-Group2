import type { Tileset } from "../../model/TileArt";

// The loaded picture sheets, by tileset id.
const images = new Map<string, HTMLImageElement>();

// Remembers a loaded sheet. loadTilesetImages calls this, and tests use it to skip the loading.
export function registerTilesetImage(id: string, image: HTMLImageElement): void {
  images.set(id, image);
}

// The sheet for this tileset, or undefined if it has not loaded (or failed to load).
export function getTilesetImage(id: string): HTMLImageElement | undefined {
  return images.get(id);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

// Loads every sheet before the game starts, because a map is drawn the moment it opens.
// A sheet that fails to load is only reported: its maps then fall back to the plain colored look,
// so a missing file never stops the game from starting.
export async function loadTilesetImages(tilesets: Tileset[]): Promise<void> {
  await Promise.all(
    tilesets.map(async (tileset) => {
      try {
        registerTilesetImage(tileset.id, await loadImage(`/tilesets/${tileset.sheet}`));
      } catch (error) {
        console.warn(`Tileset "${tileset.id}":`, error);
      }
    }),
  );
}
