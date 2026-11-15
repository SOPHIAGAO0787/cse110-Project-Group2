import { QUESTIONS } from "../loadContent";
import type { Question, TowerDef } from "../types";

// Splits typed text into tokens, or returns null if it contains anything unknown.
function tokenize(input: string): string[] | null {
  const text = input.toLowerCase().replace(/sqrt/g, "√").replace(/pi/g, "π");
  const raw = text.match(/\s+|\d+\.?\d*|\.\d+|[π√^*+\-/()]/g);
  if (raw === null || raw.join("") !== text) return null; // an unknown character was found
  return raw.filter((t) => t.trim() !== "");
}

// Evaluates: numbers, π, √, ^, + - * /, parentheses, and implicit multiplication (2π, 3(4+1)).
// Returns null for anything invalid.
function evaluate(tokens: string[]): number | null {
  let pos = 0;
  const startsFactor = (t?: string) => t === "π" || t === "√" || t === "(";

  function expr(): number | null {
    let left = term();
    if (left === null) return null;
    while (tokens[pos] === "+" || tokens[pos] === "-") {
      const op = tokens[pos++];
      const right = term();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function term(): number | null {
    let left = unary();
    if (left === null) return null;
    for (;;) {
      const t = tokens[pos];
      if (t === "*" || t === "/") {
        pos++;
        const right = unary();
        if (right === null) return null;
        if (t === "/") {
          if (right === 0) return null; // division by zero
          left /= right;
        } else {
          left *= right;
        }
      } else if (startsFactor(t)) {
        // implicit multiplication, but never between two plain numbers ("5.5.5", "1 2")
        const right = unary();
        if (right === null) return null;
        left *= right;
      } else {
        return left;
      }
    }
  }

  // At most one leading minus, so "--5" is rejected
  function unary(): number | null {
    if (tokens[pos] === "-") {
      pos++;
      const value = power();
      return value === null ? null : -value;
    }
    return power();
  }

  function power(): number | null {
    const base = atom();
    if (base === null) return null;
    if (tokens[pos] !== "^") return base;
    pos++;
    const exponent = unary();
    if (exponent === null) return null;
    const result = Math.pow(base, exponent);
    return Number.isFinite(result) ? result : null;
  }

  function atom(): number | null {
    const t = tokens[pos];
    if (t === undefined) return null;
    if (/^[\d.]/.test(t)) {
      pos++;
      return Number(t);
    }
    if (t === "π") {
      pos++;
      return Math.PI;
    }
    if (t === "(") {
      pos++;
      const value = expr();
      if (value === null || tokens[pos] !== ")") return null;
      pos++;
      return value;
    }
    if (t === "√") {
      pos++;
      const operand = atom();
      return operand === null || operand < 0 ? null : Math.sqrt(operand);
    }
    return null;
  }

  const value = expr();
  if (value === null || pos !== tokens.length) return null; // leftover tokens = invalid
  return Number.isFinite(value) ? value : null;
}

// Turns "5", "3/4", "2π", "√2/2" into a number. Returns null for anything else.
function parseAnswer(input: string): number | null {
  const tokens = tokenize(input);
  return tokens === null ? null : evaluate(tokens);
}

// Picks a random geometry question and checks answers.
export class QuestionService {
  questionFor(tower: TowerDef): Question {
    // tower details will be used in questions in the future
    if (QUESTIONS.length === 0) {
      throw new Error("questions.json has no questions");
    }
    const index = Math.floor(Math.random() * QUESTIONS.length);
    return QUESTIONS[index];
  }

  // Accepts parsed answers, within the question's tolerance.
  // Bad input (empty, "abc", "3/0") counts as wrong.
  check(question: Question, input: string): boolean {
    const value = parseAnswer(input);
    if (value === null) return false;

    // tiny epsilon so floating point noise (e.g. 0.1 + 0.2) doesn't reject a good answer
    return Math.abs(value - question.answer) <= question.tolerance + 1e-9;
  }
}
