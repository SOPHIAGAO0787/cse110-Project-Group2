// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { Sound } from "./Sound";

// jsdom has no real audio, so play() and pause() are replaced and only counted
let play: MockInstance<() => Promise<void>>;
let pause: MockInstance<() => void>;
let sound: Sound;

beforeEach(() => {
  vi.useFakeTimers();
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  sound = new Sound();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Sound effects", () => {
  it("plays an effect while effects are on", () => {
    sound.play("wave");

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays nothing while effects are off", () => {
    sound.toggleEffects();
    sound.play("wave");

    expect(sound.effectsOn).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });

  it("plays again after effects are switched back on", () => {
    sound.toggleEffects();
    sound.toggleEffects();
    sound.play("place");

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays two pops in the same moment only once", () => {
    sound.play("pop");
    vi.advanceTimersByTime(79);
    sound.play("pop");

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays the next pop once the gap has passed", () => {
    sound.play("pop");
    vi.advanceTimersByTime(80);
    sound.play("pop");

    expect(play).toHaveBeenCalledTimes(2);
  });

  it("does not hold back other effects after a pop", () => {
    sound.play("pop");
    sound.play("leak");

    expect(play).toHaveBeenCalledTimes(2);
  });

  it("keeps going when the browser refuses to play", async () => {
    play.mockRejectedValue(new Error("blocked"));

    sound.play("win");
    await vi.runAllTimersAsync();

    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe("Sound music", () => {
  it("starts the music while music is on", () => {
    sound.startMusic();

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("does not start the music while music is off", () => {
    sound.toggleMusic();
    play.mockClear();
    sound.startMusic();

    expect(play).not.toHaveBeenCalled();
  });

  it("pauses the music when switched off and plays it when switched back on", () => {
    sound.toggleMusic();
    expect(sound.musicOn).toBe(false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();

    sound.toggleMusic();
    expect(sound.musicOn).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("keeps playing effects while the music is off", () => {
    sound.toggleMusic();
    sound.play("lose");

    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe("Sound onChange", () => {
  it("is called after each switch changes", () => {
    const onChange = vi.fn();
    sound.onChange = onChange;

    sound.toggleMusic();
    sound.toggleEffects();

    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
