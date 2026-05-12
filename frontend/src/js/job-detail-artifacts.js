import { $ } from "./dom.js";
import {
  collectMarkdownImageRefs,
  resolveJobMarkdownContract,
  resolveMarkdownAssetUrl,
} from "./job-artifacts.js";

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function formatSizeBytes(value) {
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

function truncatePreview(value, maxChars = 4000) {
  const text = `${value || ""}`;
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n...（预览已截断）`;
}

function summarizeArtifactLabel(key) {
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

export function revokeMarkdownImageUrls(markdownImageUrls) {
  for (const url of markdownImageUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch (_err) {
      // Ignore stale object URLs.
    }
  }
  markdownImageUrls.length = 0;
}

export function renderArtifactsManifest(manifestPayload) {
  const summary = $("detail-artifacts-summary");
  const container = $("detail-artifacts-list");
  if (!summary || !container) {
    return;
  }
  const items = Array.isArray(manifestPayload?.items) ? [...manifestPayload.items] : [];
  summary.textContent = items.length > 0 ? `共 ${items.length} 项` : "暂无已登记产物";
  if (items.length === 0) {
    container.innerHTML = '<div class="detail-empty">暂无产物清单</div>';
    return;
  }
  const preferredOrder = [
    "source_pdf",
    "translated_pdf",
    "pdf",
    "typst_render_pdf",
    "markdown_raw",
    "markdown_images_dir",
    "markdown_bundle_zip",
    "normalized_document_json",
    "normalization_report_json",
    "translation_manifest_json",
    "translation_diagnostics_json",
    "translation_debug_index_json",
    "provider_result_json",
    "provider_bundle_zip",
    "provider_raw_dir",
    "pipeline_summary",
    "events_jsonl",
  ];
  const orderMap = new Map(preferredOrder.map((key, index) => [key, index]));
  items.sort((left, right) => {
    const leftOrder = orderMap.has(left?.artifact_key) ? orderMap.get(left.artifact_key) : 999;
    const rightOrder = orderMap.has(right?.artifact_key) ? orderMap.get(right.artifact_key) : 999;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return `${left?.artifact_key || ""}`.localeCompare(`${right?.artifact_key || ""}`);
  });
  container.innerHTML = items.map((item) => {
    const resource = firstNonEmptyText(item?.resource_url, item?.resource_path, item?.relative_path) || "-";
    const readyLabel = item?.ready ? "ready" : "pending";
    const readyClass = item?.ready ? "is-ready" : "is-pending";
    const topLabel = summarizeArtifactLabel(item?.artifact_key);
    const metaBits = [
      firstNonEmptyText(item?.artifact_group) || "-",
      firstNonEmptyText(item?.artifact_kind) || "-",
      formatSizeBytes(item?.size_bytes),
    ];
    const extraBits = [
      firstNonEmptyText(item?.source_stage),
      firstNonEmptyText(item?.content_type),
    ].filter(Boolean);
    return `
      <article class="detail-artifact-row">
        <div class="detail-artifact-top">
          <div class="detail-artifact-key mono">${escapeHtml(topLabel)}</div>
          <span class="detail-artifact-chip ${readyClass}">${escapeHtml(readyLabel)}</span>
        </div>
        <div class="detail-artifact-meta">${escapeHtml(metaBits.join(" · "))}</div>
        ${extraBits.length ? `<div class="detail-artifact-meta">${escapeHtml(extraBits.join(" · "))}</div>` : ""}
        <div class="detail-artifact-meta mono">${escapeHtml(item?.artifact_key || "-")}</div>
        <div class="detail-artifact-meta mono">${escapeHtml(resource)}</div>
      </article>
    `;
  }).join("");
}

export function renderMarkdownContract({
  job,
  markdownPayload = null,
  markdownImageUrls,
  setText,
  setActionLink,
}) {
  const contract = resolveJobMarkdownContract(job);
  const markdownArtifact = job?.artifacts?.markdown || {};
  const rawUrl = firstNonEmptyText(
    markdownPayload?.raw_url,
    markdownPayload?.raw_path,
    markdownArtifact.raw_url,
    markdownArtifact.raw_path,
    job?.actions?.open_markdown_raw?.url,
    job?.actions?.open_markdown_raw?.path,
    contract.rawUrl,
  );
  const jsonUrl = firstNonEmptyText(
    markdownPayload?.json_url,
    markdownPayload?.json_path,
    markdownArtifact.json_url,
    markdownArtifact.json_path,
    job?.actions?.open_markdown?.url,
    job?.actions?.open_markdown?.path,
    contract.jsonUrl,
  );
  const imagesBaseUrl = firstNonEmptyText(
    markdownPayload?.images_base_url,
    markdownPayload?.images_base_path,
    markdownArtifact.images_base_url,
    markdownArtifact.images_base_path,
    job?.artifacts?.markdown_images_base_url,
    contract.imagesBaseUrl,
  );
  const content = typeof markdownPayload?.content === "string" ? markdownPayload.content : "";
  setText("detail-markdown-json-url", jsonUrl || "-");
  setText("detail-markdown-raw-url", rawUrl || "-");
  setText("detail-markdown-images-base-url", imagesBaseUrl || "-");
  setActionLink("detail-markdown-json-btn", jsonUrl, contract.ready && !!jsonUrl);
  setActionLink("detail-markdown-raw-btn", rawUrl, contract.ready && !!rawUrl);
  if (!contract.ready) {
    revokeMarkdownImageUrls(markdownImageUrls);
    setText("detail-markdown-status", "当前任务没有已发布 Markdown");
    setText("detail-markdown-image-count", "0");
    setText("detail-markdown-preview", "-");
    const grid = $("detail-markdown-image-grid");
    grid?.classList.add("hidden");
    if (grid) {
      grid.innerHTML = "";
    }
    $("detail-markdown-image-empty")?.classList.remove("hidden");
    return;
  }
  if (!markdownPayload) {
    setText("detail-markdown-status", "已发布，正在读取内容…");
    return;
  }
  const refs = collectMarkdownImageRefs(content);
  const fileName = firstNonEmptyText(markdownPayload?.file_name, markdownArtifact.file_name);
  const sizeText = formatSizeBytes(markdownPayload?.size_bytes ?? markdownArtifact.size_bytes);
  const statusBits = ["已加载 /markdown JSON"];
  if (fileName) {
    statusBits.push(fileName);
  }
  if (sizeText !== "-") {
    statusBits.push(sizeText);
  }
  setText("detail-markdown-status", statusBits.join(" · "));
  setText("detail-markdown-image-count", `${refs.length}`);
  setText("detail-markdown-preview", truncatePreview(content));
}

export async function renderMarkdownImagePreview({
  markdownPayload,
  imagesBaseUrl,
  markdownImageUrls,
  fetchProtected,
}) {
  const grid = $("detail-markdown-image-grid");
  const empty = $("detail-markdown-image-empty");
  if (!grid || !empty) {
    return;
  }
  revokeMarkdownImageUrls(markdownImageUrls);
  const refs = collectMarkdownImageRefs(markdownPayload?.content);
  if (refs.length === 0 || !imagesBaseUrl) {
    grid.innerHTML = "";
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  const previewRefs = refs.slice(0, 4);
  const previews = await Promise.all(previewRefs.map(async (ref) => {
    const absoluteUrl = resolveMarkdownAssetUrl(imagesBaseUrl, ref);
    if (!absoluteUrl) {
      return { ref, absoluteUrl: "", objectUrl: "", error: "无法解析图片地址" };
    }
    try {
      const resp = await fetchProtected(absoluteUrl);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      markdownImageUrls.push(objectUrl);
      return { ref, absoluteUrl, objectUrl, error: "" };
    } catch (error) {
      return { ref, absoluteUrl, objectUrl: "", error: error.message || "图片读取失败" };
    }
  }));
  grid.innerHTML = previews.map((item) => `
    <article class="detail-markdown-image-card">
      <div class="detail-artifact-meta mono">${escapeHtml(item.ref)}</div>
      ${item.objectUrl
        ? `<img class="detail-markdown-image" src="${escapeHtml(item.objectUrl)}" alt="${escapeHtml(item.ref)}" />`
        : `<div class="detail-empty">${escapeHtml(item.error || "图片不可用")}</div>`}
      <div class="detail-artifact-meta mono">${escapeHtml(item.absoluteUrl || "-")}</div>
    </article>
  `).join("");
  grid.classList.remove("hidden");
  empty.classList.add("hidden");
}

export function resolveMarkdownImagesBaseUrl(job, markdownPayload) {
  return `${markdownPayload?.images_base_url
    || markdownPayload?.images_base_path
    || resolveJobMarkdownContract(job).imagesBaseUrl
    || ""}`.trim();
}

export function isMarkdownReady(job) {
  return Boolean(resolveJobMarkdownContract(job).ready);
}
