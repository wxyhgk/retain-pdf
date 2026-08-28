import { $ } from "../dom/query.js";
import {
  collectMarkdownImageRefs,
  resolveJobMarkdownContract,
  resolveMarkdownAssetUrl,
} from "../job/artifacts.js";

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
  return `${text.slice(0, maxChars)}\n\n...(Xem trước đã cắt bớt)`;
}

function summarizeArtifactLabel(key) {
  switch (`${key || ""}`.trim()) {
    case "source_pdf":
      return "PDF gốc";
    case "translated_pdf":
      return "PDF đã dịch";
    case "typst_render_pdf":
      return "PDF render Typst";
    case "markdown_raw":
      return "Markdown thô";
    case "markdown_images_dir":
      return "Thư mục hình ảnh Markdown";
    case "markdown_bundle_zip":
      return "Gói Markdown";
    case "normalized_document_json":
      return "Tài liệu chuẩn hóa";
    case "normalization_report_json":
      return "Báo cáo chuẩn hóa";
    case "translation_manifest_json":
      return "Bản kê khai dịch thuật";
    case "translation_diagnostics_json":
      return "Chẩn đoán dịch thuật";
    case "translation_debug_index_json":
      return "Chỉ mục gỡ lỗi dịch thuật";
    case "provider_result_json":
      return "Kết quả nhà cung cấp";
    case "provider_bundle_zip":
      return "Gói nhà cung cấp";
    case "provider_raw_dir":
      return "Thư mục thô nhà cung cấp";
    case "pipeline_summary":
      return "Tóm tắt quy trình";
    case "events_jsonl":
      return "Sự kiện JSONL";
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
  summary.textContent = items.length > 0 ? `Tổng ${items.length} mục` : "Chưa có sản phẩm nào";
  if (items.length === 0) {
    container.innerHTML = '<div class="detail-empty">Chưa có danh sách sản phẩm</div>';
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
  const readyLabel = item?.ready ? "sẵn sàng" : "đang chờ";
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
  const previewContent = typeof markdownPayload?.content_with_absolute_image_urls === "string"
    ? markdownPayload.content_with_absolute_image_urls
    : content;
  setText("detail-markdown-json-url", jsonUrl || "-");
  setText("detail-markdown-raw-url", rawUrl || "-");
  setText("detail-markdown-images-base-url", imagesBaseUrl || "-");
  setActionLink("detail-markdown-json-btn", jsonUrl, contract.ready && !!jsonUrl);
  setActionLink("detail-markdown-raw-btn", rawUrl, contract.ready && !!rawUrl);
  if (!contract.ready) {
    revokeMarkdownImageUrls(markdownImageUrls);
    setText("detail-markdown-status", "Nhiệm vụ hiện tại chưa có Markdown nào được xuất bản");
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
    setText("detail-markdown-status", "Đã xuất bản, đang đọc nội dung...");
    return;
  }
  const refs = Array.isArray(markdownPayload?.images) && markdownPayload.images.length > 0
    ? markdownPayload.images.map((item) => item?.path || item?.url).filter(Boolean)
    : collectMarkdownImageRefs(previewContent);
  const fileName = firstNonEmptyText(markdownPayload?.file_name, markdownArtifact.file_name);
  const sizeText = formatSizeBytes(markdownPayload?.size_bytes ?? markdownArtifact.size_bytes);
  const statusBits = [markdownPayload?.content_with_absolute_image_urls ? "Đã tải /markdown/document" : "Đã tải /markdown JSON"];
  if (fileName) {
    statusBits.push(fileName);
  }
  if (sizeText !== "-") {
    statusBits.push(sizeText);
  }
  setText("detail-markdown-status", statusBits.join(" · "));
  setText("detail-markdown-image-count", `${refs.length}`);
  setText("detail-markdown-preview", truncatePreview(previewContent));
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
  const refs = Array.isArray(markdownPayload?.images) && markdownPayload.images.length > 0
    ? markdownPayload.images.map((item) => item?.url || item?.path).filter(Boolean)
    : collectMarkdownImageRefs(markdownPayload?.content_with_absolute_image_urls || markdownPayload?.content);
  if (refs.length === 0 || (!imagesBaseUrl && !Array.isArray(markdownPayload?.images))) {
    grid.innerHTML = "";
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  const previewRefs = refs.slice(0, 4);
  const previews = await Promise.all(previewRefs.map(async (ref) => {
    const absoluteUrl = resolveMarkdownAssetUrl(imagesBaseUrl, ref);
    if (!absoluteUrl) {
       return { ref, absoluteUrl: "", objectUrl: "", error: "Không thể phân giải địa chỉ hình ảnh" };
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
      return { ref, absoluteUrl, objectUrl: "", error: error.message || "Không thể tải hình ảnh" };
    }
  }));
  grid.innerHTML = previews.map((item) => `
    <article class="detail-markdown-image-card">
      <div class="detail-artifact-meta mono">${escapeHtml(item.ref)}</div>
      ${item.objectUrl
        ? `<img class="detail-markdown-image" src="${escapeHtml(item.objectUrl)}" alt="${escapeHtml(item.ref)}" />`
        : `<div class="detail-empty">${escapeHtml(item.error || "Hình ảnh không khả dụng")}</div>`}
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
