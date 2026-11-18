// 产物下载 URL 解析与细清单补全：把 /artifacts 的稳定发布链接
// 合并进后端 manifest，供产物中心下载/预览使用。

import type { DocumentJobSummary } from "@/platform/contracts/library-payloads.js";
import type {
  ArtifactLinks,
  ArtifactManifest,
  ArtifactResourceLink,
} from "./artifact-center-types.js";
import { artifactKey, jobAttempt, numberOrNull, text, workflowOf } from "./artifact-values.js";

function resolvedResourceUrl(resource: ArtifactResourceLink | undefined, fallback: unknown): string {
  return text(resource?.url || resource?.path || fallback);
}

/**
 * 同一个任务的另一个成品文件（`/jobs/{id}/files/output/{name}`）：从后端给的译文 PDF 链接里找到
 * `/jobs/{id}` 这一段、截到这里，后面接文件地址。旧链接（`…/jobs/{id}/pdf`）和新链接
 * （`…/jobs/{id}/files/output/translated.pdf`）都能推对，域名 / 前缀和后端给的一致。
 * 对照版和 Word 以前的旧地址默认就是下载，新地址默认在浏览器里打开，所以带 `?download=1`。
 */
function jobOutputFileUrl(pdfUrl: string, jobId: string, name: string): string {
  const clean = pdfUrl.split("?")[0].replace(/\/$/, "");
  if (!clean || !jobId) return "";
  const marker = `/jobs/${encodeURIComponent(jobId)}`;
  const at = clean.indexOf(`${marker}/`);
  if (at < 0) return "";
  return `${clean.slice(0, at + marker.length)}/files/output/${name}?download=1`;
}

/**
 * Completes a detailed manifest with the stable published links also used by
 * Reader. Some older successful jobs legitimately have an empty detailed
 * manifest while /artifacts still advertises working downloads.
 */
export function mergeArtifactLinksIntoManifest(
  job: DocumentJobSummary,
  manifest: ArtifactManifest | null | undefined,
  links: ArtifactLinks | null | undefined,
): ArtifactManifest {
  const jobId = text(job.job_id);
  const generatedAt = text(job.updated_at || job.created_at);
  const attempt = jobAttempt(job);
  const items = [...(Array.isArray(manifest?.items) ? manifest.items : [])];

  const add = (
    artifactKeyValue: string,
    ready: boolean,
    url: string,
    fileName: string,
    contentType: string,
    sizeBytes?: number | null,
  ) => {
    if (!ready || !url) return;
    const alreadyDownloadable = items.some((item) => (
      artifactKey(item) === artifactKeyValue
      && Boolean(item.ready)
      && Boolean(text(item.resource_url || item.resource_path))
    ));
    if (alreadyDownloadable) return;
    items.push({
      artifact_key: artifactKeyValue,
      artifact_kind: "file",
      ready: true,
      file_name: fileName,
      content_type: contentType,
      size_bytes: sizeBytes ?? null,
      updated_at: generatedAt,
      attempt,
      resource_url: url,
    });
  };

  if (!links) return { ...(manifest || {}), job_id: manifest?.job_id || jobId, items };

  const workflow = workflowOf(job);
  const markdownUrl = text(links.markdown?.raw_url || links.markdown?.raw_path || links.markdown_url);
  const pdfUrl = resolvedResourceUrl(links.pdf, links.pdf_url);
  const bundleUrl = resolvedResourceUrl(links.bundle, links.bundle_url);
  const normalizedUrl = resolvedResourceUrl(links.normalized_document, links.normalized_document_url);
  const reportUrl = resolvedResourceUrl(links.normalization_report, links.normalization_report_url);
  const markdownReady = Boolean(links.markdown?.ready ?? links.markdown_ready);
  const pdfReady = Boolean(links.pdf?.ready ?? links.pdf_ready);
  const bundleReady = Boolean(links.bundle?.ready ?? links.bundle_ready);
  const isTranslation = ["book", "translate", "translation", "render"].includes(workflow);

  add(
    "markdown_raw",
    markdownReady,
    markdownUrl,
    text(links.markdown?.file_name) || `${jobId || "document"}.md`,
    "text/markdown",
    numberOrNull(links.markdown?.size_bytes),
  );
  add(
    "normalized_document_json",
    Boolean(links.normalized_document?.ready),
    normalizedUrl,
    text(links.normalized_document?.file_name) || "document.v1.json",
    "application/json",
    numberOrNull(links.normalized_document?.size_bytes),
  );
  add(
    "normalization_report_json",
    Boolean(links.normalization_report?.ready),
    reportUrl,
    text(links.normalization_report?.file_name) || "normalization-report.json",
    "application/json",
    numberOrNull(links.normalization_report?.size_bytes),
  );
  add(
    "translated_pdf",
    isTranslation && pdfReady,
    pdfUrl,
    text(links.pdf?.file_name) || `${jobId || "document"}-translated.pdf`,
    "application/pdf",
    numberOrNull(links.pdf?.size_bytes),
  );
  add(
    "side_by_side_pdf",
    isTranslation && pdfReady,
    jobOutputFileUrl(pdfUrl, jobId, "side-by-side.pdf"),
    `${jobId || "document"}-side-by-side.pdf`,
    "application/pdf",
  );
  add(
    "layout_docx",
    isTranslation && pdfReady,
    jobOutputFileUrl(pdfUrl, jobId, "translated.docx"),
    `${jobId || "document"}-layout.docx`,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  add(
    "artifact_bundle_zip",
    bundleReady,
    bundleUrl,
    text(links.bundle?.file_name) || `${jobId || "document"}.zip`,
    "application/zip",
    numberOrNull(links.bundle?.size_bytes),
  );

  return { ...(manifest || {}), job_id: manifest?.job_id || jobId, items };
}
