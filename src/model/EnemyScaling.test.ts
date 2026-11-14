import { describe, expect, it } from "vitest";
import { scaleEnemyDef } from "./EnemyScaling";
import type { EnemyDef } from "./types";

describe("EnemyScaling", () => {
  const basic: EnemyDef = {
    id: "basic",
    name: "Air Molecule",
    hp: 20,
    speed: 1.5,
    reward: 5,
    color: "#7fb3ff",
  };

  it("preserves base stats in wave 1", () => {
    const scaled = scaleEnemyDef(basic, 1);

    expect(scaled).toEqual(basic);
    expect(scaled).not.toBe(basic);
  });

  it("increases health and speed in later waves", () => {
    const scaled = scaleEnemyDef(basic, 3);

    expect(scaled.hp).toBe(26);
    expect(scaled.speed).toBeCloseTo(1.65);
  });

  it("preserves enemy identity and reward", () => {
    const scaled = scaleEnemyDef(basic, 5);

    expect(scaled.id).toBe("basic");
    expect(scaled.name).toBe("Air Molecule");
    expect(scaled.reward).toBe(5);
    expect(scaled.color).toBe("#7fb3ff");
  });

  it("does not modify the original definition", () => {
    scaleEnemyDef(basic, 5);

    expect(basic.hp).toBe(20);
    expect(basic.speed).toBe(1.5);
  });

  it("rejects invalid wave numbers", () => {
    expect(() => scaleEnemyDef(basic, 0)).toThrow();
    expect(() => scaleEnemyDef(basic, -1)).toThrow();
    expect(() => scaleEnemyDef(basic, 1.5)).toThrow();
    expect(() => scaleEnemyDef(basic, NaN)).toThrow();
  });
});
