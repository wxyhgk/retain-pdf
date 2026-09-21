// frontend/packages/domain/src/job/job-detail-formatters.ts — pure job-detail display/format helpers
// Extracted verbatim from frontend/web/src/js/job-detail/* (artifacts/failure/resume/routing/summary).
// No DOM, no window, no fetch — only string/object formatting.
import { firstNonEmpty } from "./core.js";
import { resolveJobMarkdownContract } from "./artifacts.js";

export function firstJobIdFromPayload(payload: unknown): string {
  const candidate = payload as {
    job_id?: unknown;
    data?: { job_id?: unknown };
    job?: { job_id?: unknown; id?: unknown };
    id?: unknown;
  } | null | undefined;
  return firstNonEmpty(
    candidate?.job_id,
    candidate?.data?.job_id,
    candidate?.job?.job_id,
    candidate?.job?.id,
    candidate?.id,
  );
}

// 注意：web 侧 features/job-detail/domain/dialog/resume-actions.ts 另有一份同名实现，
// 「没有恢复计划」时返回空串。那不是过期拷贝，是两个渲染点的要求正好相反，见
// tests/architecture/domain-package-duplicate-exports.test.mjs 里锁住这条分叉的用例。
//
// 这一份服务详情页顶部的 detail-rerun-status 这一行：overview-renderer.ts 把返回值
// 直接 setText 进去，没有 `||` 兜底，而 DetailApp 的 setText 是 `value ?? "-"`——
// 空串不是 nullish，会被原样写进 texts，t() 于是认为这个 id 已有值，不再回落到
// DetailHeader 的静态默认文案。所以这里返回空串 = 那一行直接变空白。
// 兜底文案要和 DetailHeader.tsx 里同一个 span 的静态默认逐字一致。
export function summarizeResumePlan(plan: {
  can_resume?: unknown;
  reason?: unknown;
  from_stage?: unknown;
  resume_from?: unknown;
  resume_workflow?: unknown;
  workflow?: unknown;
  reruns_stages?: unknown;
} | null | undefined): string {
  if (!plan) {
    return "当前任务暂不可恢复。";
  }
  if (!plan.can_resume) {
    return `${(plan.reason as string) || "当前任务暂不可恢复。"}`;
  }
  const fromStage = firstNonEmpty(
    plan.from_stage,
    plan.resume_from,
    "checkpoint",
  );
  const workflow = firstNonEmpty(plan.resume_workflow, plan.workflow);
  const reruns = Array.isArray(plan.reruns_stages) ? plan.reruns_stages.join("、") : "";
  const bits = [`可从 ${fromStage} 恢复`];
  if (workflow) {
    bits.push(`workflow=${workflow}`);
  }
  if (reruns) {
    bits.push(`重跑 ${reruns}`);
  }
  return bits.join("，");
}

export function summarizeMathMode(job: { request_payload_math_mode?: unknown } | null | undefined): string {
  const mathMode = `${job?.request_payload_math_mode || ""}`.trim();
  if (mathMode === "placeholder") {
    return "placeholder - 公式占位保护";
  }
  if (mathMode === "direct_typst") {
    return "direct_typst - 模型直出公式";
  }
  return mathMode || "-";
}

export function formatSizeBytes(value: unknown): string {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) {
    return "-";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncatePreview(value: unknown, maxChars = 4000): string {
  const text = `${value || ""}`;
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n...（预览已截断）`;
}

export function summarizeArtifactLabel(key: unknown): string {
  switch (`${key || ""}`.trim()) {
    case "source_pdf":
      return "源 PDF";
    case "translated_pdf":
      return "译后 PDF";
    case "typst_render_pdf":
      return "Typst 渲染 PDF";
    case "markdown_raw":
      return "Markdown Raw";
    case "markdown_images_dir":
      return "Markdown 图片目录";
    case "markdown_bundle_zip":
      return "Markdown Bundle";
    case "normalized_document_json":
      return "Normalized Document";
    case "normalization_report_json":
      return "Normalization Report";
    case "translation_manifest_json":
      return "Translation Manifest";
    case "translation_diagnostics_json":
      return "Translation Diagnostics";
    case "translation_debug_index_json":
      return "Translation Debug Index";
    case "provider_result_json":
      return "Provider Result";
    case "provider_bundle_zip":
      return "Provider Bundle";
    case "provider_raw_dir":
      return "Provider Raw Dir";
    case "pipeline_summary":
      return "Pipeline Summary";
    case "events_jsonl":
      return "Events JSONL";
    default:
      return `${key || "-"}`.trim() || "-";
  }
}

export function firstDefinedValue(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      return value;
    }
  }
  return "";
}

export function stringifyDebugValue(value: unknown): string {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}

export function resolveMarkdownImagesBaseUrl(job: unknown, markdownPayload: {
  images_base_url?: unknown;
  images_base_path?: unknown;
} | null | undefined): string {
  return `${markdownPayload?.images_base_url
    || markdownPayload?.images_base_path
    || resolveJobMarkdownContract(job as never).imagesBaseUrl
    || ""}`.trim();
}

export function isMarkdownReady(job: unknown): boolean {
  return Boolean(resolveJobMarkdownContract(job as never).ready);
}
