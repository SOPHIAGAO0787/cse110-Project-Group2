import { describe, expect, it } from "vitest";
import { EventBus } from "../core/EventBus";
import { Lives } from "./Lives";

describe("Lives (N2)", () => {
  it("starts with startingLives", () => {
    const lives = new Lives(20, new EventBus());
    expect(lives.remaining).toBe(20);
  });

  it("loses one life per enemyLeaked", () => {
    const events = new EventBus();
    const lives = new Lives(3, events);
    for (const enemyId of [1, 2, 3]) {
      events.emit("enemyLeaked", { enemyId });
      expect(lives.remaining).toBe(3 - enemyId);
    }
  });

  it("never goes below 0", () => {
    const lives = new Lives(1, new EventBus());
    lives.lose();
    expect(lives.remaining).toBe(0);
    lives.lose();
    lives.lose();
    expect(lives.remaining).toBe(0);
  });

  it("emits livesChanged with the new total", () => {
    const events = new EventBus();
    const lives = new Lives(2, events);
    const totals: number[] = [];
    events.on("livesChanged", ({ lives: total }) => {
      expect(lives.remaining).toBe(total); // state is updated before notification
      totals.push(total);
    });
    lives.lose();
    events.emit("enemyLeaked", { enemyId: 1 });
    events.emit("enemyLeaked", { enemyId: 2 });
    lives.lose();
    expect(totals).toEqual([1, 0]); // no notifications when already zero
  });

  it("starts at zero and ignores further losses without emitting livesChanged", () => {
    const events = new EventBus();
    const lives = new Lives(0, events);
    const totals: number[] = [];
    events.on("livesChanged", ({ lives }) => totals.push(lives));
    expect(lives.remaining).toBe(0);
    lives.lose();
    events.emit("enemyLeaked", { enemyId: 1 });
    events.emit("enemyLeaked", { enemyId: 2 });
    expect(lives.remaining).toBe(0);
    expect(totals).toEqual([]);
  });

  it("ignores unrelated events", () => {
    const events = new EventBus();
    const lives = new Lives(3, events);
    const totals: number[] = [];
    events.on("livesChanged", ({ lives }) => totals.push(lives));
    events.emit("enemySpawned", { enemyId: 1 });
    events.emit("enemyKilled", { enemyId: 1, reward: 5 });
    events.emit("coinsChanged", { coins: 100 });
    events.emit("waveStarted", { wave: 1, totalWaves: 2 });
    events.emit("waveCleared", { wave: 1 });
    expect(lives.remaining).toBe(3);
    expect(totals).toEqual([]);
  });
});
