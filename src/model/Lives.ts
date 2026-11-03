import type { EventBus } from "../core/EventBus";

// How many enemies can still reach the base before the player loses.
export class Lives {
  remaining: number;
  private events: EventBus;

  constructor(startingLives: number, events: EventBus) {
    this.events = events;
    this.remaining = startingLives;
    events.on("enemyLeaked", () => this.lose());
  }

  lose(): void {
    if (this.remaining <= 0) return;
    this.remaining--;
    this.events.emit("livesChanged", { lives: this.remaining });
  }
}
