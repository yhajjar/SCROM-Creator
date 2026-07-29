import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCourse } from "../src/build.js";
import { readZip } from "../src/zip.js";

test("build creates a root-level deterministic SCORM package", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "scorm-test-"));
  try {
    const output = path.join(temporary, "course.zip");
    const report = await buildCourse(path.join(process.cwd(), "content", "course.json"), output);
    assert.equal(report.ok, true, JSON.stringify(report.errors));
    assert.ok(report.sha256);
    const entries = await readZip(output, (name) => ["imsmanifest.xml", "content/course.json", "index.html"].includes(name));
    const names = entries.map((entry) => entry.name);
    assert.ok(names.includes("imsmanifest.xml"));
    assert.ok(names.includes("index.html"));
    assert.ok(names.includes("content/course.json"));
    assert.equal(names.some((name) => name.startsWith("/") || name.includes("../")), false);
    assert.equal(names.some((name) => /(?:player|lms|browsersupport)\.js$/i.test(name)), false);
    const manifest = entries.find((entry) => entry.name === "imsmanifest.xml")?.data?.toString("utf8") ?? "";
    assert.match(manifest, /<schemaversion>1\.2<\/schemaversion>/);
    assert.match(manifest, /href="index\.html"/);
    assert.doesNotMatch(manifest, /res\/data\/player\.js/);

    const secondOutput = path.join(temporary, "course-second.zip");
    const second = await buildCourse(path.join(process.cwd(), "content", "course.json"), secondOutput);
    assert.equal(second.sha256, report.sha256);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("invalid image references fail without producing a package", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "scorm-assets-"));
  try {
    const source = JSON.parse(await fs.readFile(path.join(process.cwd(), "fixtures", "arabic-course.json"), "utf8"));
    source.questions[0].image = "missing.png";
    const coursePath = path.join(temporary, "course.json");
    const output = path.join(temporary, "course.zip");
    await fs.writeFile(coursePath, JSON.stringify(source), "utf8");
    const report = await buildCourse(coursePath, output);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((entry) => entry.message.includes("does not exist")));
    await assert.rejects(fs.stat(output));
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("valid images are copied under content-addressed names", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "scorm-image-"));
  try {
    const source = JSON.parse(await fs.readFile(path.join(process.cwd(), "fixtures", "arabic-course.json"), "utf8"));
    source.questions[0].image = "pixel.png";
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    await fs.writeFile(path.join(temporary, "pixel.png"), png);
    const coursePath = path.join(temporary, "course.json");
    const output = path.join(temporary, "course.zip");
    await fs.writeFile(coursePath, JSON.stringify(source), "utf8");
    const report = await buildCourse(coursePath, output);
    assert.equal(report.ok, true, JSON.stringify(report.errors));
    const entries = await readZip(output, (name) => name.startsWith("assets/") || name === "content/course.json");
    const asset = entries.find((entry) => /^assets\/[0-9a-f]{24}\.png$/.test(entry.name));
    assert.ok(asset);
    const packagedCourse = JSON.parse(
      entries.find((entry) => entry.name === "content/course.json")?.data?.toString("utf8") ?? "{}"
    );
    assert.equal(packagedCourse.questions[0].image, asset.name);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
