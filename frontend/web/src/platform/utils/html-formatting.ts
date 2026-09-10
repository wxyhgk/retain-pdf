export function escapeAttribute(value) {
  return `${value || ""}`
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeHtml(value) {
  return `${value || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function truncateDisplayName(value, { maxLength = 30, fallback = "-" } = {}) {
  const text = `${value || ""}`.trim();
  if (!text) {
    return fallback;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
