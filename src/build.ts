import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildReport, Course } from "./types.js";
import { processAssets } from "./assets.js";
import { createManifest } from "./manifest.js";
import { courseSchema } from "./schema.js";
import { listFiles, readJsonFile, sha256File } from "./util.js";
import { validateCourse } from "./validate.js";
import { createZip } from "./zip.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const playerDirectory = [
  path.resolve(moduleDirectory, "..", "player"),
  path.resolve(moduleDirectory, "..", "..", "player")
].find((candidate) => existsSync(candidate)) ?? path.resolve(moduleDirectory, "..", "player");

export async function buildCourse(coursePath: string, outputPath: string): Promise<BuildReport> {
  const absoluteCoursePath = path.resolve(coursePath);
  const absoluteOutputPath = path.resolve(outputPath);
  const reportPath = `${absoluteOutputPath}.report.json`;
  const course = await readJsonFile<Course>(absoluteCoursePath);
  const validation = validateCourse(course);
  const report: BuildReport = {
    ok: false,
    command: "build",
    courseId: course.id ?? "",
    output: absoluteOutputPath,
    report: reportPath,
    suspendDataEstimate: validation.suspendDataEstimate,
    errors: [...validation.errors],
    warnings: [...validation.warnings]
  };

  if (!validation.valid) {
    await writeReport(reportPath, report);
    return report;
  }

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "scorm-build-"));
  try {
    await fs.cp(playerDirectory, temporaryDirectory, { recursive: true });
    const processed = await processAssets(course, path.dirname(absoluteCoursePath), temporaryDirectory);
    report.errors.push(...processed.errors);
    if (report.errors.length > 0) {
      await writeReport(reportPath, report);
      return report;
    }

    await fs.mkdir(path.join(temporaryDirectory, "content"), { recursive: true });
    await fs.writeFile(
      path.join(temporaryDirectory, "content", "course.json"),
      `${JSON.stringify(processed.course, null, 2)}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(temporaryDirectory, "content", "course.schema.json"),
      `${JSON.stringify(courseSchema, null, 2)}\n`,
      "utf8"
    );
    const filesBeforeManifest = await listFiles(temporaryDirectory);
    const manifest = createManifest(processed.course, filesBeforeManifest);
    await fs.writeFile(path.join(temporaryDirectory, "imsmanifest.xml"), manifest, "utf8");

    report.fileCount = await createZip(temporaryDirectory, absoluteOutputPath);
    report.sha256 = await sha256File(absoluteOutputPath);
    report.ok = true;
    await writeReport(reportPath, report);
    return report;
  } catch (error) {
    report.errors.push({ path: "/", message: (error as Error).message });
    await writeReport(reportPath, report);
    return report;
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function writeReport(reportPath: string, report: BuildReport): Promise<void> {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
