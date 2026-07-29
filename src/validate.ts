import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import * as formatsModule from "ajv-formats";
import { courseSchema } from "./schema.js";
import type { Course, Question, ValidationIssue, ValidationResult } from "./types.js";
import { lzwCompressLength } from "./util.js";

const ajv = new Ajv2020({ allErrors: true, strict: false, useDefaults: true });
const addFormats = formatsModule.default as unknown as (instance: Ajv2020) => void;
addFormats(ajv);
const validateSchema = ajv.compile<Course>(courseSchema);

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

function expectedAnswer(question: Question): unknown {
  switch (question.type) {
    case "multipleChoice":
      return question.choices.find((choice) => choice.correct)?.id ?? "";
    case "multipleResponse":
      return question.choices.filter((choice) => choice.correct).map((choice) => choice.id);
    case "sequence":
      return question.items.map((item) => item.id);
    case "matching":
      return Object.fromEntries(question.pairs.map((pair) => [pair.id, pair.id]));
    case "categorization":
      return Object.fromEntries(question.items.map((item) => [item.id, item.categoryId]));
    case "wordBank":
      return Object.fromEntries(question.blanks.map((blank) => [blank.id, blank.answers[0]]));
  }
}

export function estimateSuspendData(course: Course): number {
  const answers = Object.fromEntries(course.questions.map((question) => [question.id, expectedAnswer(question)]));
  const state = { i: course.questions.length - 1, a: answers, s: course.questions.map((question) => question.id), f: false };
  const json = JSON.stringify(state);
  return Math.min(2 + Buffer.byteLength(json, "utf8") * 2, lzwCompressLength(json));
}

export function validateCourse(input: unknown): ValidationResult {
  const validShape = validateSchema(input);
  const errors = schemaIssues(validateSchema.errors);
  const warnings: ValidationIssue[] = [];
  if (!validShape) return { valid: false, errors, warnings, suspendDataEstimate: 0 };

  const course = input as Course;
  for (const id of duplicates(course.questions.map((question) => question.id))) {
    errors.push(issue("/questions", `duplicate question id "${id}"`));
  }

  course.questions.forEach((question, questionIndex) => {
    const basePath = `/questions/${questionIndex}`;
    const nestedIds: string[] = [];
    if (question.type === "multipleChoice" || question.type === "multipleResponse") {
      nestedIds.push(...question.choices.map((choice) => choice.id));
      const correctCount = question.choices.filter((choice) => choice.correct).length;
      if (question.type === "multipleChoice" && correctCount !== 1) {
        errors.push(issue(`${basePath}/choices`, "multipleChoice requires exactly one correct choice"));
      }
      if (question.type === "multipleResponse" && (correctCount < 1 || correctCount === question.choices.length)) {
        errors.push(issue(`${basePath}/choices`, "multipleResponse requires at least one correct and one incorrect choice"));
      }
    } else if (question.type === "sequence") {
      nestedIds.push(...question.items.map((item) => item.id));
    } else if (question.type === "matching") {
      nestedIds.push(...question.pairs.map((pair) => pair.id));
    } else if (question.type === "categorization") {
      nestedIds.push(...question.categories.map((category) => category.id), ...question.items.map((item) => item.id));
      const categoryIds = new Set(question.categories.map((category) => category.id));
      question.items.forEach((item, itemIndex) => {
        if (!categoryIds.has(item.categoryId)) {
          errors.push(issue(`${basePath}/items/${itemIndex}/categoryId`, `unknown category "${item.categoryId}"`));
        }
      });
    } else if (question.type === "wordBank") {
      nestedIds.push(...question.blanks.map((blank) => blank.id));
      const blankIds = new Set(question.blanks.map((blank) => blank.id));
      const referenced = question.segments
        .filter((segment): segment is { blankId: string } => "blankId" in segment)
        .map((segment) => segment.blankId);
      for (const blankId of referenced) {
        if (!blankIds.has(blankId)) errors.push(issue(`${basePath}/segments`, `unknown blank "${blankId}"`));
      }
      for (const blankId of blankIds) {
        if (referenced.filter((value) => value === blankId).length !== 1) {
          errors.push(issue(`${basePath}/segments`, `blank "${blankId}" must be referenced exactly once`));
        }
      }
    }
    for (const id of duplicates(nestedIds)) {
      errors.push(issue(basePath, `duplicate nested id "${id}"`));
    }
  });

  const suspendDataEstimate = estimateSuspendData(course);
  if (suspendDataEstimate > 4096) {
    errors.push(issue("/questions", `estimated suspend_data is ${suspendDataEstimate} characters; SCORM 1.2 limit is 4096`));
  } else if (suspendDataEstimate > 3500) {
    warnings.push(issue("/questions", `estimated suspend_data is close to the SCORM 1.2 limit (${suspendDataEstimate}/4096)`));
  }

  return { valid: errors.length === 0, errors, warnings, suspendDataEstimate };
}
