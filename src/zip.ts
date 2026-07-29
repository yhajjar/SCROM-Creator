import { promises as fs } from "node:fs";
import path from "node:path";
import { once } from "node:events";
import yazl from "yazl";
import yauzl from "yauzl";
import { listFiles } from "./util.js";

const deterministicDate = new Date("1980-01-01T00:00:00.000Z");

export async function createZip(sourceDirectory: string, outputPath: string): Promise<number> {
  const files = await listFiles(sourceDirectory);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const zip = new yazl.ZipFile();
  for (const relativePath of files) {
    const data = await fs.readFile(path.join(sourceDirectory, ...relativePath.split("/")));
    zip.addBuffer(data, relativePath, { mtime: deterministicDate, mode: 0o100644, compress: true });
  }
  zip.end();
  const output = (await import("node:fs")).createWriteStream(outputPath);
  zip.outputStream.pipe(output);
  await once(output, "close");
  return files.length;
}

export interface ZipEntryData {
  name: string;
  data?: Buffer;
  size: number;
}

export function readZip(
  zipPath: string,
  include: (name: string) => boolean = () => false
): Promise<ZipEntryData[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: true }, (openError, zip) => {
      if (openError || !zip) return reject(openError ?? new Error("Unable to open ZIP"));
      const entries: ZipEntryData[] = [];
      zip.on("error", reject);
      zip.on("end", () => resolve(entries));
      zip.on("entry", (entry) => {
        const name = entry.fileName.replaceAll("\\", "/");
        if (/\/$/.test(name) || !include(name)) {
          entries.push({ name, size: entry.uncompressedSize });
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error(`Cannot read ${name}`));
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => {
            entries.push({ name, size: entry.uncompressedSize, data: Buffer.concat(chunks) });
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}
