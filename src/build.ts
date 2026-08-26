import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Course, ExportReport, Quiz, QuizzesContainer, ResultsPageConfig } from "./types.js";
import { DEFAULT_RESULTS_PAGE } from "./types.js";
import { readJsonFile } from "./util.js";
import { validateCourse, extractPrimaryQuiz } from "./validate.js";

export function normalizeResultsPage(input?: unknown): { config: ResultsPageConfig; legacyConverted: boolean } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  let legacyConverted = false;
  let mode = typeof raw.message_mode === "string" ? raw.message_mode : DEFAULT_RESULTS_PAGE.message_mode;
  if (mode === "score_based") {
    mode = "pass_fail";
    legacyConverted = true;
  }
  if (mode !== "completion" && mode !== "pass_fail" && mode !== "none") {
    mode = DEFAULT_RESULTS_PAGE.message_mode;
  }

  const config: ResultsPageConfig = {
    show: typeof raw.show === "boolean" ? raw.show : DEFAULT_RESULTS_PAGE.show,
    show_grade: typeof raw.show_grade === "boolean" ? raw.show_grade : DEFAULT_RESULTS_PAGE.show_grade,
    message_mode: mode as "completion" | "pass_fail" | "none",
    completion_message: typeof raw.completion_message === "string" ? raw.completion_message : DEFAULT_RESULTS_PAGE.completion_message,
    success_message: typeof raw.success_message === "string" ? raw.success_message : DEFAULT_RESULTS_PAGE.success_message,
    failure_message: typeof raw.failure_message === "string" ? raw.failure_message : DEFAULT_RESULTS_PAGE.failure_message,
    show_result_icon: typeof raw.show_result_icon === "boolean" ? raw.show_result_icon : DEFAULT_RESULTS_PAGE.show_result_icon,
    show_review_button: typeof raw.show_review_button === "boolean" ? raw.show_review_button : DEFAULT_RESULTS_PAGE.show_review_button
  };

  return { config, legacyConverted };
}

export function normalizeQuizzesPayload(input: unknown): QuizzesContainer {
  let quizzes: Quiz[] = [];
  if (input && typeof input === "object") {
    const anyObj = input as Record<string, unknown>;
    if (Array.isArray(anyObj.quizzes)) {
      quizzes = anyObj.quizzes as Quiz[];
    } else if (Array.isArray(anyObj.questions)) {
      quizzes = [input as unknown as Quiz];
    }
  }

  const normalizedQuizzes = quizzes.map((quiz) => {
    const { config } = normalizeResultsPage(quiz.results_page);
    return {
      ...quiz,
      results_page: config
    };
  });

  return { quizzes: normalizedQuizzes };
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
