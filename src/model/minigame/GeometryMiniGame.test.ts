import { describe, expect, it } from "vitest";
import { generateGeometryQuestions, GeometryMiniGame, QUESTION_SECONDS } from "./GeometryMiniGame";

describe("GeometryMiniGame", () => {
  it("generates exactly five valid topics with correct geometry answers", () => {
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const questions = generateGeometryQuestions(random);
      const size = 2 + Math.floor(random() * 9);
      expect(questions.map((question) => question.id)).toEqual([
        "circle-area",
        "radius-diameter",
        "rectangle-area",
        "triangle-area",
        "angles",
      ]);
      expect(questions.map((question) => question.answer)).toEqual([
        Math.PI * size ** 2,
        size,
        size ** 2,
        size ** 2 / 2,
        180 - size * 10,
      ]);
      for (const question of questions) expect(question.prompt.length).toBeGreaterThan(20);
    }
    expect(generateGeometryQuestions(() => 0)).not.toEqual(generateGeometryQuestions(() => 0.5));
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

  it("accepts rounded circle areas and fractions", () => {
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
