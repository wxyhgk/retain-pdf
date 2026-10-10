// 「译文质量」卡：把 GET /jobs/:id/quality-summary 整理成几条人话。
//
// 取舍（都看过真实数据再定的）：
// - 质检按严重程度说，不报一个吓人的总数：一本 88 页的书 550 处里 465 处是轻微的（大多是
//   「术语第一次出现没加括注」），和真正要看的混在一起会误导。
// - 「没翻译」只把真失败算问题；公式、编号、DOI 这些按原样保留是对的（39 本书 1048 块保留原文，
//   907 块是公式，真失败 3 块）。
// - 排版里「缩了字」是正常的（框装不下就缩），只有溢出和缩得太小才算要看的。
import type { QualitySummaryView } from "@/platform/api/index.js";

export type QualityListKind = "layout" | "escalated" | "untranslated" | "qa";

export type QualityRow = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "ok" | "warn" | "info";
  /** 有明细可看时，点开按这个 kind 拉 quality-items。 */
  list?: { kind: QualityListKind; label: string };
  breakdown?: Array<{ label: string; value: number }>;
};

export type QualityModel = {
  empty: boolean;
  warnings: string[];
  rows: QualityRow[];
  attentionCount: number;
};

const CHECK_LABELS: Record<string, string> = {
  numbers: "数字",
  references: "图表与章节编号",
  placeholders: "占位符",
  terms: "术语",
  annotations: "术语括注",
  english_residue: "残留英文",
  omission: "漏译",
  punctuation: "标点",
  layout_fit: "排版装不下",
};

function n(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function pages(list: number[], max = 6): string {
  const sorted = [...new Set(list.filter((page) => n(page)))].sort((a, b) => a - b);
  if (!sorted.length) return "";
  const head = sorted.slice(0, max).join("、");
  return sorted.length > max ? `第 ${head} 等 ${sorted.length} 页` : `第 ${head} 页`;
}

export function qualityModel(summary: QualitySummaryView | null | undefined): QualityModel {
  if (!summary || (!summary.qa && !summary.layout && !summary.refine && !summary.preparation)) {
    return { empty: true, warnings: [], rows: [], attentionCount: 0 };
  }
  const warnings: string[] = [];
  const prep = summary.preparation;
  if (prep?.problems?.includes("term_base_incomplete") && prep.term_base) {
    const failed = prep.term_base.failed_batch_ids?.length || 0;
    warnings.push(`术语表不完整：${prep.term_base.batch_count} 批里有 ${failed} 批没抽出来，那部分术语没统一。重新翻译会补上。`);
  }
  if (prep?.problems?.includes("style_guide_fallback")) {
    warnings.push("这本书的风格指南没生成成功，翻译时用的是通用规则。重新翻译会重做。");
  }
  const failed = n(summary.untranslated?.failed);
  if (failed) warnings.push(`${failed} 块翻译失败，保留了原文。`);

  const rows: QualityRow[] = [];
  let attentionCount = failed;

  const qa = summary.qa;
  if (qa) {
    const critical = n(qa.by_severity?.critical);
    const major = n(qa.by_severity?.major);
    const minor = n(qa.by_severity?.minor);
    attentionCount += critical + major;
    rows.push({
      key: "qa",
      label: "自动检查",
      value: critical + major ? `${critical + major} 处要看` : "没有要看的问题",
      detail: [critical ? `严重 ${critical}` : "", major ? `一般 ${major}` : "", minor ? `轻微 ${minor}（多是格式细节）` : ""]
        .filter(Boolean).join(" · "),
      tone: critical + major ? "warn" : "ok",
      breakdown: Object.entries(qa.by_check || {})
        .filter(([, count]) => n(count))
        .sort((a, b) => n(b[1]) - n(a[1]))
        .map(([check, count]) => ({ label: CHECK_LABELS[check] || check, value: n(count) })),
      ...(critical + major ? { list: { kind: "qa" as const, label: "看要处理的问题" } } : {}),
    });
  }

  const refine = summary.refine;
  if (refine) {
    const before = n(refine.qa_before?.violation_count);
    const after = n(refine.qa_after?.violation_count);
    const escalated = n(refine.escalated_count);
    attentionCount += escalated;
    rows.push({
      key: "refine",
      label: "精修",
      value: before ? `问题 ${before} → ${after}${before > after ? `（少了 ${percent((before - after) / before)}）` : ""}` : `改了 ${n(refine.applied)} 处`,
      detail: [`采纳 ${n(refine.applied)}`, `没采纳 ${n(refine.rejected)}`, n(refine.skipped) ? `跳过 ${n(refine.skipped)}` : "", escalated ? `留给你确认 ${escalated}` : ""]
        .filter(Boolean).join(" · "),
      tone: escalated ? "warn" : "ok",
      ...(escalated ? { list: { kind: "escalated" as const, label: "看留给你确认的" } } : {}),
    });
  }

  const layout = summary.layout;
  if (layout) {
    const overflow = n(layout.overflow_blocks);
    const small = n(layout.small_blocks);
    const mathFailed = n(layout.math_failed);
    attentionCount += overflow + small + mathFailed;
    const parts = [
      overflow ? `${overflow} 块溢出（${pages(layout.overflow_pages)}）` : "",
      small ? `${small} 块字缩得太小（不到 ${percent(n(layout.small_scale_threshold) || 0.75)}）` : "",
      mathFailed ? `${mathFailed} 个公式没排出来` : "",
    ].filter(Boolean);
    rows.push({
      key: "layout",
      label: "排版",
      value: parts.length ? `${overflow + small + mathFailed} 处要看` : "都装得下",
      detail: parts.length
        ? `${parts.join(" · ")}；最小缩到 ${percent(n(layout.min_scale))}、${n(layout.min_final_font_size)}pt`
        : `${n(layout.shrunk_blocks)} 块缩了字号以装进原位置，都在正常范围`,
      tone: parts.length ? "warn" : "ok",
      ...(overflow + small ? { list: { kind: "layout" as const, label: "看排不下的块" } } : {}),
    });
  }

  const untranslated = summary.untranslated;
  if (untranslated) {
    const kept = n(untranslated.formula) + n(untranslated.model_kept);
    rows.push({
      key: "untranslated",
      label: "漏翻",
      value: failed ? `${failed} 块没翻成` : "没有",
      detail: kept ? `另有 ${kept} 块按原样保留（公式、编号、链接等，不需要翻）` : "",
      tone: failed ? "warn" : "ok",
      ...(failed ? { list: { kind: "untranslated" as const, label: "看没翻成的块" } } : {}),
    });
  }

  return { empty: false, warnings, rows, attentionCount };
}

const ITEM_REASON_LABELS: Record<string, string> = {
  overflow: "溢出",
  small_scale: "字缩得太小",
  failed: "翻译失败",
  formula: "公式",
  model_kept: "不需翻",
};

export function qualityItemReason(item: { reason?: string; scale?: number; message?: string; severity?: string }): string {
  if (item.message) return item.message;
  const label = ITEM_REASON_LABELS[`${item.reason || ""}`] || `${item.reason || ""}`;
  if (item.reason === "small_scale" && n(item.scale)) return `${label}（缩到 ${percent(n(item.scale))}）`;
  return label;
}
