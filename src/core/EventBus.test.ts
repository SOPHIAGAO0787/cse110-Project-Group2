import { describe, expect, it } from "vitest";
import { EventBus } from "./EventBus";

describe("EventBus", () => {
  it("delivers the payload to a listener", () => {
    const events = new EventBus();
    const rewards: number[] = [];
    events.on("enemyKilled", (e) => rewards.push(e.reward));

    events.emit("enemyKilled", { enemyId: 1, reward: 5 });

    expect(rewards).toEqual([5]);
  });

  it("delivers to every listener of that event, and only that event", () => {
    const events = new EventBus();
    const log: string[] = [];
    events.on("enemyKilled", () => log.push("a"));
    events.on("enemyKilled", () => log.push("b"));
    events.on("enemyLeaked", () => log.push("leaked"));

    events.emit("enemyKilled", { enemyId: 1, reward: 5 });

    expect(log).toEqual(["a", "b"]);
  });

  it("does nothing when an event has no listeners", () => {
    const events = new EventBus();
    expect(() => events.emit("gameOver", { won: true })).not.toThrow();
  });

  it("removes all listeners with clear()", () => {
    const events = new EventBus();
    let calls = 0;
    events.on("coinsChanged", () => calls++);

    events.clear();
    events.emit("coinsChanged", { coins: 10 });

    expect(calls).toBe(0);
  });
});
