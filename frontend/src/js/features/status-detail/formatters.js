export function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function stringifyPretty(value) {
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

export function boolLabel(value) {
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  return "-";
}

export function previewText(value) {
  const text = `${value ?? ""}`.trim();
  if (!text) {
    return "-";
  }
  if (text.length <= 180) {
    return text;
  }
  return `${text.slice(0, 177)}...`;
}

export function normalizeRoutePath(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" -> ");
  }
  return `${value ?? ""}`.trim();
}

export function firstNonEmptyText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function diagnosticsOf(value) {
  const item = value && typeof value === "object" ? value : {};
  const nested = item.translation_diagnostics;
  return nested && typeof nested === "object" ? nested : {};
}

export function pageNumberOf(value, fallback = "-") {
  const pageNumber = Number(value?.page_number);
  if (Number.isFinite(pageNumber) && pageNumber > 0) {
    return `${pageNumber}`;
  }
  const pageIdx = Number(value?.page_idx);
  if (Number.isFinite(pageIdx) && pageIdx >= 0) {
    return `${pageIdx + 1}`;
  }
  return fallback;
}

export function finalStatusOf(value) {
  const diagnostics = diagnosticsOf(value);
  return firstNonEmptyText(value?.final_status, diagnostics.final_status);
}

export function fallbackToOf(value) {
  const diagnostics = diagnosticsOf(value);
  return firstNonEmptyText(value?.fallback_to, diagnostics.fallback_to);
}

export function degradationReasonOf(value) {
  const diagnostics = diagnosticsOf(value);
  return firstNonEmptyText(value?.degradation_reason, diagnostics.degradation_reason);
}

export function routePathOf(value) {
  const diagnostics = diagnosticsOf(value);
  return value?.route_path ?? diagnostics.route_path ?? [];
}

export function errorTypesOf(value) {
  if (Array.isArray(value?.error_types) && value.error_types.length) {
    return value.error_types;
  }
  const diagnostics = diagnosticsOf(value);
  if (Array.isArray(diagnostics.error_types) && diagnostics.error_types.length) {
    return diagnostics.error_types;
  }
  if (Array.isArray(diagnostics.error_trace) && diagnostics.error_trace.length) {
    return diagnostics.error_trace
      .map((entry) => firstNonEmptyText(entry?.type, entry?.error_type))
      .filter(Boolean);
  }
  return [];
}

export function finalStatusLabel(value) {
  switch (`${value || ""}`.trim()) {
    case "translated":
      return "已翻译";
    case "kept_origin":
      return "保留原文";
    case "skipped":
      return "已跳过";
    default:
      return `${value || "-"}`;
  }
}

export function finalStatusClass(value) {
  switch (`${value || ""}`.trim()) {
    case "translated":
      return "is-translated";
    case "kept_origin":
      return "is-kept-origin";
    case "skipped":
      return "is-skipped";
    default:
      return "is-neutral";
  }
}

export function summarizeTranslationFilter(query = {}) {
  const finalStatus = `${query.finalStatus || ""}`.trim() || "全部";
  const search = `${query.q || ""}`.trim() || "无检索词";
  return `final_status=${finalStatus}，q=${search}`;
}

export function renderField(label, value) {
  return `
    <div class="info-row translation-detail-row">
      <span class="label">${escapeHtml(label)}</span>
      <span class="info-value">${escapeHtml(value)}</span>
    </div>
  `;
}

export function renderTextBlock(label, value) {
  return `
    <section class="translation-text-block">
      <div class="translation-debug-subhead">
        <h4>${escapeHtml(label)}</h4>
      </div>
      <pre>${escapeHtml(stringifyPretty(value))}</pre>
    </section>
  `;
}
