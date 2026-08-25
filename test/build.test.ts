import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { exportCourse } from "../src/build.js";
import { validateCourse, extractPrimaryQuiz } from "../src/validate.js";
import type { QuizzesContainer } from "../src/types.js";

test("exportCourse exports valid assessment JSON and generates checksum", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "course-json-test-"));
  try {
    const fixturePath = path.join(process.cwd(), "fixtures", "field-awareness.json");
    const output = path.join(temporary, "exported-course.json");
    const report = await exportCourse(fixturePath, output);
    assert.equal(report.ok, true, JSON.stringify(report.errors));
    assert.ok(report.sha256);
    assert.ok(report.questionCount > 0);

    const exported = JSON.parse(await fs.readFile(output, "utf8")) as QuizzesContainer;
    const quiz = extractPrimaryQuiz(exported);
    assert.ok(quiz);
    assert.equal(quiz.title, "الوعي الميداني واتخاذ القرار تحت الضغط");
    assert.equal(quiz.questions.length, report.questionCount);

    const reportData = JSON.parse(await fs.readFile(`${output}.report.json`, "utf8"));
    assert.equal(reportData.ok, true);
    assert.equal(reportData.sha256, report.sha256);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("validation detects invalid schemas and passes valid courses", async () => {
  const source = JSON.parse(await fs.readFile(path.join(process.cwd(), "fixtures", "field-awareness.json"), "utf8")) as QuizzesContainer;
  const validResult = validateCourse(source);
  assert.equal(validResult.valid, true, JSON.stringify(validResult.errors));

  // Invalidate by removing items
  const invalid = { quizzes: [{ ...source.quizzes[0], questions: [{ id: "q_bad", type: "multiple_choice", prompt: "Test", items: [] }] }] };
  const invalidResult = validateCourse(invalid);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.length > 0);
});
