const MAX_PARENT_SEARCH = 500;

function findApi(start) {
  let current = start;
  let attempts = 0;
  try {
    while (current && !current.API && current.parent && current.parent !== current && attempts < MAX_PARENT_SEARCH) {
      current = current.parent;
      attempts += 1;
    }
    if (current?.API) return current.API;
  } catch {
    return null;
  }
  return null;
}

function discoverApi() {
  const parentApi = findApi(window);
  if (parentApi) return parentApi;
  try {
    if (window.opener && !window.opener.closed) return findApi(window.opener);
  } catch {
    return null;
  }
  return null;
}

function timeInterval(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(4, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export class Scorm12 {
  constructor() {
    this.api = discoverApi();
    this.connected = false;
    this.startedAt = Date.now();
    this.finished = false;
    this.requiredErrors = [];
    this.interactions = new Map();
  }

  initialize() {
    if (!this.api) return { mode: "preview", ok: true, message: "Preview mode: LMS tracking is unavailable." };
    try {
      this.connected = String(this.api.LMSInitialize("")) === "true";
      if (!this.connected) {
        return { mode: "error", ok: false, message: `SCORM initialization failed: ${this.lastError()}` };
      }
      const status = this.get("cmi.core.lesson_status");
      if (!status || status === "not attempted") this.requiredSet("cmi.core.lesson_status", "incomplete");
      return { mode: "lms", ok: this.requiredErrors.length === 0, message: this.requiredErrors.join("; ") };
    } catch (error) {
      return { mode: "error", ok: false, message: `SCORM initialization failed: ${error.message}` };
    }
  }

  lastError() {
    if (!this.api) return "LMS API not found";
    try {
      const code = String(this.api.LMSGetLastError());
      return code === "0" ? "unknown LMS error" : `${code}: ${this.api.LMSGetErrorString(code)}`;
    } catch {
      return "unable to read LMS error";
    }
  }

  get(name) {
    if (!this.connected) return "";
    try {
      return String(this.api.LMSGetValue(name) ?? "");
    } catch {
      return "";
    }
  }

  set(name, value) {
    if (!this.connected) return false;
    try {
      return String(this.api.LMSSetValue(name, String(value))) === "true";
    } catch {
      return false;
    }
  }

  requiredSet(name, value) {
    const ok = this.set(name, value);
    if (!ok) this.requiredErrors.push(`Unable to write ${name}: ${this.lastError()}`);
    return ok;
  }

  commit() {
    if (!this.connected) return true;
    try {
      return String(this.api.LMSCommit("")) === "true";
    } catch {
      return false;
    }
  }

  loadSuspendData() {
    return this.get("cmi.suspend_data");
  }

  saveSuspendData(value) {
    if (value.length > 4096) {
      this.requiredErrors.push(`suspend_data exceeds 4096 characters (${value.length})`);
      return false;
    }
    const ok = this.requiredSet("cmi.suspend_data", value);
    if (ok) {
      this.requiredSet("cmi.core.exit", "suspend");
      this.commit();
    }
    return ok;
  }

  recordInteraction(question, type, response, correctPattern, correct) {
    if (!this.connected) return;
    let index = this.interactions.get(question.id);
    if (index === undefined) {
      const count = Number.parseInt(this.get("cmi.interactions._count"), 10);
      index = Number.isFinite(count) ? count : this.interactions.size;
      this.interactions.set(question.id, index);
    }
    const base = `cmi.interactions.${index}`;
    this.set(`${base}.id`, question.id);
    this.set(`${base}.type`, type);
    this.set(`${base}.student_response`, response);
    this.set(`${base}.correct_responses.0.pattern`, correctPattern);
    this.set(`${base}.result`, correct ? "correct" : "wrong");
    this.set(`${base}.time`, new Date().toISOString().slice(11, 19));
    this.commit();
  }

  complete(score, passed) {
    this.requiredSet("cmi.core.score.min", "0");
    this.requiredSet("cmi.core.score.max", "100");
    this.requiredSet("cmi.core.score.raw", String(Math.max(0, Math.min(100, score))));
    this.requiredSet("cmi.core.lesson_status", passed ? "passed" : "failed");
    this.requiredSet("cmi.core.exit", "");
    this.set("cmi.suspend_data", "");
    this.commit();
  }

  finish({ suspended = false } = {}) {
    if (!this.connected || this.finished) return true;
    this.set("cmi.core.session_time", timeInterval(Date.now() - this.startedAt));
    if (suspended) this.set("cmi.core.exit", "suspend");
    this.commit();
    try {
      const ok = String(this.api.LMSFinish("")) === "true";
      this.finished = true;
      this.connected = false;
      return ok;
    } catch {
      return false;
    }
  }
}
