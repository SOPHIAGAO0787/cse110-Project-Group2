import type { EventBus } from "../core/EventBus";

// How many enemies can still reach the base before the player loses.
// TODO(N2): listen for "enemyLeaked" and lose one life; never go below 0;
// emit "livesChanged" with the new total.
export class Lives {
  remaining: number;
  private events: EventBus;

  constructor(startingLives: number, events: EventBus) {
    this.events = events;
    this.remaining = startingLives;
  }

  lose(): void {
    // TODO(N2)
  }
}
