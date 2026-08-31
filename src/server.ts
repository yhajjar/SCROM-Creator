import express from "express";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { exportCourse, normalizeQuizzesPayload } from "./build.js";
import { validateCourse, extractPrimaryQuiz } from "./validate.js";
import { readJsonFile } from "./util.js";
import type { Quiz, QuizzesContainer } from "./types.js";

const projectRoot = process.cwd();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup output and content storage directories
const outputDir = path.join(projectRoot, "output");
const contentDir = path.join(projectRoot, "content");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(contentDir, { recursive: true });

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files
app.use("/content", express.static(path.join(projectRoot, "content")));
app.use("/fixtures", express.static(path.join(projectRoot, "fixtures")));
app.use(express.static(path.join(projectRoot, "public")));

// API: Get question type templates in the snake_case target schema
app.get("/api/templates", (_req, res) => {
  const templates = {
    multiple_choice: {
      type: "multiple_choice",
      name: "Multiple Choice",
      description: "Single correct option question with radial selection",
      template: {
        id: "mc_sample",
        type: "multiple_choice",
        order: 1,
        prompt: "What is the primary role of an operating system kernel?",
        points: 10,
        attempts: 1,
        shuffle: false,
        correct_feedback: "Correct! The kernel controls system hardware and memory.",
        incorrect_feedback: "Incorrect. The kernel manages core hardware and system resources.",
        items: [
          { order: 1, text: "Manage hardware resources and system communication", correct: true },
          { order: 2, text: "Render web pages inside a browser", correct: false },
          { order: 3, text: "Compress audio files into MP3 format", correct: false },
          { order: 4, text: "Filter incoming spam emails", correct: false }
        ]
      }
    },
    multiple_response: {
      type: "multiple_response",
      name: "Multiple Response",
      description: "Multiple correct options (checkboxes)",
      template: {
        id: "mr_sample",
        type: "multiple_response",
        order: 2,
        prompt: "Which of the following are secure web protocols and standards? (Select all that apply)",
        points: 10,
        attempts: 1,
        shuffle: false,
        correct_feedback: "Great job! HTTPS, TLS 1.3, and CSP are key security mechanisms.",
        incorrect_feedback: "Review standard security protocols. Telnet transmits in plaintext.",
        items: [
          { order: 1, text: "HTTPS (HTTP over TLS/SSL)", correct: true },
          { order: 2, text: "TLS 1.3 Encryption", correct: true },
          { order: 3, text: "Unencrypted Telnet (Port 23)", correct: false },
          { order: 4, text: "Content Security Policy (CSP)", correct: true }
        ]
      }
    },
    sequence: {
      type: "sequence",
      name: "Sequence / Order",
      description: "Arranging steps in chronological or logical order",
      template: {
        id: "seq_sample",
        type: "sequence",
        order: 3,
        prompt: "Arrange the web request lifecycle steps in chronological sequence:",
        points: 10,
        attempts: 1,
        shuffle: false,
        correct_feedback: "Perfect! You ordered the request lifecycle accurately.",
        incorrect_feedback: "Check the order from DNS resolution to DOM parsing.",
        items: [
          { order: 1, text: "1. User submits URL in browser" },
          { order: 2, text: "2. DNS lookup resolves IP address" },
          { order: 3, text: "3. TCP & TLS handshake completed" },
          { order: 4, text: "4. Web server returns HTTP response" },
          { order: 5, text: "5. Browser parses DOM & executes scripts" }
        ]
      }
    },
    matching: {
      type: "matching",
      name: "Matching Pairs",
      description: "Match terms with corresponding descriptions/targets",
      template: {
        id: "match_sample",
        type: "matching",
        order: 4,
        prompt: "Match each software role with its core responsibility:",
        points: 10,
        attempts: 1,
        shuffle: false,
        correct_feedback: "Spot on! All responsibilities are properly mapped.",
        incorrect_feedback: "Review the differences between frontend, backend, and DevOps.",
        items: [
          { order: 1, text: "Frontend Engineer", target: "User interface, client styling & layout", target_order: 1 },
          { order: 2, text: "Backend Engineer", target: "API endpoints, databases & business logic", target_order: 2 },
          { order: 3, text: "DevOps Engineer", target: "CI/CD pipelines, container orchestration & cloud hosting", target_order: 3 }
        ]
      }
    },
    word_bank: {
      type: "word_bank",
      name: "Word Bank / Fill Blanks",
      description: "Fill-in-the-blanks text with inline {{answer}} template",
      template: {
        id: "wb_sample",
        type: "word_bank",
        order: 5,
        prompt: "Complete the sentence regarding web security by dragging the correct terms:",
        body: "A digital certificate uses {{public key}} cryptography to authenticate servers and establish encrypted {{TLS}} connections.",
        points: 10,
        attempts: 1,
        shuffle: false,
        correct_feedback: "Spot on! Public key cryptography and TLS protect secure communication.",
        incorrect_feedback: "Review asymmetric key pairs and secure network encryption.",
        distractors: ["symmetric single-key", "FTP", "plaintext"]
      }
    },
    categorization: {
      type: "categorization",
      name: "Categorization",
      description: "Group items into designated categories",
      template: {
        id: "cat_sample",
        type: "categorization",
        order: 6,
        prompt: "Categorize the following technologies into their proper domains:",
        points: 10,
        attempts: 1,
        shuffle: false,
        correct_feedback: "Well done! All technologies are categorized correctly.",
        incorrect_feedback: "Re-examine which tools belong to UI and which belong to databases.",
        categories: [
          { order: 1, title: "Frontend Frameworks" },
          { order: 2, title: "Database Systems" }
        ],
        items: [
          { order: 1, text: "React & Tailwind CSS", category: "Frontend Frameworks" },
          { order: 2, text: "Vue.js & Svelte", category: "Frontend Frameworks" },
          { order: 3, text: "PostgreSQL & SQLite", category: "Database Systems" },
          { order: 4, text: "Redis & MongoDB", category: "Database Systems" }
        ]
      }
    },
    true_false: {
      type: "true_false",
      name: "True / False",
      description: "Binary truth value question with fixed True/False choices and boolean correct_answer",
      template: {
        id: "tf_sample",
        type: "true_false",
        order: 7,
        prompt: "HTTPS encrypts data in transit between the browser and the web server.",
        correct_answer: true,
        points: 10,
        attempts: 1,
        shuffle: false,
        correct_feedback: "Correct! HTTPS encrypts traffic using TLS/SSL protocols.",
        incorrect_feedback: "Incorrect. HTTPS provides end-to-end encryption for web communications."
      }
    }
  };

  res.json({ ok: true, templates });
});

