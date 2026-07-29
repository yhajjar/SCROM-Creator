import { promises as fs } from "node:fs";
import path from "node:path";
import type { Course, ValidationIssue } from "./types.js";
import { hashBuffer, isWithin } from "./util.js";

const signatures: Array<{ extension: string; mime: string; matches: (data: Buffer) => boolean }> = [
  { extension: ".png", mime: "image/png", matches: (data) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { extension: ".jpg", mime: "image/jpeg", matches: (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  { extension: ".gif", mime: "image/gif", matches: (data) => data.subarray(0, 6).toString("ascii") === "GIF87a" || data.subarray(0, 6).toString("ascii") === "GIF89a" },
  { extension: ".webp", mime: "image/webp", matches: (data) => data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP" }
];

export interface ProcessedAssets {
  course: Course;
  files: string[];
  errors: ValidationIssue[];
}

export async function processAssets(course: Course, courseDirectory: string, stageDirectory: string): Promise<ProcessedAssets> {
  const output = structuredClone(course);
  const files: string[] = [];
  const errors: ValidationIssue[] = [];
  const copied = new Map<string, string>();
  const realBase = await fs.realpath(courseDirectory);

  async function copyAsset(reference: string, jsonPath: string): Promise<string> {
    const candidate = path.resolve(courseDirectory, reference);
    if (!isWithin(courseDirectory, candidate)) {
      errors.push({ path: jsonPath, message: "asset path escapes the course directory" });
      return reference;
    }
    let realCandidate: string;
    try {
      realCandidate = await fs.realpath(candidate);
    } catch {
      errors.push({ path: jsonPath, message: `asset does not exist: ${reference}` });
      return reference;
    }
    if (!isWithin(realBase, realCandidate)) {
      errors.push({ path: jsonPath, message: "asset symlink resolves outside the course directory" });
      return reference;
    }
    if (copied.has(realCandidate)) return copied.get(realCandidate)!;
    const data = await fs.readFile(realCandidate);
    if (data.length > 15 * 1024 * 1024) {
      errors.push({ path: jsonPath, message: "image exceeds the 15 MiB limit" });
      return reference;
    }
    const signature = signatures.find((entry) => entry.matches(data));
    if (!signature) {
      errors.push({ path: jsonPath, message: "unsupported or invalid image; allowed formats are PNG, JPEG, GIF, and WebP" });
      return reference;
    }
    const outputReference = `assets/${hashBuffer(data).slice(0, 24)}${signature.extension}`;
    await fs.mkdir(path.join(stageDirectory, "assets"), { recursive: true });
    await fs.writeFile(path.join(stageDirectory, ...outputReference.split("/")), data);
    copied.set(realCandidate, outputReference);
    files.push(outputReference);
    return outputReference;
  }

  if (output.theme?.logo) output.theme.logo = await copyAsset(output.theme.logo, "/theme/logo");
  for (let index = 0; index < output.questions.length; index += 1) {
    const question = output.questions[index];
    if (question.image) question.image = await copyAsset(question.image, `/questions/${index}/image`);
  }
  return { course: output, files, errors };
}
