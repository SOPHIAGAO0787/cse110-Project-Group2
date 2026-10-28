import { QUESTIONS } from "../loadContent";
import type { Question, TowerDef } from "../types";

// Picks geometry questions and checks answers.
// TODO(M1): questionFor() builds a question from the tower's real numbers
// (e.g. radius 2.5 -> "What is the diameter?"); check() parses the typed answer and
// accepts it within the question's tolerance. Bad input (empty, "abc") counts as wrong.
export class QuestionService {
  questionFor(tower: TowerDef): Question {
    return QUESTIONS[0]; // TODO(M1)
  }

  check(question: Question, input: string): boolean {
    return false; // TODO(M1)
  }
}
