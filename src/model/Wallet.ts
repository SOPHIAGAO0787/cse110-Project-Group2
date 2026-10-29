import type { EventBus } from "../core/EventBus";

// The player's coins.
// TODO(St1): listen for "enemyKilled" and add its reward; implement canAfford/spend.
// Coins never go below 0.
export class Wallet {
  coins: number;
  private events: EventBus;

  constructor(startingCoins: number, events: EventBus) {
    this.events = events;
    this.coins = startingCoins;
  }

  canAfford(cost: number): boolean {
    return false; // TODO(St1)
  }

  // Returns true and removes the coins if affordable, otherwise returns false and changes nothing.
  spend(cost: number): boolean {
    return false; // TODO(St1)
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
