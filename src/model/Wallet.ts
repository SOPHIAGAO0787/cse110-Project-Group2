import type { EventBus } from "../core/EventBus";

// The player's coins.
// TODO(St1): listen for "enemyKilled" and add its reward; implement canAfford/spend/add;
// emit "coinsChanged" with the new total whenever coins change. Coins never go below 0.
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

  add(amount: number): void {
    // TODO(St1)
  }
}
