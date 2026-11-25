// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sound } from "../../core/Sound";
import { SettingsPanel } from "./SettingsPanel";

let sound: Sound;
let panel: SettingsPanel;

// The labels of every button in the panel, top to bottom
function labels(): string[] {
  const texts = panel.group.find<Konva.Text>("Text");
  const result: string[] = [];
  for (const text of texts) {
    if (text.text() !== "Settings") {
      result.push(text.text());
    }
  }
  return result;
}

function click(label: string): void {
  for (const text of panel.group.find<Konva.Text>("Text")) {
    const button = text.getParent();
    if (text.text() === label && button !== null) {
      button.fire("click");
      return;
    }
  }
  throw new Error(`${label} button is missing from the settings`);
}

beforeEach(() => {
  // jsdom has no real audio
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  sound = new Sound();
  panel = new SettingsPanel(
    () => {},
    () => {},
    () => {},
    () => {},
    sound,
  );
});

afterEach(() => {
  panel.group.destroy();
  vi.restoreAllMocks();
});

describe("SettingsPanel sound switches", () => {
  it("shows both switches as on at first", () => {
    expect(labels()).toEqual([
      "Resume",
      "Restart",
      "Music: On",
      "Sound: On",
      "Back to maps",
      "Main menu",
    ]);
  });

  it("switches the music off and on again", () => {
    click("Music: On");
    expect(sound.musicOn).toBe(false);
    expect(labels()).toContain("Music: Off");

    click("Music: Off");
    expect(sound.musicOn).toBe(true);
    expect(labels()).toContain("Music: On");
  });

  it("switches the effects off and on again", () => {
    click("Sound: On");
    expect(sound.effectsOn).toBe(false);
    expect(labels()).toContain("Sound: Off");

    click("Sound: Off");
    expect(sound.effectsOn).toBe(true);
    expect(labels()).toContain("Sound: On");
  });

  it("changes only the switch that was clicked", () => {
    click("Music: On");

    expect(labels()).toEqual([
      "Resume",
      "Restart",
      "Music: Off",
      "Sound: On",
      "Back to maps",
      "Main menu",
    ]);
    expect(sound.effectsOn).toBe(true);
  });

  it("shows a switch as off when the sound was already off", () => {
    sound.toggleEffects();
    const later = new SettingsPanel(
      () => {},
      () => {},
      () => {},
      () => {},
      sound,
    );

    const texts = later.group.find<Konva.Text>("Text");
    expect(texts.some((text) => text.text() === "Sound: Off")).toBe(true);
    later.group.destroy();
  });

  it("shows a change made on the main menu when it opens", () => {
    sound.toggleMusic();
    panel.open();
    expect(labels()).toContain("Music: Off");
  });
});

describe("SettingsPanel Escape key", () => {
  function pressEscape(): void {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }

  it("does what Resume does while the panel is open", () => {
    const onResume = vi.fn();
    const escapable = new SettingsPanel(
      onResume,
      () => {},
      () => {},
      () => {},
      sound,
    );
    escapable.open();
    pressEscape();

    expect(onResume).toHaveBeenCalledTimes(1);
    escapable.close();
    escapable.group.destroy();
  });

  it("does nothing once the panel is closed", () => {
    const onResume = vi.fn();
    const escapable = new SettingsPanel(
      onResume,
      () => {},
      () => {},
      () => {},
      sound,
    );
    escapable.open();
    escapable.close();
    pressEscape();

    expect(onResume).not.toHaveBeenCalled();
    escapable.group.destroy();
  });
});
