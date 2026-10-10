// 演示模式的质量摘要：形状照后端约定，数字取自一本真实的 88 页书（编辑部精修过）。
import type { QualityItemKind, QualityItemsView, QualitySummaryView } from "@retainpdf/api/quality";

export async function fetchQualitySummary(jobId: string): Promise<QualitySummaryView> {
  return {
    job_id: jobId,
    preparation: {
      mode: "editorial",
      term_base: { complete: false, term_count: 876, locked_count: 664, conflict_count: 45, batch_count: 120, failed_batch_ids: ["b00110", "b00115", "b00118"] },
      style_guide: { complete: false, llm_status: "failed", rule_count: 10 },
      problems: ["term_base_incomplete", "style_guide_fallback"],
    },
    qa: {
      generated_at: "2026-10-10T02:56:00Z",
      item_count: 794,
      checked_item_count: 708,
      violation_count: 550,
      by_severity: { critical: 0, major: 85, minor: 465 },
      by_check: { annotations: 360, terms: 78, numbers: 47, punctuation: 47, layout_fit: 16, references: 2 },
      by_type: {},
    },
    layout: {
      blocks: 708, shrunk_blocks: 436, small_blocks: 31, small_scale_threshold: 0.75, overflow_blocks: 16,
      overflow_pages: [12, 18, 23, 31, 40, 47, 52, 66, 71, 80], min_scale: 0.44, min_final_font_size: 4.8, math_formulas: 882, math_failed: 2,
    },
    refine: {
      mode: "editorial", status: "succeeded", stopped_reason: null, generated_at: "2026-10-10T02:46:00Z",
      qa_before: { violation_count: 664, by_severity: { critical: 0, major: 120, minor: 544 } },
      qa_after: { violation_count: 534, by_severity: { critical: 0, major: 85, minor: 449 } },
      applied: 155, rejected: 67, skipped: 59,
      reject_reasons: { crosses_protected_token: 30, qa_new_violation: 13 }, skip_reasons: {}, escalated_count: 84,
    },
    untranslated: { failed: 0, formula: 84, model_kept: 2, other: 0 },
  };
}

export async function fetchQualityItems(_jobId: string, _apiPrefix: string | undefined, { kind }: { kind: QualityItemKind }): Promise<QualityItemsView> {
  const items = kind === "layout"
    ? [
        { item_id: "p012-b0004", page: 12, reason: "overflow", scale: 0.6, final_font_size: 6.2, overflow_pt: 8.5 },
        { item_id: "p018-b0002", page: 18, reason: "small_scale", scale: 0.44, final_font_size: 4.8, overflow_pt: 0 },
      ]
    : kind === "escalated"
      ? [{ item_id: "p007-b0003", page: 7, reason: "2 轮后仍未解决", categories: ["omission"] }]
      : [];
  return { kind, total: items.length, offset: 0, limit: 200, items };
}
