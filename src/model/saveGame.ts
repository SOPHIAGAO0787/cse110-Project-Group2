import type { Progress, ProgressSave } from "./Progress";
import type { TowerProgress, TowerProgressSave } from "./TowerProgress";

// The browser storage key that holds the whole save
export const SAVE_KEY = "geometry-td-save";

// Everything that is saved, as one plain object turned into JSON
interface SaveData {
  progress: ProgressSave;
  towers: TowerProgressSave;
}

// Writes the stars, bonus coins, shop coins and tower levels to the browser.
// If the browser refuses (storage full or turned off), the game keeps going without saving.
export function saveGame(progress: Progress, towerProgress: TowerProgress): void {
  const data: SaveData = {
    progress: progress.toSave(),
    towers: towerProgress.toSave(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Could not save progress", error);
  }
}

// Reads the save from the browser into progress and towerProgress.
// No save, or a save that is not valid JSON, leaves them as they are: a fresh start.
export function loadGame(progress: Progress, towerProgress: TowerProgress): void {
  let data: SaveData;
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text === null) {
      return;
    }
    data = JSON.parse(text);
  } catch (error) {
    console.warn("Could not load progress", error);
    return;
  }
  if (typeof data !== "object" || data === null) {
    return;
  }
  progress.loadSave(data.progress);
  towerProgress.loadSave(data.towers);
}
