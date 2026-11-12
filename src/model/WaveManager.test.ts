import { describe, expect, it } from "vitest";
import { EventBus } from "../core/EventBus";
import { WaveManager } from "./WaveManager";
import type { WaveConfig } from "./types";

const group = (enemy: string, count: number, intervalSec: number) => ({
  enemy,
  count,
  intervalSec,
});

function setup(waves: WaveConfig[] = [{ groups: [group("basic", 3, 0.1)] }]) {
  const events = new EventBus();
  const manager = new WaveManager(waves, events);
  let nextId = 1;
  // Mirrors GameModel: tick returns definitions, then each created enemy announces its ID.
  const spawn = (dt: number) =>
    manager.tick(dt).map((defId) => {
      const id = nextId++;
      events.emit("enemySpawned", { enemyId: id });
      return { defId, id };
    });
  return { manager, events, spawn };
}

describe("WaveManager (N1)", () => {
  it("spawns each group's count of enemies, intervalSec apart", () => {
    const { manager, spawn } = setup([
      { groups: [group("basic", 2, 0.5), group("fast", 2, 0.25)] },
    ]);
    manager.start();
    expect(spawn(0).map((e) => e.defId)).toEqual(["basic"]);
    expect(spawn(0.49)).toEqual([]);
    expect(spawn(0.01).map((e) => e.defId)).toEqual(["basic"]);
    expect(spawn(0.24)).toEqual([]);
    expect(spawn(0.01).map((e) => e.defId)).toEqual(["fast"]);
    expect(spawn(0.25).map((e) => e.defId)).toEqual(["fast"]);
    expect(spawn(100)).toEqual([]);
    expect(manager.enemiesLeft).toBe(4);
    expect(manager.isRunning).toBe(true); // spawning finished, enemies still alive
  });

  it("emits waveStarted with the wave number and total after updating state", () => {
    const { manager, events } = setup();
    const seen: unknown[] = [];
    events.on("waveStarted", (event) =>
      seen.push({
        event,
        wave: manager.currentWave,
        left: manager.enemiesLeft,
        running: manager.isRunning,
      }),
    );
    expect(manager.currentWave).toBe(0);
    expect(manager.enemiesLeft).toBe(0);
    expect(manager.isRunning).toBe(false);
    manager.start();
    expect(seen).toEqual([{ event: { wave: 1, totalWaves: 1 }, wave: 1, left: 3, running: true }]);
  });

  it("emits waveCleared only after every spawned enemy is killed or leaked", () => {
    const { manager, events, spawn } = setup();
    const cleared: number[] = [];
    events.on("waveCleared", ({ wave }) => {
      expect(manager.enemiesLeft).toBe(0);
      expect(manager.isRunning).toBe(false);
      cleared.push(wave);
    });
    manager.start();
    const [first] = spawn(0);
    events.emit("enemyKilled", { enemyId: first.id, reward: 5 });
    expect(manager.enemiesLeft).toBe(2);
    expect(cleared).toEqual([]); // no live enemies, but two are still scheduled
    const [second, third] = spawn(0.2);
    events.emit("enemyLeaked", { enemyId: second.id });
    expect(manager.enemiesLeft).toBe(1);
    expect(cleared).toEqual([]);
    events.emit("enemyKilled", { enemyId: third.id, reward: 5 });
    events.emit("enemyLeaked", { enemyId: third.id });
    expect(manager.enemiesLeft).toBe(0);
    expect(cleared).toEqual([1]);
  });

  it("does not start a new wave while one is running", () => {
    const { manager, events, spawn } = setup([
      { groups: [group("basic", 2, 1)] },
      { groups: [group("fast", 1, 1)] },
    ]);
    const started: number[] = [];
    events.on("waveStarted", ({ wave }) => started.push(wave));
    manager.start();
    spawn(0.5);
    manager.start();
    expect(manager.currentWave).toBe(1);
    expect(manager.enemiesLeft).toBe(2);
    expect(spawn(0.5)).toHaveLength(1); // repeated start did not reset elapsed time
    manager.start(); // all spawned, still active
    expect(started).toEqual([1]);
  });

  it("advances after clearing, resets timing, and stops after the final wave", () => {
    const { manager, events, spawn } = setup([
      { groups: [group("basic", 1, 1)] },
      { groups: [group("fast", 2, 0.5)] },
    ]);
    const started: number[] = [];
    const cleared: number[] = [];
    events.on("waveStarted", ({ wave }) => started.push(wave));
    events.on("waveCleared", ({ wave }) => cleared.push(wave));
    manager.start();
    const [first] = spawn(50);
    events.emit("enemyKilled", { enemyId: first.id, reward: 5 });
    const [second] = spawn(10);
    expect(manager.currentWave).toBe(2);
    expect(manager.enemiesLeft).toBe(2);
    expect(spawn(0)).toEqual([]);
    expect(second.defId).toBe("fast");
    events.emit("enemyLeaked", { enemyId: first.id }); // prior wave
    expect(manager.enemiesLeft).toBe(2);
    expect(spawn(0.49)).toEqual([]);
    const [third] = spawn(0.01);
    events.emit("enemyLeaked", { enemyId: second.id });
    events.emit("enemyLeaked", { enemyId: third.id });
    manager.start();
    expect(manager.isRunning).toBe(false);
    expect(manager.currentWave).toBe(2);
    expect(started).toEqual([1, 2]);
    expect(cleared).toEqual([1, 2]);
    expect(spawn(100)).toEqual([]);
  });

  it("ignores unknown, duplicate, and inactive enemy events without negative counts", () => {
    const { manager, events, spawn } = setup();
    events.emit("enemySpawned", { enemyId: 100 });
    events.emit("enemyKilled", { enemyId: 100, reward: 5 });
    expect(manager.enemiesLeft).toBe(0);
    manager.start();
    events.emit("enemyLeaked", { enemyId: 100 });
    events.emit("enemySpawned", { enemyId: 100 }); // no spawn requested yet
    expect(manager.enemiesLeft).toBe(3);
    const [first] = spawn(0);
    events.emit("enemySpawned", { enemyId: first.id });
    events.emit("enemyKilled", { enemyId: first.id, reward: 5 });
    events.emit("enemyLeaked", { enemyId: first.id });
    events.emit("enemyKilled", { enemyId: 100, reward: 5 });
    expect(manager.enemiesLeft).toBe(2);
    const pending = manager.tick(0.2);
    expect(pending).toHaveLength(2);
    events.emit("enemySpawned", { enemyId: first.id }); // removed IDs cannot register again
    events.emit("enemyKilled", { enemyId: first.id, reward: 5 });
    expect(manager.enemiesLeft).toBe(2);
    for (const id of [2, 3]) {
      events.emit("enemySpawned", { enemyId: id });
      events.emit("enemyLeaked", { enemyId: id });
    }
    events.emit("enemyLeaked", { enemyId: 3 });
    expect(manager.enemiesLeft).toBe(0);
    expect(manager.isRunning).toBe(false);
  });

  it("waits for returned enemies to be registered and removed before clearing", () => {
    const { manager, events } = setup([{ groups: [group("basic", 1, 1)] }]);
    manager.start();
    expect(manager.tick(0)).toEqual(["basic"]);
    events.emit("enemyLeaked", { enemyId: 1 }); // not registered
    expect(manager.enemiesLeft).toBe(1);
    expect(manager.isRunning).toBe(true);
    events.emit("enemySpawned", { enemyId: 1 });
    events.emit("enemyLeaked", { enemyId: 1 });
    expect(manager.isRunning).toBe(false);
  });

  it("matches large ticks to small fractional ticks without losing boundary spawns", () => {
    const waves = [{ groups: [group("basic", 8, 0.1), group("fast", 3, 0.2)] }];
    const large = setup(waves);
    const small = setup(waves);
    large.manager.start();
    small.manager.start();
    const expected = large.spawn(1.3).map((e) => e.defId);
    const actual = Array.from({ length: 130 }, () => small.spawn(0.01))
      .flat()
      .map((e) => e.defId);
    expect(actual).toEqual(expected);
    expect(actual).toEqual([...Array<string>(8).fill("basic"), ...Array<string>(3).fill("fast")]);
    expect(large.spawn(1)).toEqual([]);
    expect(small.spawn(1)).toEqual([]);
  });

  it("ignores invalid delta times and does not advance time on repeated zero ticks", () => {
    const { manager, spawn } = setup();
    expect(spawn(1)).toEqual([]); // before start
    manager.start();
    for (const dt of [-1, NaN, Infinity]) expect(spawn(dt)).toEqual([]);
    expect(spawn(0)).toHaveLength(1);
    expect(spawn(0)).toEqual([]);
    expect(spawn(0.099)).toEqual([]);
    expect(spawn(0.001)).toHaveLength(1);
  });

  it("handles an empty wave list without emitting events", () => {
    const { manager, events, spawn } = setup([]);
    const seen: string[] = [];
    events.on("waveStarted", () => seen.push("start"));
    events.on("waveCleared", () => seen.push("clear"));
    manager.start();
    expect(manager.totalWaves).toBe(0);
    expect(manager.currentWave).toBe(0);
    expect(manager.enemiesLeft).toBe(0);
    expect(manager.isRunning).toBe(false);
    expect(spawn(1)).toEqual([]);
    expect(seen).toEqual([]);
  });

  it("clears empty waves once and skips empty groups without delaying spawns", () => {
    const { manager, events, spawn } = setup([
      { groups: [] },
      { groups: [group("unused", 0, 100)] },
      {
        groups: [
          group("unused", 0, 100),
          group("basic", 1, 0.5),
          group("unused", 0, 100),
          group("fast", 1, 0.2),
          group("unused", 0, 100),
        ],
      },
    ]);
    const seen: string[] = [];
    events.on("waveStarted", ({ wave }) => seen.push(`start${wave}`));
    events.on("waveCleared", ({ wave }) => seen.push(`clear${wave}`));
    manager.start();
    expect(manager.isRunning).toBe(false);
    manager.tick(10);
    expect(manager.isRunning).toBe(false);
    const initial = spawn(10);
    expect(manager.enemiesLeft).toBe(2);
    const [first] = initial;
    expect(first.defId).toBe("basic");
    const [second] = spawn(0.2);
    expect(second.defId).toBe("fast");
    events.emit("enemyLeaked", { enemyId: first.id });
    events.emit("enemyLeaked", { enemyId: second.id });
    expect(seen).toEqual(["start1", "clear1", "start2", "clear2", "start3", "clear3"]);
  });

  it("spawns finite zero-interval groups together in order", () => {
    const { manager, spawn } = setup([{ groups: [group("basic", 2, 0), group("fast", 1, 0)] }]);
    manager.start();
    expect(spawn(0).map((e) => e.defId)).toEqual(["basic", "basic", "fast"]);
    expect(spawn(0)).toEqual([]);
  });
});

