#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { exportCourse } from "./build.js";
import { validateCourse } from "./validate.js";
import { readJsonFile } from "./util.js";
import type { Course } from "./types.js";

function usage(): never {
  process.stderr.write(`Usage:
  course export --course <course.json> --out <output.json> [--report <report.json>]
  course validate <course.json> [--report <report.json>]
`);
  process.exit(2);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args.shift();

  if (command === "export" || command === "build") {
    const course = option(args, "--course");
    const output = option(args, "--out");
    if (!course || !output) usage();
    const report = await exportCourse(course, output);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.ok ? 0 : 1;
    return;
  }

  if (command === "validate") {
    const input = args.find((arg) => !arg.startsWith("--") && arg !== option(args, "--report"));
    if (!input) usage();
    const course = await readJsonFile<Course>(path.resolve(input));
    const result = validateCourse(course);
    const reportPath = option(args, "--report");
    if (reportPath) {
      await fs.mkdir(path.dirname(path.resolve(reportPath)), { recursive: true });
      await fs.writeFile(path.resolve(reportPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.valid ? 0 : 1;
    return;
  }

  usage();
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exitCode = 1;
});
