import { correctAnswer, evaluateQuestion, interactionType, responsePattern, scoreCourse } from "./scoring.js";
import { Scorm12 } from "./scorm.js";

const main = document.querySelector("#main");
const trackingStatus = document.querySelector("#tracking-status");
const scorm = new Scorm12();
let course;
let state = { i: 0, a: {}, s: [], f: false };
let draftAnswer;

const translations = {
  en: {
    skip: "Skip to course content",
    resume: "Resume course",
    start: "Start course",
    progress: ({ current, total, completed }) => `Question ${current} of ${total} · ${completed} completed`,
    moveUp: ({ item }) => `Move ${item} up`,
    moveDown: ({ item }) => `Move ${item} down`,
    select: "— Select —",
    blank: ({ id }) => `Blank ${id}`,
    submit: "Submit answer",
    submitted: "Submitted",
    next: "Next question",
    results: "View results",
    required: "Please complete the question before submitting.",
    correct: "Correct.",
    incorrect: "That answer is not correct.",
    passed: "Course passed",
    completed: "Course completed",
    points: ({ awarded, maximum }) => `${awarded} of ${maximum} points`,
    finish: "Finish",
    finished: "Finished",
    fatalTitle: "Course could not start"
  },
  ar: {
    skip: "انتقل إلى محتوى الدورة",
    resume: "متابعة الدورة",
    start: "بدء الدورة",
    progress: ({ current, total, completed }) => `السؤال ${current} من ${total} · تم إكمال ${completed}`,
    moveUp: ({ item }) => `نقل ${item} إلى الأعلى`,
    moveDown: ({ item }) => `نقل ${item} إلى الأسفل`,
    select: "— اختر —",
    blank: ({ id }) => `الفراغ ${id}`,
    submit: "إرسال الإجابة",
    submitted: "تم الإرسال",
    next: "السؤال التالي",
    results: "عرض النتائج",
    required: "يرجى إكمال السؤال قبل إرسال الإجابة.",
    correct: "إجابة صحيحة.",
    incorrect: "الإجابة غير صحيحة.",
    passed: "تم اجتياز الدورة",
    completed: "تم إكمال الدورة",
    points: ({ awarded, maximum }) => `${awarded} من ${maximum} نقطة`,
    finish: "إنهاء",
    finished: "تم",
    fatalTitle: "تعذر بدء الدورة"
  }
};

