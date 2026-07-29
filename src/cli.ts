#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { analyzePackage } from "./analyze.js";
import { buildCourse } from "./build.js";

function usage(): never {
  process.stderr.write(`Usage:
  scorm analyze <package-or-folder> [--report <report.json>]
  scorm build --course <course.json> --out <course.zip>
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
  if (command === "analyze") {
    const input = args.find((argument) => !argument.startsWith("--") && argument !== option(args, "--report"));
    if (!input) usage();
    const report = await analyzePackage(input);
    const reportPath = option(args, "--report");
    if (reportPath) {
      await fs.mkdir(path.dirname(path.resolve(reportPath)), { recursive: true });
      await fs.writeFile(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.ok ? 0 : 1;
    return;
  }
  if (command === "build") {
    const course = option(args, "--course");
    const output = option(args, "--out");
    if (!course || !output) usage();
    const report = await buildCourse(course, output);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.ok ? 0 : 1;
    return;
  }
  usage();
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exitCode = 1;
});
