import { QUESTIONS } from "../loadContent";
import type { Question, TowerDef } from "../types";

// Picks geometry questions and checks answers.
// TODO(M1): questionFor() builds a question from the tower's real numbers
// (e.g. radius 2.5 -> "What is the diameter?"); check() parses the typed answer and
// accepts it within the question's tolerance. Bad input (empty, "abc") counts as wrong.
export class QuestionService {
  questionFor(tower: TowerDef): Question {
    // tower details will be used in questions in the future
    if (QUESTIONS.length === 0) {
      throw new Error("questions.json has no questions");
    }
    const index = Math.floor(Math.random() * QUESTIONS.length);
    return QUESTIONS[index];
  }

  check(question: Question, input: string): boolean {
    const trimmed = input.trim();
    if (trimmed === "") return false; // Number("") is 0, so guard it explicitly

    const value = Number(trimmed);
    if (!Number.isFinite(value)) return false; // rejects NaN and Infinity

    // tiny epsilon so floating point noise (e.g. 0.1 + 0.2) doesn't reject a good answer
    return Math.abs(value - question.answer) <= question.tolerance + 1e-9;
  }
}
