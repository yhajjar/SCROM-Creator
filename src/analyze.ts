import { promises as fs } from "node:fs";
import path from "node:path";
import { listFiles, normalizeZipPath } from "./util.js";
import { readZip, type ZipEntryData } from "./zip.js";

interface SourceFile {
  name: string;
  size: number;
  text?: string;
}

export interface AnalysisReport {
  ok: boolean;
  command: "analyze";
  input: string;
  inputType: "directory" | "scorm-zip" | "ispring-quiz" | "zip";
  classification: "easy-to-automate" | "possible-but-fragile" | "difficult-embedded" | "not-recommended" | "authoring-source-readable";
  summary: string;
  standard: string | null;
  launchFile: string | null;
  editableContent: string[];
  requiredChanges: string[];
  doNotTouch: string[];
  manifest: {
    present: boolean;
    identifier?: string;
    itemIdentifier?: string;
    resourceIdentifier?: string;
    references: number;
    missingFiles: string[];
  };
  signals: Record<string, boolean | number | string>;
  warnings: string[];
}

const interestingNames = new Set(["imsmanifest.xml", "res/index.html", "index.html", "document.json", "metainfo.json", "workspace.json"]);

async function readDirectory(directory: string): Promise<SourceFile[]> {
  const names = await listFiles(directory);
  return Promise.all(names.map(async (name) => {
    const fullPath = path.join(directory, ...name.split("/"));
    const stat = await fs.stat(fullPath);
    const shouldRead = interestingNames.has(name.toLowerCase()) || /\.(xml|html|json)$/i.test(name);
    return { name, size: stat.size, text: shouldRead && stat.size < 5_000_000 ? await fs.readFile(fullPath, "utf8") : undefined };
  }));
}

async function readArchive(archivePath: string): Promise<SourceFile[]> {
  const entries = await readZip(archivePath, (name) => {
    const normalized = name.toLowerCase();
    return interestingNames.has(normalized) || /\.(xml|html|json)$/i.test(normalized);
  });
  return entries.map((entry: ZipEntryData) => ({
    name: normalizeZipPath(entry.name),
    size: entry.size,
    text: entry.data?.toString("utf8")
  }));
}

function extract(pattern: RegExp, text: string | undefined): string | undefined {
  return text?.match(pattern)?.[1];
}

