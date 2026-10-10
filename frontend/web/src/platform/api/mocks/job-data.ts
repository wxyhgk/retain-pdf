// 演示模式的通用取数：每个数据集几条样例，形状照 job-data.v1。
import type { JobDataCatalogView, JobDataQuery, JobDataView } from "@retainpdf/api/job-data";

type Row = Record<string, unknown>;

const ROWS: Record<string, Row[]> = {
  revisions: [
    { revision_id: "rev-1", item_id: "p012-b004", reader_item_id: "p012-b0004", page: 12, source: "refine", reason: "terminology: isolation realms → 隔离领域", previous_text: "隔离境界提供……", new_text: "隔离领域提供……", ts: "2026-10-10T02:40:00Z", generation: 248 },
    { revision_id: "rev-2", item_id: "p007-b003", reader_item_id: "p007-b0003", page: 7, source: "refine", reason: "omission: 补译第二句", previous_text: "效应处理器……", new_text: "效应处理器……，并且彼此从不交叉。", ts: "2026-10-10T02:38:00Z", generation: 247 },
  ],
  escalated: [
    { item_id: "p002-b001", reader_item_id: "p002-b0001", page: 2, reason: "2 轮后仍未解决", categories: ["terminology"], attempts: ["patch:rejected/length_budget_exceeded", "rewrite:applied"] },
  ],
  qa_violations: [
    { id: "qa-1", item_id: "p003-b002", reader_item_id: "p003-b0002", page: 3, check: "terms", type: "term_violation", severity: "major", message: "术语「identity」应译为「单位元」，译文未采用" },
  ],
  layout_blocks: [
    { item_id: "p012-b004", reader_item_id: "p012-b0004", page: 12, overflow: true, overflow_pt: 8.5, scale: 0.6, final_font_size: 6.2 },
    { item_id: "p018-b002", reader_item_id: "p018-b0002", page: 18, overflow: false, overflow_pt: 0, scale: 0.44, final_font_size: 4.8 },
  ],
  translation_items: [],
  terms: [
    { source: "fiber", target: "纤程", category: "technical", kind: "domain_term", frequency: 231, treatment: "translate", level: "preferred", review_status: "reviewed", conflict_candidates: [{ target: "纤体", votes: 6 }] },
    { source: "effect handler", target: "效应处理器", category: "technical", kind: "domain_term", frequency: 88, treatment: "translate", level: "locked", review_status: "reviewed", conflict_candidates: [] },
  ],
  term_conflicts: [{ source: "fiber", target: "纤程", conflict_candidates: [{ target: "纤体", votes: 6 }, { target: "纤", votes: 2 }] }],
  style_rules: [{ id: "first_mention_gloss", category: "terminology", apply: "qa", origin: "baseline", rule: "专业术语首次出现时采用「中文译名（英文全称）」的括注形式。", example: "卷积神经网络（convolutional neural network）" }],
};

const OBJECTS: Record<string, Row> = {
  domain_context: { domain: "编程语言理论", summary: "讨论可组合的效应系统与运行时隔离。", translation_guidance: "形式化符号保持原样，术语前后一致。" },
  style_guide: { complete: false, llm_status: "failed", register: "", audience: "", domain: { name: "编程语言理论" }, notes: "" },
};

export async function fetchJobDataCatalog(jobId: string): Promise<JobDataCatalogView> {
  return { job_id: jobId, datasets: [] } as unknown as JobDataCatalogView;
}

export async function fetchJobData(jobId: string, _apiPrefix: string | undefined, dataset: string, query: JobDataQuery = {}): Promise<JobDataView> {
  if (dataset in OBJECTS) {
    return { job_id: jobId, dataset, kind: "object", available: true, total: 1, offset: 0, limit: 1, object: OBJECTS[dataset] } as JobDataView;
  }
  let rows = [...(ROWS[dataset] || [])];
  for (const [field, value] of Object.entries(query.filters || {})) {
    if (value === null || value === undefined || value === "") continue;
    const allowed = (Array.isArray(value) ? value : [value]).map((v) => `${v}`);
    rows = rows.filter((row) => allowed.includes(`${row[field]}`));
  }
  const limit = query.limit || 200;
  return { job_id: jobId, dataset, kind: "rows", available: dataset in ROWS, total: rows.length, offset: 0, limit, rows: rows.slice(0, limit) } as JobDataView;
}
