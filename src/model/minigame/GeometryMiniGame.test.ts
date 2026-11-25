import { describe, expect, it } from "vitest";
import type { Question } from "../types";
import {
  generateGeometryQuestions,
  GeometryMiniGame,
  QUESTION_SECONDS,
  QUESTIONS_PER_ROUND,
} from "./GeometryMiniGame";

// A small seeded random number generator, so the test gets the same numbers every run
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function idsOf(questions: Question[]): string[] {
  const ids: string[] = [];
  for (const question of questions) {
    ids.push(question.id);
  }
  return ids;
}

describe("GeometryMiniGame", () => {
  it("generates a round of questions with correct geometry answers for every template", () => {
    const seen: string[] = [];
    // A constant random gives every dimension the same size, and each value shuffles differently
    for (let step = 0; step < 10; step++) {
      const random = () => step / 10;
      const size = 2 + Math.floor(random() * 9);
      const expected: Record<string, number> = {
        "circle-area": Math.PI * size ** 2,
        "circle-circumference": 2 * Math.PI * size,
        "radius-diameter": size,
        "rectangle-area": size ** 2,
        "rectangle-perimeter": 4 * size,
        "triangle-area": size ** 2 / 2,
        "square-diagonal": size * Math.SQRT2,
        angles: 180 - size * 10,
      };
      const questions = generateGeometryQuestions(random);
      expect(questions).toHaveLength(QUESTIONS_PER_ROUND);
      for (const question of questions) {
        expect(question.answer).toBe(expected[question.id]);
        expect(question.prompt.length).toBeGreaterThan(20);
        if (!seen.includes(question.id)) {
          seen.push(question.id);
        }
      }
    }
    expect(seen).toHaveLength(8);
    expect(generateGeometryQuestions(() => 0)).not.toEqual(generateGeometryQuestions(() => 0.5));
  });

  it("asks a different mix of templates each round, without repeats in a round", () => {
    const game = new GeometryMiniGame(seededRandom(42));
    const firstRound = idsOf(game.questions);
    const seen: string[] = [];
    let changed = false;
    for (let round = 0; round < 10; round++) {
      game.restart();
      const ids = idsOf(game.questions);
      for (const id of ids) {
        // Each template is asked at most once per round
        expect(ids.indexOf(id)).toBe(ids.lastIndexOf(id));
        if (!seen.includes(id)) {
          seen.push(id);
        }
      }
      if (ids.join() !== firstRound.join()) {
        changed = true;
      }
    }
    expect(seen).toHaveLength(8);
    expect(changed).toBe(true);
  });

  it("uses the shared checker for expressions and accepts only one answer", () => {
    const game = new GeometryMiniGame(() => 0);
    game.submit("4*pi");
    expect(game.feedback).toBe("correct");
    expect(game.correctAnswers).toBe(1);
    game.submit("4*pi");
    expect(game.correctAnswers).toBe(1);
    game.nextQuestion();
    game.submit("wrong");
    game.submit("2");
    expect(game.feedback).toBe("incorrect");
    expect(game.correctAnswers).toBe(1);
  });

  it("accepts rounded circle answers and fractions", () => {
    const game = new GeometryMiniGame(() => 0);
    game.submit("12.57");
    expect(game.feedback).toBe("correct");
    game.nextQuestion();
    game.submit("4/2");
    expect(game.correctAnswers).toBe(2);
  });

  it("decreases simulated time, rejects invalid steps, and times out once at zero", () => {
    const game = new GeometryMiniGame();
    game.nextQuestion();
    expect(game.questionIndex).toBe(0);
    for (const dt of [0, -1, NaN, Infinity]) game.tick(dt);
    expect(game.remainingSeconds).toBe(QUESTION_SECONDS);
    game.tick(3);
    expect(game.remainingSeconds).toBe(22);
    game.tick(100);
    expect(game.remainingSeconds).toBe(0);
    expect(game.feedback).toBe("timeout");
    game.submit(String(game.currentQuestion.answer));
    game.tick(1);
    expect(game.correctAnswers).toBe(0);
    expect(game.remainingSeconds).toBe(0);
    game.nextQuestion();
    expect(game.remainingSeconds).toBe(QUESTION_SECONDS);
    expect(game.feedback).toBeNull();
  });

  it("matches small steps to a single step at the timeout boundary", () => {
    const large = new GeometryMiniGame();
    const small = new GeometryMiniGame();
    large.tick(25);
    for (let i = 0; i < 250; i++) small.tick(0.1);
    expect(small.remainingSeconds).toBe(large.remainingSeconds);
    expect(small.phase).toBe(large.phase);
  });

  it("finishes after five questions and freezes the result", () => {
    const game = new GeometryMiniGame();
    for (let i = 0; i < 5; i++) {
      expect(game.questionIndex).toBe(i);
      if (i % 2 === 0) game.submit(String(game.currentQuestion.answer));
      else game.tick(25);
      const time = game.remainingSeconds;
      game.tick(5);
      expect(game.remainingSeconds).toBe(time);
      game.nextQuestion();
    }
    expect(game.phase).toBe("finished");
    expect(game.result).toEqual({ correctAnswers: 3, totalQuestions: 5 });
    game.submit("0");
    game.nextQuestion();
    game.tick(25);
    expect(game.result.correctAnswers).toBe(3);
  });

  it("restarting resets score, question, feedback, and timer with new questions", () => {
    let value = 0;
    const game = new GeometryMiniGame(() => value);
    const oldQuestions = game.questions;
    game.submit("4*pi");
    game.nextQuestion();
    game.tick(10);
    value = 0.5;
    game.restart();
    expect(game.phase).toBe("answering");
    expect(game.questionIndex).toBe(0);
    expect(game.correctAnswers).toBe(0);
    expect(game.remainingSeconds).toBe(25);
    expect(game.feedback).toBeNull();
    expect(game.questions).not.toEqual(oldQuestions);
  });
});
