import type { GlossaryEntryRow } from "./glossaries-store.js";
import { glossaryRowsToCsv } from "./glossary-import-table.js";
export { parseGlossaryTable, previewGlossaryImport } from "./glossary-import-table.js";

import { MAX_GLOSSARY_ENTRIES } from "./glossary-limits.js";
export { MAX_GLOSSARY_ENTRIES } from "./glossary-limits.js";
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export type GlossaryImportMode = "append" | "replace";
export type GlossaryFileEncoding = "auto" | "utf-8" | "gb18030" | "utf-16le" | "utf-16be";
export type GlossaryFileContent = { text: string; encoding: string; sheets?: Array<{ name: string; text: string }> };

/** Read locally; only decoded text is sent to the existing CSV parser. */
export async function readGlossaryFile(file: File, encoding: GlossaryFileEncoding = "auto"): Promise<GlossaryFileContent> {
  if (!/\.(csv|tsv|txt|xlsx)$/i.test(file.name)) {
    throw new Error("请选择 CSV、TSV、TXT 或 XLSX 文件；旧版 XLS 请另存为 XLSX 或 CSV。");
  }
  if (file.size > MAX_IMPORT_BYTES) throw new Error("文件超过 2 MB，请拆分后导入。");
  if (!file.size) throw new Error("文件为空，请选择包含词条的文件。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name)) {
    try {
      const { default: readExcelFile } = await import("read-excel-file/browser");
      const workbook = await readExcelFile(bytes.buffer, { parseNumber: value => value });
      const sheets = workbook.map(sheet => {
        if (sheet.data.length > 10000 || sheet.data.some(row => row.length > 100)) throw new Error("工作表超过 10000 行或 100 列，请仅保留术语数据。");
        return { name: sheet.sheet, text: glossaryRowsToCsv(sheet.data.map(row => row.map(value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "")))) };
      });
      if (!sheets.length || sheets.every(sheet => !sheet.text.trim())) throw new Error("工作簿没有可导入的内容。");
      return { text: (sheets.find(sheet => sheet.text.trim()) || sheets[0]).text, encoding: "Excel", sheets };
    } catch (error) {
      throw new Error(`无法读取 Excel：${error instanceof Error ? error.message : "文件损坏"}。请确认是未加密的 XLSX 文件。`);
    }
  }
  let detected = encoding === "auto" ? "utf-8" : encoding;
  let text: string;
  if (encoding === "auto" && bytes[0] === 0xff && bytes[1] === 0xfe) detected = "utf-16le";
  if (encoding === "auto" && bytes[0] === 0xfe && bytes[1] === 0xff) detected = "utf-16be";
  try {
    text = new TextDecoder(detected, { fatal: true }).decode(bytes);
  } catch {
    if (encoding !== "auto" || detected !== "utf-8") throw new Error("无法按所选编码读取文件，请切换编码后重试。");
    detected = "gb18030";
    try {
      text = new TextDecoder(detected, { fatal: true }).decode(bytes);
    } catch {
      throw new Error("无法识别文件编码，请将文件另存为 UTF-8 CSV 后重试。");
    }
  }
  text = text.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("文件没有可导入的内容。");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new Error("文件包含非文本内容，请检查文件格式或编码。");
  }
  return { text, encoding: detected };
}

/** Mirrors retainpdf-glossaries/entries.rs: (source, context), later entry wins. */
export function mergeGlossaryEntries(
  current: Array<Partial<GlossaryEntryRow>>,
  incoming: Array<Partial<GlossaryEntryRow>>,
  mode: GlossaryImportMode,
) {
  const entries: Array<Partial<GlossaryEntryRow>> = [];
  const positions = new Map<string, number>();
  let duplicateCount = 0;
  for (const entry of [...(mode === "append" ? current : []), ...incoming]) {
    const source = (entry.source || "").trim();
    // Drop placeholder rows only, retaining unfinished user edits for later correction.
    if (!source && !entry.target?.trim() && !entry.note?.trim() && !entry.context?.trim()) continue;
    if (!source) { entries.push(entry); continue; }
    const key = JSON.stringify([
      entry.match_mode === "case_insensitive" ? source.toLowerCase() : source,
      (entry.context || "").trim().toLowerCase(),
    ]);
    const previous = positions.get(key);
    if (previous !== undefined) { entries[previous] = entry; duplicateCount++; }
    else { positions.set(key, entries.length); entries.push(entry); }
  }
  if (entries.length > MAX_GLOSSARY_ENTRIES) throw new Error(`合并后有 ${entries.length} 条，超过 ${MAX_GLOSSARY_ENTRIES} 条上限。请拆分文件或选择替换；当前草稿未修改。`);
  return { entries, duplicateCount };
}

export const GLOSSARY_CSV_TEMPLATE = "\ufeffsource,target,note,level,match_mode,context\r\nband gap,带隙,材料术语,canonical,case_insensitive,半导体\r\nDNA,,保留缩写,preserve,exact,\r\n";
