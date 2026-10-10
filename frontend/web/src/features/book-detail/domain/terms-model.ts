// 「术语」页签：这本书翻译时用的术语表（译前抽取 + 术语专员审过），冲突、风格规则、领域判断。
// 数据来自通用取数接口的 terms / term_conflicts / style_rules / style_guide / domain_context。
// 「剔除」的是通用词（术语专员判定不进术语表），默认不显示，免得 800 多条里一半是普通单词。

export type TermRow = {
  source: string;
  target: string;
  category: string;
  kind: string;
  treatment: string;
  level: string;
  frequency: number;
  conflictCount: number;
};

export type TreatmentFilter = "all" | "lock" | "keep_original" | "free" | "drop";

export const TREATMENT_LABELS: Record<string, string> = {
  lock: "锁定译法",
  keep_original: "保留原文",
  free: "自由翻译",
  drop: "通用词（不入表）",
};

export const CATEGORY_LABELS: Record<string, string> = {
  technical: "专业术语",
  common: "通用词",
  organization: "机构",
  publication: "出版物",
  person: "人名",
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

export function termRows(rows: readonly Row[] | null | undefined): TermRow[] {
  return (rows || []).map((row) => ({
    source: text(row.source),
    target: text(row.target),
    category: text(row.category),
    kind: text(row.kind),
    treatment: text(row.treatment),
    level: text(row.level),
    frequency: Number(row.frequency) || 0,
    conflictCount: Array.isArray(row.conflict_candidates) ? row.conflict_candidates.length : 0,
  })).filter((row) => row.source);
}

export function termCounts(rows: readonly TermRow[]) {
  const counts: Record<TreatmentFilter, number> = { all: 0, lock: 0, keep_original: 0, free: 0, drop: 0 };
  for (const row of rows) {
    if (row.treatment !== "drop") counts.all += 1;
    if (row.treatment in counts) counts[row.treatment as TreatmentFilter] += 1;
  }
  return counts;
}

/** 「全部」不含通用词；搜索同时匹配原文和译文，不分大小写。按出现次数从多到少。 */
export function filterTerms(rows: readonly TermRow[], { treatment = "all", search = "" }: { treatment?: TreatmentFilter; search?: string } = {}): TermRow[] {
  const needle = search.trim().toLowerCase();
  return rows
    .filter((row) => (treatment === "all" ? row.treatment !== "drop" : row.treatment === treatment))
    .filter((row) => !needle || row.source.toLowerCase().includes(needle) || row.target.toLowerCase().includes(needle))
    .sort((a, b) => b.frequency - a.frequency || a.source.localeCompare(b.source));
}

export type ConflictRow = { source: string; target: string; candidates: string };

export function conflictRows(rows: readonly Row[] | null | undefined): ConflictRow[] {
  return (rows || []).map((row) => ({
    source: text(row.source),
    target: text(row.target),
    candidates: (Array.isArray(row.conflict_candidates) ? row.conflict_candidates : [])
      .map((candidate) => {
        const c = (candidate || {}) as Row;
        return `${text(c.target)}${Number(c.votes) ? ` ${Number(c.votes)}` : ""}`;
      })
      .filter(Boolean)
      .join(" · "),
  })).filter((row) => row.source);
}
