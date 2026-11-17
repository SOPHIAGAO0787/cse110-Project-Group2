import { QuestionService } from "../questions/QuestionService";
import type { Question } from "../types";

export const QUESTION_SECONDS = 25;
export interface GeometryMiniGameResult {
  correctAnswers: number;
  totalQuestions: number;
}

// Each round practices all five topics, with new dimensions on restart.
export function generateGeometryQuestions(random = Math.random): Question[] {
  const dimension = () => 2 + Math.floor(random() * 9);
  const radius = dimension();
  const diameter = dimension() * 2;
  const width = dimension();
  const height = dimension();
  const base = dimension();
  const triangleHeight = dimension();
  const angle = dimension() * 10;
  return [
    {
      id: "circle-area",
      prompt: `What is the area of a circle with radius ${radius}? Use pi or round to 2 decimal places.`,
      answer: Math.PI * radius ** 2,
      tolerance: 0.01,
      hint: "Area = pi × radius².",
    },
    {
      id: "radius-diameter",
      prompt: `A circle has diameter ${diameter}. What is its radius?`,
      answer: diameter / 2,
      tolerance: 0,
      hint: "Radius = diameter / 2.",
    },
    {
      id: "rectangle-area",
      prompt: `What is the area of a rectangle with width ${width} and height ${height}?`,
      answer: width * height,
      tolerance: 0,
      hint: "Area = width × height.",
    },
    {
      id: "triangle-area",
      prompt: `What is the area of a triangle with base ${base} and perpendicular height ${triangleHeight}?`,
      answer: (base * triangleHeight) / 2,
      tolerance: 0,
      hint: "Area = base × height / 2.",
    },
    {
      id: "angles",
      prompt: `Two angles form a straight line. One is ${angle} degrees. How many degrees is the other?`,
      answer: 180 - angle,
      tolerance: 0,
      hint: "Angles on a straight line add to 180 degrees.",
    },
  ];
}

export class GeometryMiniGame {
  questions: Question[] = [];
  questionIndex = 0;
  remainingSeconds = QUESTION_SECONDS;
  correctAnswers = 0;
  phase: "answering" | "feedback" | "finished" = "answering";
  feedback: "correct" | "incorrect" | "timeout" | null = null;
  private service = new QuestionService();

  constructor(private random = Math.random) {
    this.restart();
  }

  get currentQuestion(): Question {
    return this.questions[this.questionIndex];
  }

  get isFinished(): boolean {
    return this.phase === "finished";
  }

  get result(): GeometryMiniGameResult {
    return { correctAnswers: this.correctAnswers, totalQuestions: this.questions.length };
  }

  submit(input: string): void {
    if (this.phase !== "answering") return;
    const correct = this.service.check(this.currentQuestion, input);
    if (correct) this.correctAnswers++;
    this.feedback = correct ? "correct" : "incorrect";
    this.phase = "feedback";
  }

  tick(dt: number): void {
    if (this.phase !== "answering" || !Number.isFinite(dt) || dt <= 0) return;
    this.remainingSeconds = Math.max(0, this.remainingSeconds - dt);
    if (this.remainingSeconds <= Number.EPSILON * QUESTION_SECONDS * 8) {
      this.remainingSeconds = 0;
      this.feedback = "timeout";
      this.phase = "feedback";
    }
  }

  nextQuestion(): void {
    if (this.phase !== "feedback") return;
    if (this.questionIndex === this.questions.length - 1) {
      this.phase = "finished";
      return;
    }
    this.questionIndex++;
    this.remainingSeconds = QUESTION_SECONDS;
    this.feedback = null;
    this.phase = "answering";
  }

  restart(): void {
    this.questions = generateGeometryQuestions(this.random);
    this.questionIndex = 0;
    this.remainingSeconds = QUESTION_SECONDS;
    this.correctAnswers = 0;
    this.feedback = null;
    this.phase = "answering";
  }
}
