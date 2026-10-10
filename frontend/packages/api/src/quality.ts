// quality — pure：一个任务的译文质量摘要与问题明细（GET /jobs/:id/quality-summary、/quality-items）。
// 字段按后端约定写在这里；契约（contracts）发布后改成从 @retainpdf/contracts 引类型。
import { apiFetch } from "./internal/runtime.js";
import { buildApiHeaders, buildJobDetailEndpoint, unwrapEnvelope } from "./http.js";

export type QualitySeverityCounts = { critical?: number; major?: number; minor?: number };

export type QualitySummaryView = {
  job_id: string;
  preparation: null | {
    mode: string;
    term_base: null | {
      complete: boolean;
      term_count: number;
      locked_count: number;
      conflict_count: number;
      batch_count: number;
      failed_batch_ids: string[];
    };
    style_guide: null | { complete: boolean; llm_status: string; rule_count: number };
    /** "term_base_incomplete" / "style_guide_fallback"；空数组表示完整。 */
    problems: string[];
  };
  qa: null | {
    generated_at: string;
    item_count: number;
    checked_item_count: number;
    violation_count: number;
    by_severity: QualitySeverityCounts;
    by_check: Record<string, number>;
    by_type: Record<string, number>;
  };
  layout: null | {
    blocks: number;
    shrunk_blocks: number;
    small_blocks: number;
    small_scale_threshold: number;
    overflow_blocks: number;
    overflow_pages: number[];
    min_scale: number;
    min_final_font_size: number;
    math_formulas: number;
    math_failed: number;
  };
  refine: null | {
    mode: string;
    status: string;
    stopped_reason: string | null;
    generated_at: string;
    qa_before: { violation_count: number; by_severity: QualitySeverityCounts };
    qa_after: { violation_count: number; by_severity: QualitySeverityCounts };
    applied: number;
    rejected: number;
    skipped: number;
    reject_reasons: Record<string, number>;
    skip_reasons: Record<string, number>;
    escalated_count: number;
  };
  /** 公式、模型判定不用翻、真失败分开计；只有 failed 算问题。 */
  untranslated: { failed: number; formula: number; model_kept: number; other: number };
};

export type QualityItemKind = "layout" | "untranslated" | "qa" | "escalated";

export type QualityItem = {
  /** 阅读页的编号（四位，和 /reader/regions 同一套），跳转用它。 */
  item_id: string;
  /** 译文条目的编号（三位），改译文、看修订历史的接口用它。 */
  translation_item_id?: string;
  page: number;
  reason?: string;
  scale?: number;
  final_font_size?: number;
  overflow_pt?: number;
  skip_reason?: string;
  id?: string;
  check?: string;
  type?: string;
  severity?: string;
  message?: string;
  categories?: string[];
};

export type QualityItemsView = { kind: QualityItemKind; total: number; offset: number; limit: number; items: QualityItem[] };

async function getJson<T>(url: string, label: string): Promise<T> {
  const resp = await apiFetch(url, { headers: buildApiHeaders() });
  if (!resp.ok) {
    const error = await resp.json().catch(() => null);
    throw new Error(error?.message || `读取${label}失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json()) as T;
}

export function fetchQualitySummary(jobId: string, apiPrefix?: string): Promise<QualitySummaryView> {
  return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/quality-summary`, "质量摘要");
}

export function fetchQualityItems(
  jobId: string,
  apiPrefix: string | undefined,
  { kind, page, severity, offset = 0, limit = 200 }: { kind: QualityItemKind; page?: number; severity?: string; offset?: number; limit?: number },
): Promise<QualityItemsView> {
  const params = new URLSearchParams({ kind, offset: `${offset}`, limit: `${limit}` });
  if (page) params.set("page", `${page}`);
  if (severity) params.set("severity", severity);
  return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/quality-items?${params}`, "质量明细");
}
