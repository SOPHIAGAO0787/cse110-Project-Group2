import { QUESTIONS } from "../loadContent";
import type { Question, TowerDef } from "../types";

// True for plain numbers like "5", "-2.5", ".5". False for "1e1", "0x10", "abc", "-", ".".
function isPlainNumber(text: string): boolean {
  // Remove one leading minus sign, if there is one
  const unsigned = text.startsWith("-") ? text.slice(1) : text;

  // Split on the dot: "2.5" -> ["2", "5"], "5" -> ["5"], "5.5.5" -> ["5", "5", "5"]
  const pieces = unsigned.split(".");
  if (pieces.length > 2) return false; // more than one dot

  // Every piece must be made only of digits (an empty piece is okay: ".5" or "5.")
  const onlyDigits = pieces.every((piece) => /^\d*$/.test(piece));
  if (!onlyDigits) return false;

  // There must be at least one digit somewhere ("-" and "." are not numbers)
  return unsigned.replace(".", "").length > 0;
}

// Turns "5", "-2.5", or "3/4" into a number. Returns null for anything else.
function parseAnswer(input: string): number | null {
  const text = input.trim();
  if (text === "") return null;

  const parts = text.split("/");
  if (parts.length > 2) return null; // "1/2/3"

  if (!parts.every((p) => isPlainNumber(p.trim()))) return null;

  const numerator = Number(parts[0]);
  if (parts.length === 1) return numerator;

  const denominator = Number(parts[1]);
  if (denominator === 0) return null; // "3/0"
  return numerator / denominator;
}

// Picks geometry questions and checks answers.
// TODO(M1): questionFor() builds a question from the tower's real numbers
// (e.g. radius 2.5 -> "What is the diameter?"); For now it picks one at random
export class QuestionService {
  questionFor(tower: TowerDef): Question {
    // tower details will be used in questions in the future
    if (QUESTIONS.length === 0) {
      throw new Error("questions.json has no questions");
    }
    const index = Math.floor(Math.random() * QUESTIONS.length);
    return QUESTIONS[index];
  }

  // Accepts decimals and fractions, within the question's tolerance.
  // Bad input (empty, "abc", "3/0") counts as wrong.
  check(question: Question, input: string): boolean {
    const value = parseAnswer(input);
    if (value === null) return false;

    // tiny epsilon so floating point noise (e.g. 0.1 + 0.2) doesn't reject a good answer
    return Math.abs(value - question.answer) <= question.tolerance + 1e-9;
  }
}