export async function analyzePackage(inputPath: string): Promise<AnalysisReport> {
  const absoluteInput = path.resolve(inputPath);
  const stat = await fs.stat(absoluteInput);
  const extension = path.extname(absoluteInput).toLowerCase();
  const files = stat.isDirectory() ? await readDirectory(absoluteInput) : await readArchive(absoluteInput);
  const fileNames = new Set(files.map((file) => file.name));
  const fileNamesLower = new Map(files.map((file) => [file.name.toLowerCase(), file.name]));
  const get = (name: string): SourceFile | undefined => files.find((file) => file.name.toLowerCase() === name.toLowerCase());
  const manifestFile = get("imsmanifest.xml");
  const manifestText = manifestFile?.text;
  const hrefs = manifestText ? [...manifestText.matchAll(/<file\s+href="([^"]+)"/gi)].map((match) => match[1].replaceAll("\\", "/")) : [];
  const missingFiles = hrefs.filter((href) => !fileNames.has(href) && !fileNamesLower.has(href.toLowerCase()));
  const launchFile = extract(/<resource[^>]+\bhref="([^"]+)"/i, manifestText) ?? null;
  const launch = launchFile ? get(launchFile) : get("index.html") ?? get("res/index.html");
  const launchText = launch?.text ?? "";
  const isQuizSource = extension === ".quiz" || (!!get("document.json") && !!get("metainfo.json"));
  const isIsping = /Created with iSpring|iSpring\.quiz|QuizPlayer\.start/i.test(launchText);
  const embeddedBase64 = /var\s+data\s*=\s*"[A-Za-z0-9+/=]{1000,}"/.test(launchText);
  const encryptedSignal = files.some((file) => /encrypt|license check|activation required/i.test(file.text ?? ""));
  const minifiedRuntime = files.some((file) => /(?:^|\/)(?:player|lms)\.js$/i.test(file.name) && file.size > 50_000);
  const scorm12 = /<schemaversion>\s*1\.2\s*<\/schemaversion>/i.test(manifestText ?? "");
  const contentId = extract(/"contentId"\s*:\s*"([^"]+)"/, launchText);
  const itemIdentifier = extract(/<item\s+identifier="([^"]+)"/i, manifestText);

  let inputType: AnalysisReport["inputType"] = stat.isDirectory() ? "directory" : "zip";
  let classification: AnalysisReport["classification"] = "easy-to-automate";
  let summary = "Package uses directly editable, separated content files.";
  if (isQuizSource) {
    inputType = "ispring-quiz";
    classification = "authoring-source-readable";
    summary = "Readable iSpring authoring archive; it still requires a publisher to become a SCORM package.";
  } else if (manifestFile && !stat.isDirectory()) {
    inputType = "scorm-zip";
  }
  if (!isQuizSource && isIsping && embeddedBase64) {
    classification = "possible-but-fragile";
    summary = "Content is readable but embedded as Base64 JSON in an undocumented iSpring runtime payload.";
  } else if (!isQuizSource && embeddedBase64) {
    classification = "difficult-embedded";
    summary = "Content is embedded or encoded rather than maintained as a documented content file.";
  }
  if (encryptedSignal) {
    classification = "not-recommended";
    summary = "Encryption, activation, or license-check signals were detected.";
  }

  const editableContent = isQuizSource
    ? ["document.json", "metainfo.json", "images/", "Themes/"]
    : isIsping
      ? [launch?.name ?? "res/index.html (embedded Base64 JSON)", "imsmanifest.xml", "res/data/images/"]
      : files.filter((file) => /\.(json|xml|html)$/i.test(file.name)).map((file) => file.name);
  const doNotTouch = isIsping
    ? files.filter((file) => /(?:^|\/)(?:player|lms|browsersupport)\.js$|(?:^|\/)fonts\/|(?:^|\/)(?:goodbye|html5-unsupported)\.html$/i.test(file.name)).map((file) => file.name)
    : [];

  return {
    ok: missingFiles.length === 0,
    command: "analyze",
    input: absoluteInput,
    inputType,
    classification,
    summary,
    standard: scorm12 ? "SCORM 1.2" : manifestFile ? "unknown SCORM/IMS version" : null,
    launchFile,
    editableContent,
    requiredChanges: isIsping
      ? ["course and SCO titles", "manifest/item identifiers", "embedded course payload", "contentId", "media references and manifest inventory"]
      : isQuizSource
        ? ["document.json", "metainfo.json", "media references", "republish through iSpring or migrate to content/course.json"]
      : ["content/course.json", "course identifiers and metadata", "referenced assets"],
    doNotTouch,
    manifest: {
      present: !!manifestFile,
      identifier: extract(/<manifest\s+identifier="([^"]+)"/i, manifestText),
      itemIdentifier,
      resourceIdentifier: extract(/<resource\s+identifier="([^"]+)"/i, manifestText),
      references: hrefs.length,
      missingFiles
    },
    signals: {
      isISpring: isIsping,
      embeddedBase64,
      minifiedRuntime,
      encryptedOrLicensed: encryptedSignal,
      readableAuthoringJson: isQuizSource,
      itemMatchesContentId: !!contentId && contentId === itemIdentifier,
      fileCount: files.length
    },
    warnings: [
      ...(missingFiles.length ? [`${missingFiles.length} manifest file reference(s) are missing`] : []),
      ...(isIsping ? ["Do not treat the private iSpring payload schema as a stable automation API."] : [])
    ]
  };
}
