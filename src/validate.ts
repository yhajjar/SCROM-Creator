import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import * as formatsModule from "ajv-formats";
import { courseSchema } from "./schema.js";
import type { Course, Quiz, QuizQuestion, ValidationIssue, ValidationResult } from "./types.js";
import { lzwCompressLength } from "./util.js";

const ajv = new Ajv2020({ allErrors: true, strict: false, useDefaults: true });
const addFormats = formatsModule.default as unknown as (instance: Ajv2020) => void;
addFormats(ajv);
const validateSchema = ajv.compile(courseSchema);

function issue(path: string, message: string): ValidationIssue {
  return { path: path || "/", message };
}

function schemaIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => issue(error.instancePath, error.message ?? error.keyword));
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function extractPrimaryQuiz(input: unknown): Quiz | null {
  if (!input || typeof input !== "object") return null;
  const anyObj = input as Record<string, unknown>;
  if (Array.isArray(anyObj.quizzes) && anyObj.quizzes.length > 0) {
    return anyObj.quizzes[0] as Quiz;
  }
  if (Array.isArray(anyObj.questions)) {
    return anyObj as unknown as Quiz;
  }
  return null;
}

export function estimateSuspendData(quiz: Quiz): number {
  const answers: Record<string, unknown> = {};
  for (const q of quiz.questions || []) {
    if (q.type === "multiple_choice") {
      const c = q.items.find((i) => i.correct);
      answers[q.id] = c ? c.order ?? c.text : 1;
    } else if (q.type === "multiple_response") {
      answers[q.id] = q.items.filter((i) => i.correct).map((i) => i.order ?? i.text);
    } else if (q.type === "sequence") {
      answers[q.id] = q.items.map((i) => i.order ?? i.text);
    } else if (q.type === "matching") {
      answers[q.id] = q.items.map((i) => [i.text, i.target]);
    } else if (q.type === "word_bank") {
      const blanks = [...q.body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
      answers[q.id] = blanks;
    } else if (q.type === "categorization") {
      answers[q.id] = (q.items || []).map((i) => [i.text, i.category]);
    } else if (q.type === "true_false") {
      answers[q.id] = q.correct_answer;
    }
  }

  const state = {
    id: quiz.id,
    q: (quiz.questions || []).map((q) => q.id),
    a: answers,
    f: false
  };
  const json = JSON.stringify(state);
  return Math.min(2 + Buffer.byteLength(json, "utf8") * 2, lzwCompressLength(json));
}

export function validateCourse(input: unknown): ValidationResult {
  const validShape = validateSchema(input);
  const errors = schemaIssues(validateSchema.errors);
  const warnings: ValidationIssue[] = [];

  const quiz = extractPrimaryQuiz(input);
  if (!quiz) {
    errors.push(issue("/", "Input must be a quiz or quizzes container with a valid questions array"));
    return { valid: false, errors, warnings, suspendDataEstimate: 0 };
  }

  // Validate question uniqueness
  const qIds = (quiz.questions || []).map((q) => q.id).filter(Boolean);
  for (const id of duplicates(qIds)) {
    errors.push(issue("/questions", `duplicate question id "${id}"`));
  }

  (quiz.questions || []).forEach((question: QuizQuestion, qIdx: number) => {
    const basePath = `/questions/${qIdx}`;
    if (question.type === "multiple_choice") {
      const correctCount = (question.items || []).filter((i) => i.correct).length;
      if (correctCount !== 1) {
        errors.push(issue(`${basePath}/items`, "multiple_choice requires exactly one item marked correct: true"));
      }
    } else if (question.type === "multiple_response") {
      const correctCount = (question.items || []).filter((i) => i.correct).length;
      if (correctCount < 1) {
        errors.push(issue(`${basePath}/items`, "multiple_response requires at least one item marked correct: true"));
      }
    } else if (question.type === "sequence") {
      if (!question.items || question.items.length < 2) {
        errors.push(issue(`${basePath}/items`, "sequence requires at least 2 sequence items"));
      }
    } else if (question.type === "matching") {
      if (!question.items || question.items.length < 2) {
        errors.push(issue(`${basePath}/items`, "matching requires at least 2 matching items"));
      } else {
        question.items.forEach((item, itemIdx) => {
          if (!item.text || !item.target) {
            errors.push(issue(`${basePath}/items/${itemIdx}`, "matching item requires non-empty 'text' and 'target'"));
          }
        });
      }
    } else if (question.type === "word_bank") {
      if (!question.body || !question.body.includes("{{")) {
        errors.push(issue(`${basePath}/body`, "word_bank body must contain at least one '{{answer}}' blank token"));
      }
    } else if (question.type === "true_false") {
      if (typeof question.correct_answer !== "boolean") {
        errors.push(issue(`${basePath}/correct_answer`, "true_false requires boolean correct_answer (true or false)"));
      }
    }
  });

  if (quiz.results_page && (quiz.results_page as any).message_mode === "score_based") {
    warnings.push(issue("/results_page/message_mode", "Legacy 'score_based' message_mode detected and converted to 'pass_fail'."));
  }

  const suspendDataEstimate = estimateSuspendData(quiz);
  if (suspendDataEstimate > 4096) {
    errors.push(issue("/questions", `estimated suspend_data is ${suspendDataEstimate} characters; SCORM limit is 4096`));
  } else if (suspendDataEstimate > 3500) {
    warnings.push(issue("/questions", `estimated suspend_data is close to limit (${suspendDataEstimate}/4096)`));
  }

  return { valid: errors.length === 0, errors, warnings, suspendDataEstimate };
}
