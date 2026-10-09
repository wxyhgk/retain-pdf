import { escapeHtml } from "@/platform/utils/html-formatting.js";

export { escapeHtml };

type LooseRecord = Record<string, unknown>;

/** 诊断载荷形状不定，只按字段名读取；非对象一律当空对象（与原先 `value?.x` 的读取结果一致）。 */
export function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

export function stringifyPretty(value: unknown) {
  if (value == null || value === "") {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}

export function boolLabel(value: unknown) {
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  return "-";
}

export function previewText(value: unknown) {
  const text = `${value ?? ""}`.trim();
  if (!text) {
    return "-";
  }
  if (text.length <= 180) {
    return text;
  }
  return `${text.slice(0, 177)}...`;
}

export function normalizeRoutePath(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" -> ");
  }
  return `${value ?? ""}`.trim();
}

export function firstNonEmptyText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function diagnosticsOf(value: unknown): LooseRecord {
  return asRecord(asRecord(value).translation_diagnostics);
}

export function pageNumberOf(value: unknown, fallback = "-") {
  const pageNumber = Number(asRecord(value).page_number);
  if (Number.isFinite(pageNumber) && pageNumber > 0) {
    return `${pageNumber}`;
  }
  const pageIdx = Number(asRecord(value).page_idx);
  if (Number.isFinite(pageIdx) && pageIdx >= 0) {
    return `${pageIdx + 1}`;
  }
  return fallback;
}

export function finalStatusOf(value: unknown) {
  const diagnostics = diagnosticsOf(value);
  return firstNonEmptyText(asRecord(value).final_status, diagnostics.final_status);
}

export function fallbackToOf(value: unknown) {
  const diagnostics = diagnosticsOf(value);
  return firstNonEmptyText(asRecord(value).fallback_to, diagnostics.fallback_to);
}

export function degradationReasonOf(value: unknown) {
  const diagnostics = diagnosticsOf(value);
  return firstNonEmptyText(asRecord(value).degradation_reason, diagnostics.degradation_reason);
}

export function routePathOf(value: unknown): unknown {
  const diagnostics = diagnosticsOf(value);
  return asRecord(value).route_path ?? diagnostics.route_path ?? [];
}

export function errorTypesOf(value: unknown): unknown[] {
  const record = asRecord(value);
  if (Array.isArray(record.error_types) && record.error_types.length) {
    return record.error_types;
  }
  const diagnostics = diagnosticsOf(value);
  if (Array.isArray(diagnostics.error_types) && diagnostics.error_types.length) {
    return diagnostics.error_types;
  }
  if (Array.isArray(diagnostics.error_trace) && diagnostics.error_trace.length) {
    return diagnostics.error_trace
      .map((entry: unknown) => firstNonEmptyText(asRecord(entry).type, asRecord(entry).error_type))
      .filter(Boolean);
  }
  return [];
}

export function finalStatusLabel(value: unknown) {
  switch (`${value || ""}`.trim()) {
    case "translated":
      return "已翻译";
    case "partially_translated":
      return "部分翻译";
    case "kept_origin":
      return "保留原文";
    case "failed":
      return "失败";
    case "skipped":
      return "已跳过";
    default:
      return `${value || "-"}`;
  }
}

export function finalStatusClass(value: unknown) {
  switch (`${value || ""}`.trim()) {
    case "translated":
      return "is-translated";
    case "partially_translated":
      return "is-partially-translated";
    case "kept_origin":
      return "is-kept-origin";
    case "failed":
      return "is-failed";
    case "skipped":
      return "is-skipped";
    default:
      return "is-neutral";
  }
}

/** 翻译筛选条件（只用到状态与检索词） */
export interface TranslationFilterQueryLike {
  finalStatus?: string;
  q?: string;
}

export function summarizeTranslationFilter(query: TranslationFilterQueryLike = {}) {
  const finalStatus = `${query.finalStatus || ""}`.trim();
  const statusText = finalStatus ? finalStatusLabel(finalStatus) : "全部";
  const search = `${query.q || ""}`.trim();
  return `状态 ${statusText}，检索 ${search || "无"}`;
}

export function renderField(label: string, value: unknown) {
  return `
    <div class="info-row translation-detail-row">
      <span class="label">${escapeHtml(label)}</span>
      <span class="info-value">${escapeHtml(value)}</span>
    </div>
  `;
}

export function renderTextBlock(label: string, value: unknown) {
  return `
    <section class="translation-text-block">
      <div class="translation-debug-subhead">
        <h4>${escapeHtml(label)}</h4>
      </div>
      <pre>${escapeHtml(stringifyPretty(value))}</pre>
    </section>
  `;
}