// Helper to inspect quiz JSON on disk
async function loadQuizFile(filePath: string): Promise<{ quiz: Quiz; container: QuizzesContainer } | null> {
  try {
    const data = await readJsonFile<unknown>(filePath);
    const container = normalizeQuizzesPayload(data);
    const quiz = extractPrimaryQuiz(container);
    if (quiz) return { quiz, container };
  } catch {}
  return null;
}

// API: Get available assessments
app.get("/api/courses", async (_req, res) => {
  try {
    const courses: Array<{ id: string; title: string; language?: string; path: string; isCustom?: boolean }> = [];
    const seenIds = new Set<string>();

    // 1. Content files
    const contentFiles = await fs.readdir(path.join(projectRoot, "content")).catch(() => []);
    for (const file of contentFiles) {
      if (file.endsWith(".json") && file !== "course.schema.json") {
        const filePath = path.join(projectRoot, "content", file);
        const result = await loadQuizFile(filePath);
        if (result) {
          const cid = result.quiz.id || file.replace(".json", "").replace(/^custom-/, "");
          if (!seenIds.has(cid)) {
            seenIds.add(cid);
            courses.push({
              id: cid,
              title: result.quiz.title || "Untitled Assessment",
              language: result.quiz.language || "en",
              path: `content/${file}`,
              isCustom: true
            });
          }
        }
      }
    }

    // 2. Fixtures
    const fixtureFiles = await fs.readdir(path.join(projectRoot, "fixtures")).catch(() => []);
    for (const file of fixtureFiles) {
      if (file.endsWith(".json")) {
        const filePath = path.join(projectRoot, "fixtures", file);
        const result = await loadQuizFile(filePath);
        if (result) {
          const cid = result.quiz.id || file.replace(".json", "");
          if (!seenIds.has(cid)) {
            seenIds.add(cid);
            courses.push({
              id: cid,
              title: result.quiz.title || "Untitled Assessment",
              language: result.quiz.language || "ar",
              path: `fixtures/${file}`,
              isCustom: false
            });
          }
        }
      }
    }

    res.json({ ok: true, courses });
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

// API: Get course content by id
app.get("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let foundContainer: QuizzesContainer | null = null;

    // 1. Search in content/ directory
    const contentFiles = await fs.readdir(path.join(projectRoot, "content")).catch(() => []);
    for (const file of contentFiles) {
      if (file.endsWith(".json") && file !== "course.schema.json") {
        const filePath = path.join(projectRoot, "content", file);
        const result = await loadQuizFile(filePath);
        if (result) {
          const cid = result.quiz.id || file.replace(".json", "").replace(/^custom-/, "");
          if (cid === id || result.quiz.id === id || file === `${id}.json` || file === `custom-${id}.json`) {
            foundContainer = result.container;
            break;
          }
        }
      }
    }

    // 2. Search in fixtures/ directory
    if (!foundContainer) {
      const fixtureFiles = await fs.readdir(path.join(projectRoot, "fixtures")).catch(() => []);
      for (const file of fixtureFiles) {
        if (file.endsWith(".json")) {
          const filePath = path.join(projectRoot, "fixtures", file);
          const result = await loadQuizFile(filePath);
          if (result) {
            const cid = result.quiz.id || file.replace(".json", "");
            if (cid === id || result.quiz.id === id || file === `${id}.json` || (id === "field-awareness-decision-pressure-ar" && file === "field-awareness.json")) {
              foundContainer = result.container;
              break;
            }
          }
        }
      }
    }

    if (!foundContainer) {
      return res.status(404).json({ ok: false, error: "Assessment not found" });
    }

    res.json(foundContainer);
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

// API: Save or update course JSON in target schema
app.post("/api/courses", async (req, res) => {
  try {
    const rawPayload = req.body;
    const container = normalizeQuizzesPayload(rawPayload);
    const quiz = extractPrimaryQuiz(container);

    if (!quiz) {
      return res.status(400).json({ ok: false, error: "Missing quiz content" });
    }

    if (!quiz.id) {
      quiz.id = `assessment_${Date.now()}`;
    }

    const validation = validateCourse(container);
    if (!validation.valid) {
      return res.status(400).json({ ok: false, validation });
    }

    const quizId = quiz.id;
    const safeId = quizId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `custom-${safeId}.json`;
    const contentDir = path.join(projectRoot, "content");
    await fs.mkdir(contentDir, { recursive: true });
    const targetPath = path.join(contentDir, filename);

    await fs.writeFile(targetPath, JSON.stringify(container, null, 2), "utf8");

    res.json({ ok: true, id: quizId, filename, validation });
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

// API: Delete assessment
app.delete("/api/courses/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    const cleanId = decodeURIComponent(rawId).trim();

    if (cleanId === "sample-fruit-quiz" || cleanId === "sample-fruit-quiz.json") {
      return res.status(403).json({ ok: false, error: "Default sample assessment template is non-deletable" });
    }

    let deletedCount = 0;

    // 1. Search in content/ directory
    const contentFiles = await fs.readdir(path.join(projectRoot, "content")).catch(() => []);
    for (const file of contentFiles) {
      if (file.endsWith(".json") && file !== "course.schema.json") {
        const filePath = path.join(projectRoot, "content", file);
        let shouldDelete = false;

        if (
          file === `${cleanId}.json` ||
          file === `custom-${cleanId}.json` ||
          file === cleanId ||
          file.includes(cleanId)
        ) {
          shouldDelete = true;
        } else {
          const result = await loadQuizFile(filePath);
          if (result) {
            const cid = result.quiz.id || file.replace(".json", "").replace(/^custom-/, "");
            if (
              cid === cleanId ||
              result.quiz.id === cleanId ||
              (result.quiz.title && result.quiz.title.trim() === cleanId)
            ) {
              shouldDelete = true;
            }
          }
        }

        if (shouldDelete) {
          await fs.rm(filePath, { force: true });
          deletedCount++;
        }
      }
    }

    // 2. Search in fixtures/ directory
    const fixtureFiles = await fs.readdir(path.join(projectRoot, "fixtures")).catch(() => []);
    for (const file of fixtureFiles) {
      if (file.endsWith(".json")) {
        const filePath = path.join(projectRoot, "fixtures", file);
        let shouldDelete = false;

        if (
          file === `${cleanId}.json` ||
          file === cleanId ||
          file.includes(cleanId)
        ) {
          shouldDelete = true;
        } else {
          const result = await loadQuizFile(filePath);
          if (result) {
            const cid = result.quiz.id || file.replace(".json", "");
            if (
              cid === cleanId ||
              result.quiz.id === cleanId ||
              (result.quiz.title && result.quiz.title.trim() === cleanId)
            ) {
              shouldDelete = true;
            }
          }
        }

        if (shouldDelete) {
          await fs.rm(filePath, { force: true });
          deletedCount++;
        }
      }
    }

    // 3. Search and remove any generated output files
    const outputDir = path.join(projectRoot, "output");
    if (existsSync(outputDir)) {
      const outFiles = await fs.readdir(outputDir).catch(() => []);
      for (const file of outFiles) {
        if (file.includes(cleanId) || file.replace(".json", "") === cleanId) {
          await fs.rm(path.join(outputDir, file), { force: true }).catch(() => {});
        }
      }
    }

    res.json({ ok: true, deletedCount });
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

// API: Validate assessment JSON
app.post("/api/validate", (req, res) => {
  try {
    const container = normalizeQuizzesPayload(req.body);
    const report = validateCourse(container);
    res.json({ ok: true, report });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

// API: Export assessment JSON
app.post("/api/export-json", async (req, res) => {
  try {
    const rawData = req.body.course || req.body.quizzes ? req.body : { quizzes: [req.body] };
    const container = normalizeQuizzesPayload(rawData);
    const quiz = extractPrimaryQuiz(container);
    if (!quiz) {
      return res.status(400).json({ ok: false, error: "Assessment data is required" });
    }
    if (!quiz.id) {
      quiz.id = `assessment_${Date.now()}`;
    }

    const titleName = (quiz.title || "").trim().replace(/[\/\\?%*:|"<>]/g, "_").trim();
    const safeBase = titleName || quiz.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeBase}.json`;
    const outputPath = path.join(outputDir, filename);

    const report = await exportCourse(container, outputPath);

    if (report.ok) {
      res.json({
        ok: true,
        downloadUrl: `/api/download/${filename}`,
        filename,
        course: container,
        report
      });
    } else {
      res.status(400).json({ ok: false, report });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

// API: Download exported JSON file
app.get("/api/download/:filename", (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(outputDir, safeFilename);

  if (!existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
  res.download(filePath, safeFilename);
});

// Serve main web dashboard on root
app.get("/", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Assessment Creator server listening on http://localhost:${PORT}`);
});
