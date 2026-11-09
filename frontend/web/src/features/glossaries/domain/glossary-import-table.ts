import Papa from "papaparse";
import { MAX_GLOSSARY_ENTRIES } from "./glossary-limits.js";
import type { GlossaryEntryRow } from "./glossaries-store.js";

export const IMPORT_FIELDS = [
  ["source", "原词"], ["target", "译文"], ["note", "备注"],
  ["level", "类型"], ["match_mode", "匹配模式"], ["context", "语境"],
] as const;
type Field = typeof IMPORT_FIELDS[number][0];
export type ImportMapping = { hasHeader: boolean; columns: Partial<Record<Field, number>> };
export type ImportDelimiter = "auto" | "," | "\t" | ";";
export type GlossaryTable = { rows: string[][]; delimiter: string; mapping: ImportMapping };
const aliases: Record<Field, string[]> = {
  source: ["source", "src", "term", "original", "原词", "原文", "术语"],
  target: ["target", "dst", "translation", "translated", "译文", "翻译", "目标译文"],
  note: ["note", "notes", "comment", "comments", "备注", "说明"],
  level: ["level", "glossary_level", "mode", "action", "类型", "模式", "动作"],
  match_mode: ["match", "match_mode", "match-mode", "匹配", "匹配模式"],
  context: ["context", "上下文", "语境"],
};

function detectMapping(rows: string[][]): ImportMapping {
  const first = rows[0] || [];
  const columns: ImportMapping["columns"] = {};
  for (const [field] of IMPORT_FIELDS) {
    const index = first.findIndex(value => aliases[field].includes(value.trim().toLowerCase()));
    if (index >= 0) columns[field] = index;
  }
  const hasHeader = columns.source !== undefined && columns.target !== undefined;
  return { hasHeader, columns: hasHeader ? columns : { source: 0, target: 1, ...(first.length > 2 ? { note: 2 } : {}) } };
}

/** Parse quoted fields before scoring separators: punctuation inside a term is not a separator. */
export function parseGlossaryTable(text: string, delimiter: ImportDelimiter = "auto"): GlossaryTable {
  const candidates = (delimiter === "auto" ? [",", "\t", ";"] : [delimiter]).map(separator => {
    const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { delimiter: separator, skipEmptyLines: "greedy" });
    const rows = parsed.data;
    const mapping = detectMapping(rows);
    const widths = rows.slice(0, 20).map(row => row.length);
    const width = widths[0] || 0;
    const consistency = widths.length ? widths.filter(n => n === width).length / widths.length : 0;
    const score = (mapping.hasHeader ? 10000 : 0) + (width > 1 ? 100 : 0) + consistency * 10 + Math.min(width, 50);
    return { rows, mapping, delimiter: separator, errors: parsed.errors, score };
  });
  candidates.sort((a, b) => b.score - a.score);
  const table = candidates[0];
  if (table.errors.length) throw new Error("CSV 引号格式有误，请检查未闭合或未转义的双引号。");
  if (table.rows.length > 10000 || table.rows.some(row => row.length > 100)) {
    throw new Error("文件超过 10000 行或 100 列，请仅保留术语数据后导入。");
  }
  return table;
}

// Match the CSV endpoint's aliases; unknown values keep its historical defaults.
function normalizeLevel(value: string) {
  const v = value.toLowerCase();
  if (["preserve", "keep", "keep_origin", "keep-original", "do_not_translate", "do-not-translate", "not_translate", "not-translate", "no_translate", "no-translate", "不翻译", "保留", "原文保留"].includes(v)) return "preserve";
  if (["canonical", "fixed", "fixed_translation", "fixed-translation", "required", "强制翻译", "固定翻译", "专业译法", "标准译法"].includes(v)) return "canonical";
  return "preferred";
}
function normalizeMatch(value: string) {
  const v = value.toLowerCase();
  if (["case_insensitive", "case-insensitive", "ci", "ignore_case", "ignore-case", "大小写不敏感", "忽略大小写"].includes(v)) return "case_insensitive";
  return ["regex", "正则"].includes(v) ? "regex" : "exact";
}
function readCell(value: string) {
  return value.trim().replace(/^\uFEFF/, "").replace(/^'(?=[=+\-@\t\r])/, "");
}

export function previewGlossaryImport(table: GlossaryTable, mapping = table.mapping) {
  const errors: string[] = [];
  const entries: GlossaryEntryRow[] = [];
  const mappedRows: string[][] = [];
  const columns = Object.values(mapping.columns).filter(index => index !== undefined && index >= 0);
  if (mapping.columns.source === undefined || mapping.columns.source < 0 || mapping.columns.target === undefined || mapping.columns.target < 0) errors.push("请选择原词和译文对应的列。");
  if (new Set(columns).size !== columns.length) errors.push("同一列不能对应多个字段。");
  let duplicateCount = 0;
  const keys = new Set<string>();
  table.rows.slice(mapping.hasHeader ? 1 : 0).forEach((row, index) => {
    const recordNumber = index + (mapping.hasHeader ? 2 : 1);
    const raw = Object.fromEntries(IMPORT_FIELDS.map(([field]) => [field, row[mapping.columns[field] ?? -1] || ""])) as Record<Field, string>;
    const entry = Object.fromEntries(IMPORT_FIELDS.map(([field]) => [field, readCell(raw[field])])) as GlossaryEntryRow;
    entry.level = normalizeLevel(entry.level);
    entry.match_mode = normalizeMatch(entry.match_mode);
    if (![entry.source, entry.target, entry.note, entry.context].some(Boolean)) return;
    if (!entry.source || (!entry.target && entry.level !== "preserve")) errors.push(`第 ${recordNumber} 条记录缺少原词或译文。`);
    for (const [field, label] of IMPORT_FIELDS) {
      const limit = field === "source" || field === "target" ? 200 : 500;
      if ([...entry[field]].length > limit) errors.push(`第 ${recordNumber} 条记录的${label}超过 ${limit} 字。`);
    }
    const key = JSON.stringify([entry.match_mode === "case_insensitive" ? entry.source.toLowerCase() : entry.source, entry.context.toLowerCase()]);
    if (keys.has(key)) duplicateCount++;
    keys.add(key);
    entries.push(entry);
    // Keep raw cells: the endpoint removes the export formula guard exactly once.
    mappedRows.push(IMPORT_FIELDS.map(([field]) => raw[field]));
  });
  if (!entries.length) errors.push("没有可导入的词条。");
  if (keys.size > MAX_GLOSSARY_ENTRIES) errors.push(`去重后有 ${keys.size} 条，超过 ${MAX_GLOSSARY_ENTRIES} 条上限，请拆分文件。`);
  return { entries, errors, duplicateCount, csv: Papa.unparse([IMPORT_FIELDS.map(([field]) => field), ...mappedRows]) };
}

export function glossaryRowsToCsv(rows: string[][]) { return Papa.unparse(rows); }
