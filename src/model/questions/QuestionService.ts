import { GENERAL_QUESTIONS, QUESTION_POOLS, isTemplate } from "../loadContent";
import { defaultConfig } from "../towerConfig";
import { towerVariables } from "./TowerQuestionsHandling";
import type { Question, QuestionTemplate, TowerConfig, TowerDef } from "../types";

// How often a question comes from the general geometry group instead of the tower's own
const GENERAL_SHARE = 0.3;

// How many recent questions to skip, so the same one doesn't come back right away
const RECENT_COUNT = 5;

// A question plus a title for the popup, naming the pool it came from
export type PickedQuestion = Question & { title: string };

function fill(text: string, vars: Record<string, number>): string {
  return text.replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name]));
}

// Turns a template into a question using this tower's numbers.
// Returns null if the tower doesn't provide a number the template needs,
// or if the answer formula can't be worked out.
function build(t: QuestionTemplate, vars: Record<string, number>): Question | null {
  const needed = [...(t.template + t.hint).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (needed.some((name) => vars[name] === undefined)) return null;

  // Names in the formula become their numbers; "pi" and "sqrt" stay for the parser
  const formula = t.answer.replace(/[A-Za-z_]+/g, (w) =>
    vars[w] !== undefined ? `(${vars[w]})` : w,
  );
  const answer = parseAnswer(formula);
  if (answer === null) return null;

  const tolerance =
    t.tolerance ?? (t.relativeTolerance !== undefined ? Math.abs(answer) * t.relativeTolerance : 0);
  return { id: t.id, prompt: fill(t.template, vars), answer, tolerance, hint: fill(t.hint, vars) };
}

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
  private recent: string[] = []; // ids of the last few questions asked, newest last

  // Adds this id to the recent list, dropping the oldest once there are more than RECENT_COUNT
  private remember(id: string): void {
    this.recent.push(id);
    if (this.recent.length > RECENT_COUNT) this.recent.shift();
  }

  questionFor(tower: TowerDef, config: TowerConfig = defaultConfig(tower)): PickedQuestion {
    const vars = towerVariables(tower, config);
    const own: Question[] = [];
    for (const entry of QUESTION_POOLS[tower.id] ?? []) {
      if (!isTemplate(entry)) {
        own.push(entry);
        continue;
      }
      const built = build(entry, vars);
      if (built) own.push(built);
    }

    const general = GENERAL_QUESTIONS;
    if (own.length === 0 && general.length === 0) {
      throw new Error("questions.json has no questions");
    }
    const useGeneral = own.length === 0 || (general.length > 0 && Math.random() < GENERAL_SHARE);
    const pool = useGeneral ? general : own;
    // Skip the last few questions while the pool has others to choose from
    const fresh = pool.filter((q) => !this.recent.includes(q.id));
    const choices = fresh.length > 0 ? fresh : pool;
    const question = choices[Math.floor(Math.random() * choices.length)];
    this.remember(question.id);
    // A copy, so the title isn't written onto the shared GENERAL_QUESTIONS objects
    return { ...question, title: `${useGeneral ? "General Geometry" : tower.name} Question` };
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