function translate(key, values = {}) {
  const language = (course?.language ?? "en").toLowerCase().split("-")[0];
  const catalog = translations[language] ?? translations.en;
  const value = catalog[key] ?? translations.en[key] ?? key;
  return typeof value === "function" ? value(values) : value;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shuffled(values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function lzwCompress(value) {
  const bytes = new TextEncoder().encode(value);
  const dictionary = new Map();
  for (let index = 0; index < 256; index += 1) dictionary.set(String.fromCharCode(index), index);
  let nextCode = 256;
  let phrase = "";
  const codes = [];
  for (const byte of bytes) {
    const character = String.fromCharCode(byte);
    const candidate = phrase + character;
    if (dictionary.has(candidate)) {
      phrase = candidate;
    } else {
      codes.push(dictionary.get(phrase));
      if (nextCode < 65535) dictionary.set(candidate, nextCode++);
      phrase = character;
    }
  }
  if (phrase) codes.push(dictionary.get(phrase));
  const output = new Uint8Array(codes.length * 2);
  codes.forEach((code, index) => {
    output[index * 2] = code >> 8;
    output[index * 2 + 1] = code & 255;
  });
  return bytesToBase64(output);
}

function lzwDecompress(value) {
  const bytes = base64ToBytes(value);
  const codes = [];
  for (let index = 0; index < bytes.length; index += 2) codes.push((bytes[index] << 8) | bytes[index + 1]);
  if (codes.length === 0) return "";
  const dictionary = new Map();
  for (let index = 0; index < 256; index += 1) dictionary.set(index, String.fromCharCode(index));
  let nextCode = 256;
  let phrase = dictionary.get(codes[0]);
  let output = phrase;
  for (let index = 1; index < codes.length; index += 1) {
    const code = codes[index];
    const entry = dictionary.get(code) ?? (code === nextCode ? phrase + phrase[0] : "");
    if (!entry) throw new Error("Invalid compressed resume state");
    output += entry;
    if (nextCode < 65535) dictionary.set(nextCode++, phrase + entry[0]);
    phrase = entry;
  }
  return new TextDecoder().decode(Uint8Array.from(output, (character) => character.charCodeAt(0)));
}

function encodeState(value) {
  const json = JSON.stringify(value);
  const raw = `j:${bytesToBase64(new TextEncoder().encode(json))}`;
  const compressed = `z:${lzwCompress(json)}`;
  return compressed.length < raw.length ? compressed : raw;
}

function decodeState(value) {
  if (!value) return null;
  const json = value.startsWith("z:")
    ? lzwDecompress(value.slice(2))
    : new TextDecoder().decode(base64ToBytes(value.startsWith("j:") ? value.slice(2) : value));
  return JSON.parse(json);
}

function showTracking(result) {
  if (result.mode === "lms" && result.ok) return;
  trackingStatus.hidden = false;
  trackingStatus.classList.toggle("error", !result.ok);
  trackingStatus.textContent = result.message;
}

function applyTheme() {
  const theme = course.theme ?? {};
  const values = {
    "--primary": theme.primary,
    "--secondary": theme.secondary,
    "--background": theme.background,
    "--surface": theme.surface,
    "--text": theme.text,
    "font-family": theme.fontFamily
  };
  for (const [property, value] of Object.entries(values)) {
    if (value) document.documentElement.style.setProperty(property, value);
  }
  document.documentElement.lang = course.language ?? "en";
  document.documentElement.dir = course.direction ?? ((course.language ?? "").toLowerCase().startsWith("ar") ? "rtl" : "ltr");
  document.title = course.title;
  document.querySelector(".skip-link").textContent = translate("skip");
}

function courseFrame() {
  const card = element("article", "course-card");
  const header = element("header", "course-header");
  if (course.theme?.logo) {
    const logo = element("img", "logo");
    logo.src = course.theme.logo;
    logo.alt = "";
    header.append(logo);
  }
  header.append(element("h1", "", course.title));
  const content = element("section", "content");
  card.append(header, content);
  main.replaceChildren(card);
  return content;
}

function saveState() {
  const encoded = encodeState(state);
  try {
    localStorage.setItem(`scorm:${course.id}`, encoded);
  } catch {
    // Local storage is only a preview fallback.
  }
  if (scorm.connected) {
    scorm.saveSuspendData(encoded);
    if (scorm.requiredErrors.length) {
      showTracking({ mode: "error", ok: false, message: scorm.requiredErrors.at(-1) });
    }
  }
}

function restoreState() {
  let encoded = scorm.loadSuspendData();
  if (!encoded) {
    try {
      encoded = localStorage.getItem(`scorm:${course.id}`) ?? "";
    } catch {
      encoded = "";
    }
  }
  try {
    const restored = decodeState(encoded);
    if (restored && typeof restored.i === "number" && restored.a && Array.isArray(restored.s)) {
      state = restored;
    }
  } catch {
    showTracking({ mode: "error", ok: false, message: "Saved progress could not be restored; the course started from the beginning." });
  }
}

function renderIntro() {
  const content = courseFrame();
  content.append(element("h2", "", course.title));
  if (course.description) content.append(element("p", "description", course.description));
  if (course.intro) content.append(element("p", "", course.intro));
  const actions = element("div", "actions");
  const start = element("button", "", state.s.length ? translate("resume") : translate("start"));
  start.type = "button";
  start.addEventListener("click", renderQuestion);
  actions.append(start);
  content.append(actions);
}

function progress(content) {
  const completed = state.s.length;
  content.append(element("div", "progress-label", translate("progress", {
    current: state.i + 1,
    total: course.questions.length,
    completed
  })));
  const bar = element("div", "progress");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(course.questions.length));
  bar.setAttribute("aria-valuenow", String(completed));
  const fill = element("span");
  fill.style.width = `${(completed / course.questions.length) * 100}%`;
  bar.append(fill);
  content.append(bar);
}

function renderChoice(question, multiple) {
  const options = element("fieldset", "options");
  options.append(element("legend", "visually-hidden", question.prompt));
  const previous = state.a[question.id];
  question.choices.forEach((choice) => {
    const label = element("label", "option");
    const input = element("input");
    input.type = multiple ? "checkbox" : "radio";
    input.name = question.id;
    input.value = choice.id;
    input.checked = multiple ? (previous ?? []).includes(choice.id) : previous === choice.id;
    label.append(input, element("span", "", choice.text));
    options.append(label);
  });
  return options;
}

function renderSequence(question) {
  const stack = element("div", "stack");
  const previous = state.a[question.id];
  const order = Array.isArray(previous) ? [...previous] : shuffled(question.items.map((item) => item.id));
  draftAnswer = order;
  const itemById = new Map(question.items.map((item) => [item.id, item]));
  function draw() {
    stack.replaceChildren();
    order.forEach((id, index) => {
      const row = element("div", "sequence-row");
      row.append(element("span", "", `${index + 1}. ${itemById.get(id).text}`));
      const controls = element("div", "sequence-controls");
      const up = element("button", "secondary", "↑");
      up.type = "button";
      up.title = translate("moveUp", { item: itemById.get(id).text });
      up.setAttribute("aria-label", up.title);
      up.disabled = index === 0;
      up.addEventListener("click", () => {
        [order[index - 1], order[index]] = [order[index], order[index - 1]];
        draftAnswer = [...order];
        draw();
      });
      const down = element("button", "secondary", "↓");
      down.type = "button";
      down.title = translate("moveDown", { item: itemById.get(id).text });
      down.setAttribute("aria-label", down.title);
      down.disabled = index === order.length - 1;
      down.addEventListener("click", () => {
        [order[index], order[index + 1]] = [order[index + 1], order[index]];
        draftAnswer = [...order];
        draw();
      });
      controls.append(up, down);
      row.append(controls);
      stack.append(row);
    });
  }
  draw();
  return stack;
}

function selectControl(name, options, selected) {
  const select = element("select");
  select.name = name;
  const placeholder = element("option", "", translate("select"));
  placeholder.value = "";
  select.append(placeholder);
  options.forEach(({ id, text }) => {
    const option = element("option", "", text);
    option.value = id;
    option.selected = selected === id;
    select.append(option);
  });
  return select;
}

function renderMapping(question, categorization = false) {
  const stack = element("div", "stack");
  const previous = state.a[question.id] ?? {};
  if (categorization) {
    question.items.forEach((item) => {
      const row = element("label", "mapping-row");
      row.append(element("span", "", item.text), selectControl(item.id, question.categories, previous[item.id]));
      stack.append(row);
    });
  } else {
    const choices = shuffled(question.pairs.map((pair) => ({ id: pair.id, text: pair.right })));
    question.pairs.forEach((pair) => {
      const row = element("label", "mapping-row");
      row.append(element("span", "", pair.left), selectControl(pair.id, choices, previous[pair.id]));
      stack.append(row);
    });
  }
  return stack;
}

function renderWordBank(question) {
  const container = element("div", "word-bank");
  const previous = state.a[question.id] ?? {};
  const words = [...new Set([...question.blanks.flatMap((blank) => blank.answers), ...(question.distractors ?? [])])]
    .map((word) => ({ id: word, text: word }));
  question.segments.forEach((segment) => {
    if ("text" in segment) {
      container.append(document.createTextNode(segment.text));
    } else {
      const select = selectControl(segment.blankId, words, previous[segment.blankId]);
      select.setAttribute("aria-label", translate("blank", { id: segment.blankId }));
      container.append(select);
    }
  });
  return container;
}

function readAnswer(question, content) {
  if (question.type === "multipleChoice") {
    return content.querySelector(`input[name="${CSS.escape(question.id)}"]:checked`)?.value ?? "";
  }
  if (question.type === "multipleResponse") {
    return [...content.querySelectorAll(`input[name="${CSS.escape(question.id)}"]:checked`)].map((input) => input.value);
  }
  if (question.type === "sequence") return [...draftAnswer];
  if (question.type === "matching" || question.type === "categorization" || question.type === "wordBank") {
    return Object.fromEntries([...content.querySelectorAll("select")].map((select) => [select.name, select.value]));
  }
  return null;
}

function isComplete(question, answer) {
  if (question.type === "multipleChoice") return !!answer;
  if (question.type === "multipleResponse" || question.type === "sequence") return answer.length > 0;
  return Object.values(answer ?? {}).every(Boolean) && Object.keys(answer ?? {}).length > 0;
}

function renderQuestion() {
  if (state.f) return renderResults();
  state.i = Math.max(0, Math.min(course.questions.length - 1, state.i));
  draftAnswer = undefined;
  const question = course.questions[state.i];
  const content = courseFrame();
  progress(content);
  const section = element("section");
  section.dir = question.direction ?? "auto";
  section.append(element("h2", "", question.prompt));
  if (question.image) {
    const image = element("img", "question-image");
    image.src = question.image;
    image.alt = "";
    section.append(image);
  }
  if (question.type === "multipleChoice") section.append(renderChoice(question, false));
  if (question.type === "multipleResponse") section.append(renderChoice(question, true));
  if (question.type === "sequence") section.append(renderSequence(question));
  if (question.type === "matching") section.append(renderMapping(question));
  if (question.type === "categorization") section.append(renderMapping(question, true));
  if (question.type === "wordBank") section.append(renderWordBank(question));
  const feedback = element("div");
  feedback.setAttribute("role", "status");
  const actions = element("div", "actions");
  const submit = element("button", "", state.s.includes(question.id) ? translate("submitted") : translate("submit"));
  submit.type = "button";
  submit.disabled = state.s.includes(question.id);
  const next = element("button", "secondary", state.i === course.questions.length - 1 ? translate("results") : translate("next"));
  next.type = "button";
  next.hidden = !state.s.includes(question.id);

  if (state.s.includes(question.id)) {
    const correct = evaluateQuestion(question, state.a[question.id]);
    feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
    feedback.textContent = correct
      ? (question.correctFeedback ?? translate("correct"))
      : (question.incorrectFeedback ?? translate("incorrect"));
  }

  submit.addEventListener("click", () => {
    const answer = readAnswer(question, section);
    if (!isComplete(question, answer)) {
      feedback.className = "feedback incorrect";
      feedback.textContent = translate("required");
      feedback.focus();
      return;
    }
    state.a[question.id] = answer;
    state.s.push(question.id);
    const correct = evaluateQuestion(question, answer);
    feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
    feedback.textContent = correct
      ? (question.correctFeedback ?? translate("correct"))
      : (question.incorrectFeedback ?? translate("incorrect"));
    submit.disabled = true;
    submit.textContent = translate("submitted");
    next.hidden = false;
    scorm.recordInteraction(
      question,
      interactionType(question),
      responsePattern(question, answer),
      responsePattern(question, correctAnswer(question)),
      correct
    );
    saveState();
    feedback.focus();
  });

  next.addEventListener("click", () => {
    if (state.i === course.questions.length - 1) {
      state.f = true;
      saveState();
      renderResults();
    } else {
      state.i += 1;
      saveState();
      renderQuestion();
    }
  });
  actions.append(submit, next);
  section.append(feedback, actions);
  content.append(section);
  section.querySelector("input, select, button")?.focus();
}

function renderResults() {
  const result = scoreCourse(course, state.a);
  const content = courseFrame();
  content.append(
    element("h2", "", result.passed ? translate("passed") : translate("completed")),
    element("div", "score", `${result.percentage}%`),
    element("p", "", translate("points", { awarded: result.awarded, maximum: result.maximum }))
  );
  const message = result.passed ? course.results?.passed : course.results?.failed;
  if (message) content.append(element("p", "", message));
  scorm.complete(result.percentage, result.passed);
  try {
    localStorage.removeItem(`scorm:${course.id}`);
  } catch {
    // Ignore unavailable preview storage.
  }
  const actions = element("div", "actions");
  const finish = element("button", "", translate("finish"));
  finish.type = "button";
  finish.addEventListener("click", () => {
    scorm.finish();
    finish.disabled = true;
    finish.textContent = translate("finished");
  });
  actions.append(finish);
  content.append(actions);
}

function renderFatal(message) {
  const panel = element("section", "error-panel");
  panel.append(element("h1", "", translate("fatalTitle")), element("p", "", message));
  main.replaceChildren(panel);
}

async function start() {
  try {
    const response = await fetch("content/course.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load course data (${response.status})`);
    course = await response.json();
    applyTheme();
    const tracking = scorm.initialize();
    showTracking(tracking);
    if (!tracking.ok) throw new Error(tracking.message);
    restoreState();
    renderIntro();
  } catch (error) {
    renderFatal(error.message);
  }
}

window.addEventListener("pagehide", () => {
  if (!state.f) saveState();
  scorm.finish({ suspended: !state.f });
});

start();
