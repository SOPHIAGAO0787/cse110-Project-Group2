// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { Sound, type EffectName } from "./Sound";

// The gap Sound.ts keeps between two shots of one tower type, in milliseconds
const FIRE_GAP_MS = 200;
const SHOTS: EffectName[] = ["fire-circle", "fire-triangle", "fire-square"];
const NEW_EFFECTS: EffectName[] = [...SHOTS, "wrong", "upgrade", "no-coins"];
const EFFECTS: EffectName[] = ["wave", "pop", "leak", "place", "win", "lose", ...NEW_EFFECTS];

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

  it.each(EFFECTS)("plays %s from its own file in public/audio", (name) => {
    sound.play(name);

    const audio = play.mock.contexts[0] as HTMLAudioElement;
    expect(audio.src).toContain(`/audio/${name}.mp3`);
  });

  it.each(NEW_EFFECTS)("plays nothing for %s while effects are off", (name) => {
    sound.toggleEffects();
    sound.play(name);

    expect(play).not.toHaveBeenCalled();
  });

  it("starts from the beginning when an effect plays again", () => {
    sound.play("wrong");
    const audio = play.mock.contexts[0] as HTMLAudioElement;
    audio.currentTime = 1.5;

    sound.play("wrong");

    expect(audio.currentTime).toBe(0);
  });
});

describe("Sound tower shots", () => {
  it.each(SHOTS)("plays two %s shots in the same moment only once", (name) => {
    sound.play(name);
    vi.advanceTimersByTime(FIRE_GAP_MS - 1);
    sound.play(name);

    expect(play).toHaveBeenCalledTimes(1);
  });

  it.each(SHOTS)("plays the next %s shot once the gap has passed", (name) => {
    sound.play(name);
    vi.advanceTimersByTime(FIRE_GAP_MS);
    sound.play(name);

    expect(play).toHaveBeenCalledTimes(2);
  });

  it("lets ten towers of one type make one sound", () => {
    for (let tower = 0; tower < 10; tower++) sound.play("fire-circle");

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("keeps a separate gap for each tower type", () => {
    sound.play("fire-circle");
    sound.play("fire-triangle");
    sound.play("fire-square");

    expect(play).toHaveBeenCalledTimes(3);
  });

  it("does not let a shot hold back a pop or any other effect", () => {
    sound.play("fire-circle");
    sound.play("pop");
    sound.play("wrong");

    expect(play).toHaveBeenCalledTimes(3);
  });

  it("does not count a shot that was switched off", () => {
    sound.toggleEffects();
    sound.play("fire-square");
    sound.toggleEffects();
    sound.play("fire-square");

    expect(play).toHaveBeenCalledTimes(1);
  });

  it.each(SHOTS)("plays %s quieter than the other effects", (name) => {
    sound.play(name);
    sound.play("place");

    const shot = play.mock.contexts[0] as HTMLAudioElement;
    const place = play.mock.contexts[1] as HTMLAudioElement;
    expect(shot.volume).toBeGreaterThan(0);
    expect(shot.volume).toBeLessThan(place.volume);
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
