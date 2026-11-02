import type { EventBus } from "../core/EventBus";

// The player's coins. Coins never go below 0.
export class Wallet {
  coins: number;
  private events: EventBus;

  constructor(startingCoins: number, events: EventBus) {
    this.events = events;
    this.coins = startingCoins;

    // Killing an enemy earns its reward
    events.on("enemyKilled", (e) => this.add(e.reward));
  }

  // True if the player has at least `cost` coins.
  canAfford(cost: number): boolean {
    return this.coins >= cost;
  }

  // Returns true and removes the coins if affordable, otherwise returns false and changes nothing.
  // A cost of 0 or less is always refused, so a free tower would need this rule changed.
  spend(cost: number): boolean {
    // Spending 0 or less is not a real cost, so it is refused like an unaffordable one
    if (cost <= 0) {
      return false;
    }
    if (!this.canAfford(cost)) {
      return false;
    }
    this.coins = this.coins - cost;
    this.events.emit("coinsChanged", { coins: this.coins });
    return true;
  }

  // Adds coins and tells listeners the new total.
  add(amount: number): void {
    // Adding 0 or less is not a change, so it must not emit "coinsChanged"
    if (amount <= 0) {
      return;
    }
    this.coins = this.coins + amount;
    this.events.emit("coinsChanged", { coins: this.coins });
  }
}
