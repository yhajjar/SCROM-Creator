import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Course, Question } from "../src/types.js";
import { readJsonFile } from "../src/util.js";

const scoring = await import(pathToFileURL(path.join(process.cwd(), "player", "scoring.js")).href) as {
  correctAnswer(question: Question): unknown;
  evaluateQuestion(question: Question, answer: unknown): boolean;
  scoreCourse(course: Course, answers: Record<string, unknown>): { percentage: number; passed: boolean };
};

test("all six interaction types evaluate their canonical answers", async () => {
  const course = await readJsonFile<Course>(path.join(process.cwd(), "content", "course.json"));
  for (const question of course.questions) {
    const answer = scoring.correctAnswer(question);
    if (question.type === "wordBank") {
      const normalized = Object.fromEntries(
        Object.entries(answer as Record<string, string[]>).map(([key, values]) => [key, values[0]])
      );
      assert.equal(scoring.evaluateQuestion(question, normalized), true, question.type);
    } else {
      assert.equal(scoring.evaluateQuestion(question, answer), true, question.type);
    }
  }
});

test("80 percent passes and 79 percent fails", () => {
  const prototype = {
    id: "q0",
    type: "multipleChoice",
    prompt: "Prompt",
    points: 1,
    choices: [
      { id: "yes", text: "Yes", correct: true },
      { id: "no", text: "No", correct: false }
    ]
  } satisfies Question;
  const questions = Array.from({ length: 100 }, (_, index) => ({ ...prototype, id: `q${index}` })) as Question[];
  const course = {
    schemaVersion: "1.0",
    id: "f5208436-d19e-4ceb-97d9-691e8ad9920c",
    title: "Boundary",
    passingScore: 80,
    questions
  } satisfies Course;
  const eighty = Object.fromEntries(questions.map((question, index) => [question.id, index < 80 ? "yes" : "no"]));
  const seventyNine = Object.fromEntries(questions.map((question, index) => [question.id, index < 79 ? "yes" : "no"]));
  assert.deepEqual(scoring.scoreCourse(course, eighty), { awarded: 80, maximum: 100, percentage: 80, passed: true });
  assert.deepEqual(scoring.scoreCourse(course, seventyNine), { awarded: 79, maximum: 100, percentage: 79, passed: false });
});
