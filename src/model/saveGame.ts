import type { Progress, ProgressSave } from "./Progress";
import type { TowerProgress, TowerProgressSave } from "./TowerProgress";

// The browser storage key that holds the whole save
export const SAVE_KEY = "geometry-td-save";
// The settings have their own key, so resetting the progress keeps them
export const SETTINGS_KEY = "geometry-td-settings";

// The Music and Sound switches. The App passes its Sound, which has both fields.
export interface Settings {
  musicOn: boolean;
  effectsOn: boolean;
}

// Everything that is saved, as one plain object turned into JSON
interface SaveData {
  progress: ProgressSave;
  towers: TowerProgressSave;
}

// Writes the stars, bonus coins, tutorial flag, shop coins and tower levels to the browser.
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

// Writes the Music and Sound switches to the browser
export function saveSettings(settings: Settings): void {
  const data: Settings = { musicOn: settings.musicOn, effectsOn: settings.effectsOn };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Could not save settings", error);
  }
}

// Reads the saved switches into settings. A missing or broken save, or a value that is not
// true or false, keeps that switch as it is (on).
export function loadSettings(settings: Settings): void {
  let data: Settings;
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    if (text === null) {
      return;
    }
    data = JSON.parse(text);
  } catch (error) {
    console.warn("Could not load settings", error);
    return;
  }
  if (typeof data !== "object" || data === null) {
    return;
  }
  if (typeof data.musicOn === "boolean") {
    settings.musicOn = data.musicOn;
  }
  if (typeof data.effectsOn === "boolean") {
    settings.effectsOn = data.effectsOn;
  }
}
