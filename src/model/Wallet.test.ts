import { describe, expect, it } from "vitest";
import { EventBus } from "../core/EventBus";
import { Wallet } from "./Wallet";

describe("Wallet (St1)", () => {
  it("starts with startingCoins", () => {
    const wallet = new Wallet(100, new EventBus());
    expect(wallet.coins).toBe(100);
  });

  it("add() raises coins by the amount", () => {
    const wallet = new Wallet(100, new EventBus());
    wallet.add(5);
    expect(wallet.coins).toBe(105);
  });

  it("add() emits coinsChanged once with the new total", () => {
    const events = new EventBus();
    const wallet = new Wallet(100, events);
    const totals: number[] = [];
    events.on("coinsChanged", (e) => totals.push(e.coins));

    wallet.add(5);

    expect(totals).toEqual([105]);
  });

  it("add() with 0 or less changes nothing and emits nothing", () => {
    const events = new EventBus();
    const wallet = new Wallet(100, events);
    const totals: number[] = [];
    events.on("coinsChanged", (e) => totals.push(e.coins));

    wallet.add(0);
    wallet.add(-5);

    expect(wallet.coins).toBe(100);
    expect(totals).toEqual([]);
  });

  it.todo("adds the reward when enemyKilled is emitted");
  it.todo("spend() with enough coins returns true and lowers coins");
  it.todo("spend() with too few coins returns false and leaves coins unchanged");
});