describe("wave preparation and last spawn timing", () => {
  it("waits for all scheduled and living enemies, blocks manual starts, and starts once", () => {
    const { manager, events, spawn } = setup([
      { groups: [group("basic", 2, 2)] },
      { groups: [group("fast", 1, 1)] },
    ]);
    expect(manager.preparationRemaining).toBeNull();
    expect(manager.lastSpawnRemaining).toBeNull();
    spawn(50);
    expect(manager.currentWave).toBe(0);
    manager.start();
    const [first] = spawn(0);
    events.emit("enemyKilled", { enemyId: first.id, reward: 0 });
    expect(manager.preparationRemaining).toBeNull();
    const [last] = spawn(2);
    expect(manager.lastSpawnRemaining).toBeNull();
    expect(manager.preparationRemaining).toBeNull();
    events.emit("enemyLeaked", { enemyId: last.id });
    expect(manager.preparationRemaining).toBe(10);
    expect(manager.currentWave).toBe(1);
    for (const dt of [0, -1, NaN, Infinity]) spawn(dt);
    expect(manager.preparationRemaining).toBe(10);
    spawn(3);
    expect(manager.preparationRemaining).toBe(7);
    const started: number[] = [];
    events.on("waveStarted", ({ wave }) => started.push(wave));
    const [next] = spawn(7);
    expect(started).toEqual([2]);
    expect(manager.preparationRemaining).toBeNull();
    manager.start();
    spawn(100);
    expect(started).toEqual([2]);
    events.emit("enemyLeaked", { enemyId: next.id });
    expect(manager.preparationRemaining).toBeNull();
    expect(spawn(100)).toEqual([]);
  });

  it("carries leftover countdown time into the actual spawn schedule consistently", () => {
    const waves = [{ groups: [] }, { groups: [group("basic", 3, 0.5)] }];
    const large = setup(waves);
    const small = setup(waves);
    large.manager.start();
    small.manager.start();
    const expected = large.spawn(10.75).map((e) => e.defId);
    const actual = Array.from({ length: 43 }, () => small.spawn(0.25))
      .flat()
      .map((e) => e.defId);
    expect(actual).toEqual(expected);
    expect(expected).toHaveLength(2);
    expect(small.manager.lastSpawnRemaining).toBeCloseTo(0.25);
    expect(large.manager.lastSpawnRemaining).toBeCloseTo(0.25);
  });

  it("derives the last spawn from mixed intervals, ignoring empty groups", () => {
    const { manager, spawn } = setup([
      {
        groups: [
          group("empty", 0, 99),
          group("basic", 2, 0.5),
          group("empty", 0, 99),
          group("fast", 2, 0.25),
          group("instant", 2, 0),
        ],
      },
    ]);
    manager.start();
    expect(manager.lastSpawnRemaining).toBe(1);
    spawn(0);
    expect(manager.lastSpawnRemaining).toBe(1);
    spawn(0.6);
    expect(manager.lastSpawnRemaining).toBeCloseTo(0.4);
    expect(spawn(0.4).map((e) => e.defId)).toEqual(["fast", "fast", "instant", "instant"]);
    expect(manager.lastSpawnRemaining).toBeNull();
  });

  it("handles empty and zero interval waves without invalid timer values", () => {
    const { manager, spawn } = setup([{ groups: [group("basic", 2, 0)] }]);
    manager.start();
    expect(manager.lastSpawnRemaining).toBe(0);
    expect(spawn(0)).toHaveLength(2);
    expect(manager.lastSpawnRemaining).toBeNull();
  });
});

it("manually skips preparation, resets timing, and ignores repeated or active starts", () => {
  const { manager, events, spawn } = setup([
    { groups: [group("basic", 1, 1)] },
    { groups: [group("fast", 2, 2)] },
  ]);
  const started: number[] = [];
  events.on("waveStarted", ({ wave }) => started.push(wave));
  manager.start();
  const [first] = spawn(0);
  events.emit("enemyKilled", { enemyId: first.id, reward: 0 });
  spawn(3);
  expect(manager.preparationRemaining).toBe(7);
  manager.start();
  manager.start();
  expect(started).toEqual([1, 2]);
  expect(manager.preparationRemaining).toBeNull();
  expect(manager.lastSpawnRemaining).toBe(2);
  const [second] = spawn(0);
  manager.start();
  expect(spawn(1)).toEqual([]);
  const [third] = spawn(1);
  manager.start();
  expect(started).toEqual([1, 2]);
  events.emit("enemyLeaked", { enemyId: second.id });
  events.emit("enemyLeaked", { enemyId: third.id });
  manager.start();
  expect(manager.preparationRemaining).toBeNull();
  expect(started).toEqual([1, 2]);
});
