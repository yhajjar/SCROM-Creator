import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readJsonFile } from "../src/util.js";
import { validateCourse } from "../src/validate.js";
import type { Course } from "../src/types.js";

const root = process.cwd();

test("example course validates with all six interaction types", async () => {
  const course = await readJsonFile<Course>(path.join(root, "content", "course.json"));
  const result = validateCourse(course);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(
    course.questions.map((question) => question.type),
    ["multipleChoice", "sequence", "matching", "multipleResponse", "categorization", "wordBank"]
  );
  assert.ok(result.suspendDataEstimate > 0 && result.suspendDataEstimate < 4096);
});

test("Arabic RTL fixture validates", async () => {
  const course = await readJsonFile<Course>(path.join(root, "fixtures", "arabic-course.json"));
  const result = validateCourse(course);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(course.direction, "rtl");
});

test("semantic validation rejects unsafe answer definitions", async () => {
  const course = await readJsonFile<Course>(path.join(root, "content", "course.json"));
  const broken = structuredClone(course);
  const question = broken.questions[0];
  assert.equal(question.type, "multipleChoice");
  if (question.type !== "multipleChoice") throw new Error("Unexpected fixture");
  question.choices[0].correct = true;
  question.choices[1].id = question.choices[0].id;
  const result = validateCourse(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.message.includes("exactly one correct")));
  assert.ok(result.errors.some((entry) => entry.message.includes("duplicate nested id")));
});

test("schema rejects traversal and unknown question types", async () => {
  const course = await readJsonFile<Course>(path.join(root, "content", "course.json"));
  const broken = structuredClone(course) as unknown as Record<string, unknown>;
  const questions = broken.questions as Array<Record<string, unknown>>;
  questions[0].image = "../secret.png";
  questions[1].type = "unsupported";
  const result = validateCourse(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});
