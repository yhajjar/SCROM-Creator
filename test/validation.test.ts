import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readJsonFile } from "../src/util.js";
import { validateCourse, extractPrimaryQuiz } from "../src/validate.js";
import type { QuizzesContainer } from "../src/types.js";

const root = process.cwd();

test("Sample fruit quiz assessment fixture with True/False validates successfully", async () => {
  const container = await readJsonFile<QuizzesContainer>(path.join(root, "fixtures", "sample-fruit-quiz.json"));
  const result = validateCourse(container);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  
  const quiz = extractPrimaryQuiz(container);
  assert.ok(quiz);
  assert.equal(quiz.direction, "ltr");
  assert.equal(quiz.language, "en");
  assert.equal(quiz.passing_score_percent, 80);
  assert.equal(quiz.questions.length, 7);
  
  const tfQ = quiz.questions.find(q => q.type === "true_false");
  assert.ok(tfQ);
  assert.equal(tfQ.correct_answer, false);
  assert.ok(result.suspendDataEstimate > 0 && result.suspendDataEstimate < 4096);
});

test("validation catches multiple_choice without correct item", async () => {
  const container = await readJsonFile<QuizzesContainer>(path.join(root, "fixtures", "sample-fruit-quiz.json"));
  const broken = structuredClone(container);
  const quiz = broken.quizzes[0];
  const q0 = quiz.questions[0];
  if (q0.type === "multiple_choice") {
    q0.items.forEach(i => { i.correct = false; });
  }
  const result = validateCourse(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.message.includes("exactly one item marked correct")));
});

test("validation rejects true_false with missing or non-boolean correct_answer", async () => {
  const container = await readJsonFile<QuizzesContainer>(path.join(root, "fixtures", "sample-fruit-quiz.json"));
  const broken = structuredClone(container);
  // Missing correct_answer
  const qMissing = {
    id: "tf_bad",
    type: "true_false",
    prompt: "Is the sky green?",
    points: 10
  };
  broken.quizzes[0].questions.push(qMissing as any);
  let result = validateCourse(broken);
  assert.equal(result.valid, false);

  // Non-boolean correct_answer
  broken.quizzes[0].questions[broken.quizzes[0].questions.length - 1] = {
    id: "tf_bad_string",
    type: "true_false",
    prompt: "Is the sky green?",
    correct_answer: "false" as any,
    points: 10
  };
  result = validateCourse(broken);
  assert.equal(result.valid, false);
});

test("validation handles show_feedback toggle and question-level feedbacks", async () => {
  const container = await readJsonFile<QuizzesContainer>(path.join(root, "fixtures", "sample-fruit-quiz.json"));
  const custom = structuredClone(container);
  custom.quizzes[0].show_feedback = false;
  custom.quizzes[0].questions[0].correct_feedback = "Correct.";
  custom.quizzes[0].questions[0].incorrect_feedback = "Try again.";
  const result = validateCourse(custom);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

