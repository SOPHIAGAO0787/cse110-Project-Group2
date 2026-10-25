import Konva from "konva";

// Longest step the game will simulate in one frame, in seconds. Without a cap, coming back
// to a background tab would produce one huge step and enemies would teleport.
export const MAX_DT = 0.1;

export function toDt(frameMs: number): number {
  return Math.min(Math.max(frameMs / 1000, 0), MAX_DT);
}

// Calls onTick(dt) once per animation frame, with dt in seconds. All movement and timers
// use dt, so the game runs at the same speed on fast and slow machines.
export class GameLoop {
  private animation: Konva.Animation;

  constructor(onTick: (dt: number) => void) {
    this.animation = new Konva.Animation((frame) => {
      // Konva's type says frame might be missing, so check before using it
      if (frame) {
        onTick(toDt(frame.timeDiff));
      }
    });
  }

  start(): void {
    this.animation.start();
  }

  stop(): void {
    this.animation.stop();
  }
}
