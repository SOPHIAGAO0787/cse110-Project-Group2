import type { GameEvents } from "../model/types";

type EventName = keyof GameEvents; // "enemyKilled" | "coinsChanged" | ...

// Lets parts of the game announce what happened without knowing who is listening.
//
//   events.on("enemyKilled", (e) => console.log(e.reward));    // listen
//   events.emit("enemyKilled", { enemyId: 1, reward: 5 });     // announce
//
// The event names and payloads come from GameEvents in model/types.ts,
// so a misspelled event name or a missing field is a compile error.
export class EventBus {
  // Event name → the functions to call when that event is emitted
  private listeners: { [name: string]: Function[] } = {};

  // Start listening for an event.
  on<N extends EventName>(name: N, listener: (payload: GameEvents[N]) => void): void {
    if (!this.listeners[name]) {
      this.listeners[name] = [];
    }
    this.listeners[name].push(listener);
  }

  // Tell every listener of this event what happened.
  emit<N extends EventName>(name: N, payload: GameEvents[N]): void {
    const listeners = this.listeners[name];
    if (!listeners) {
      return; // nobody is listening
    }
    for (const listener of listeners) {
      listener(payload);
    }
  }

  // Remove all listeners (used when leaving the game screen).
  clear(): void {
    this.listeners = {};
  }
}
