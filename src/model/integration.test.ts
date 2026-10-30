import { describe, it } from "vitest";

// These tests run a real game on map1 with no screen, to check that the parts work together.
// Each one needs two tasks. Whichever of the two merges second turns its test on.
describe("Integration: a game on map1", () => {
  it.todo("starting wave 1 spawns its enemies on the path (R1, N1)");
  it.todo("an enemy that reaches the base costs one life (R2, N2)");
  it.todo("killing an enemy adds its reward to the coins (R2, St1)");
  it.todo("placing a tower spends its cost, and with too few coins nothing is placed (B1, St1)");
  it.todo("a tower next to the path kills a passing enemy (B1, R3)");
  it.todo(
    "a full round ends in victory with towers placed and defeat with none, and final coins = start - spent + rewards (St3)",
  );
});
