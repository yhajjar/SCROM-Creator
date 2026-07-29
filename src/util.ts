import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function normalizeZipPath(value: string): string {
  return value.split(path.sep).join("/");
}

export async function listFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        results.push(normalizeZipPath(path.relative(root, fullPath)));
      }
    }
  }
  await visit(root);
  return results;
}

export async function sha256File(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

export function hashBuffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function isWithin(base: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(base), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function makeIdentifier(prefix: string, uuid: string): string {
  return `${prefix}-${uuid.replaceAll("-", "").toUpperCase()}`;
}

export function lzwCompressLength(input: string): number {
  const bytes = Buffer.from(input, "utf8");
  if (bytes.length === 0) return 2;
  const dictionary = new Map<string, number>();
  for (let index = 0; index < 256; index += 1) dictionary.set(String.fromCharCode(index), index);
  let nextCode = 256;
  let phrase = "";
  let codeCount = 0;
  for (const byte of bytes) {
    const character = String.fromCharCode(byte);
    const candidate = phrase + character;
    if (dictionary.has(candidate)) {
      phrase = candidate;
    } else {
      codeCount += 1;
      if (nextCode < 65_535) dictionary.set(candidate, nextCode++);
      phrase = character;
    }
  }
  if (phrase) codeCount += 1;
  return 2 + Math.ceil((codeCount * 2) / 3) * 4;
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const text = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${(error as Error).message}`);
  }
}
