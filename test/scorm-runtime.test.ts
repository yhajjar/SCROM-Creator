import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("SCORM runtime initializes, writes score, commits, and finishes", async () => {
  const values = new Map<string, string>([["cmi.core.lesson_status", "not attempted"]]);
  let commits = 0;
  let finishes = 0;
  const api = {
    LMSInitialize: () => "true",
    LMSFinish: () => { finishes += 1; return "true"; },
    LMSGetValue: (name: string) => values.get(name) ?? (name === "cmi.interactions._count" ? "0" : ""),
    LMSSetValue: (name: string, value: string) => { values.set(name, value); return "true"; },
    LMSCommit: () => { commits += 1; return "true"; },
    LMSGetLastError: () => "0",
    LMSGetErrorString: () => ""
  };
  (globalThis as unknown as { window: unknown }).window = { API: api };
  const moduleUrl = `${pathToFileURL(path.join(process.cwd(), "player", "scorm.js")).href}?test=${Date.now()}`;
  const { Scorm12 } = await import(moduleUrl) as { Scorm12: new () => any };
  const runtime = new Scorm12();
  assert.equal(runtime.initialize().ok, true);
  assert.equal(values.get("cmi.core.lesson_status"), "incomplete");
  runtime.recordInteraction({ id: "q1" }, "choice", "a", "a", true);
  runtime.saveSuspendData("j:e30=");
  runtime.complete(80, true);
  assert.equal(values.get("cmi.core.score.raw"), "80");
  assert.equal(values.get("cmi.core.lesson_status"), "passed");
  assert.ok(commits >= 3);
  assert.equal(runtime.finish(), true);
  assert.equal(finishes, 1);
});
