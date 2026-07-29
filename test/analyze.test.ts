import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { analyzePackage } from "../src/analyze.js";

test("unpacked iSpring package is classified as possible but fragile", async () => {
  const report = await analyzePackage(path.join(process.cwd(), "ScROM Template"));
  assert.equal(report.classification, "possible-but-fragile");
  assert.equal(report.standard, "SCORM 1.2");
  assert.equal(report.launchFile, "res/index.html");
  assert.equal(report.manifest.missingFiles.length, 0);
  assert.equal(report.signals.itemMatchesContentId, true);
  assert.ok(report.doNotTouch.some((name) => name.endsWith("player.js")));
});

test("iSpring .quiz is detected as readable authoring source", async () => {
  const report = await analyzePackage(path.join(process.cwd(), "Digial Skill demo.quiz"));
  assert.equal(report.inputType, "ispring-quiz");
  assert.equal(report.classification, "authoring-source-readable");
  assert.ok(report.editableContent.includes("document.json"));
});
