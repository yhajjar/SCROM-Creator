import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Course, ExportReport, Quiz, QuizzesContainer } from "./types.js";
import { readJsonFile } from "./util.js";
import { validateCourse, extractPrimaryQuiz } from "./validate.js";

export function normalizeQuizzesPayload(input: unknown): QuizzesContainer {
  if (input && typeof input === "object") {
    const anyObj = input as Record<string, unknown>;
    if (Array.isArray(anyObj.quizzes)) {
      return input as QuizzesContainer;
    }
    if (Array.isArray(anyObj.questions)) {
      return { quizzes: [input as unknown as Quiz] };
    }
  }
  return { quizzes: [] };
}

export async function exportCourse(courseInput: string | Course | Quiz | QuizzesContainer, outputPath?: string): Promise<ExportReport> {
  let rawData: unknown;
  let sourcePath: string | undefined;

  if (typeof courseInput === "string") {
    sourcePath = path.resolve(courseInput);
    rawData = await readJsonFile<unknown>(sourcePath);
  } else {
    rawData = courseInput;
  }

  const normalized = normalizeQuizzesPayload(rawData);
  const quiz = extractPrimaryQuiz(normalized) || {
    id: "unknown",
    title: "Untitled Assessment",
    questions: []
  };

  const validation = validateCourse(normalized);
  const totalPoints = (quiz.questions || []).reduce((sum, q) => sum + (q.points ?? 1), 0);
  const questionCount = quiz.questions?.length || 0;

  const report: ExportReport = {
    ok: validation.valid,
    command: "export",
    courseId: quiz.id || "unknown",
    questionCount,
    totalPoints,
    suspendDataEstimate: validation.suspendDataEstimate,
    errors: [...validation.errors],
    warnings: [...validation.warnings]
  };

  if (!validation.valid) {
    if (outputPath) {
      const reportPath = `${outputPath}.report.json`;
      report.report = reportPath;
      await writeReport(reportPath, report);
    }
    return report;
  }

  const jsonString = `${JSON.stringify(normalized, null, 2)}\n`;
  const sha256 = crypto.createHash("sha256").update(jsonString, "utf8").digest("hex");
  report.sha256 = sha256;

  if (outputPath) {
    const absoluteOutputPath = path.resolve(outputPath);
    await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
    await fs.writeFile(absoluteOutputPath, jsonString, "utf8");
    report.output = absoluteOutputPath;

    const reportPath = `${absoluteOutputPath}.report.json`;
    report.report = reportPath;
    await writeReport(reportPath, report);
  }

  return report;
}

export const buildCourse = exportCourse;

async function writeReport(reportPath: string, report: ExportReport): Promise<void> {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
