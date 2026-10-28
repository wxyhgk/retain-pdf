// jobs-artifacts — pure (no mock)
import { API_PREFIX } from "./internal/runtime.js";
import * as generated from "./generated/reader-data.js";
import { failWith, orOnStatus } from "./request.js";

// OCR 任务也走 /jobs/:id/…（后端已统一），不再 404 后退到 /ocr/jobs/ 别名。

export type JobArtifactResourceLink = {
  ready?: boolean;
  path?: string;
  url?: string;
  method?: string;
  content_type?: string;
  file_name?: string | null;
  size_bytes?: number | null;
};

export type JobMarkdownArtifactLink = JobArtifactResourceLink & {
  json_path?: string;
  json_url?: string;
  raw_path?: string;
  raw_url?: string;
  images_base_path?: string;
  images_base_url?: string;
};

export type JobArtifactLinks = {
  pdf_ready?: boolean;
  markdown_ready?: boolean;
  bundle_ready?: boolean;
  pdf_url?: string;
  markdown_url?: string;
  bundle_url?: string;
  normalized_document_url?: string;
  normalization_report_url?: string;
  pdf?: JobArtifactResourceLink;
  markdown?: JobMarkdownArtifactLink;
  bundle?: JobArtifactResourceLink;
  normalized_document?: JobArtifactResourceLink;
  normalization_report?: JobArtifactResourceLink;
  [key: string]: unknown;
};

/** /jobs/:id/files 的一个文件。on_demand=true 的（对照 PDF、Word、打包）第一次下载时才生成。 */
export type JobFileEntry = {
  name: string;
  url: string;
  ready: boolean;
  on_demand?: boolean;
  content_type?: string | null;
  size_bytes?: number | null;
  /** 产物登记表里的时间；按需生成、还没生成的为 null。 */
  updated_at?: string | null;
  /** 产出它的阶段（登记表的 source_stage）。 */
  stage?: string | null;
};

/** GET /jobs/:id/files：按成品（output）、页图（pages）、中间产物（internal）列出任务的文件。 */
export type JobFilesView = {
  job_id?: string;
  /** 原文 PDF（属于书，地址在 /documents/:doc/files 下；查不到书的旧任务退回任务自己的地址）。 */
  source?: JobFileEntry | null;
  output?: JobFileEntry[];
  internal?: JobFileEntry[];
  pages?: { page_count?: number; url_template?: string } | null;
  attempt?: number | null;
};

type LegacyArtifactSlot = { key: string; group: string };

// /files 的文件名 → 前端各处认的产物键（以前 artifacts-manifest 的 artifact_key）和分组。
// 详情页、书籍文件页、阅读器都按这个键找文件、起标签、定下载名，所以在这里一次换好，
// 下游不用知道接口换了。表外的新文件照样列出来，键用文件名。
const LEGACY_ARTIFACT_SLOTS: Record<string, LegacyArtifactSlot> = {
  "source.pdf": { key: "source_pdf", group: "source" },
  "translated.pdf": { key: "translated_pdf", group: "rendered" },
  "side-by-side.pdf": { key: "side_by_side_pdf", group: "rendered" },
  "translated.docx": { key: "layout_docx", group: "rendered" },
  "all.zip": { key: "artifact_bundle_zip", group: "bundle" },
  "ocr.md": { key: "markdown_raw", group: "markdown" },
  "ocr.zip": { key: "markdown_bundle_zip", group: "markdown" },
  "normalized-document.json": { key: "normalized_document_json", group: "json" },
  "normalization-report.json": { key: "normalization_report_json", group: "json" },
  "translation-manifest.json": { key: "translation_manifest_json", group: "json" },
  "translation-checkpoint.json": { key: "translation_checkpoint_json", group: "json" },
  "translation-requests.jsonl": { key: "translation_request_journal_jsonl", group: "debug" },
  "render-config.json": { key: "render_config_json", group: "debug" },
  "pipeline-summary.json": { key: "pipeline_summary", group: "debug" },
  "events.jsonl": { key: "events_jsonl", group: "debug" },
  "typst/source.typ": { key: "typst_source", group: "typst" },
  "typst/render.pdf": { key: "typst_render_pdf", group: "typst" },
  "ocr-provider/result.json": { key: "provider_result_json", group: "provider" },
  "ocr-provider/raw.zip": { key: "provider_bundle_zip", group: "provider" },
};

/** 把 /files 摊平成产物清单的形状（{ job_id, items: [{ artifact_key, resource_url, … }] }）。 */
export function jobFilesToArtifactManifest(files: JobFilesView | null | undefined): { job_id?: string; items: any[] } {
  const attempt = typeof files?.attempt === "number" ? files.attempt : null;
  const entries: JobFileEntry[] = [
    ...(files?.source ? [files.source] : []),
    ...(Array.isArray(files?.output) ? files.output : []),
    ...(Array.isArray(files?.internal) ? files.internal : []),
  ];
  const items = entries
    .filter((entry) => entry && typeof entry.name === "string" && entry.name && typeof entry.url === "string")
    .map((entry) => {
      const slot = LEGACY_ARTIFACT_SLOTS[entry.name];
      return {
        artifact_key: slot?.key || entry.name,
        artifact_group: slot?.group || "",
        artifact_kind: "file",
        ready: Boolean(entry.ready),
        on_demand: Boolean(entry.on_demand),
        file_name: entry.name,
        content_type: entry.content_type ?? null,
        size_bytes: entry.size_bytes ?? null,
        updated_at: entry.updated_at ?? null,
        source_stage: entry.stage ?? null,
        attempt,
        resource_url: entry.url,
      };
    });
  return { job_id: files?.job_id, items };
}

export async function fetchJobFiles(jobId: string, apiPrefix = API_PREFIX): Promise<JobFilesView | null> {
  return orOnStatus(
    generated.listJobFiles(apiPrefix, { job_id: jobId }, { onError: failWith("读取任务文件失败，请稍后重试。") }),
    404,
    null,
  );
}

/** 任务的产物清单：读 /jobs/:id/files，换成以前 artifacts-manifest 的形状交给下游。 */
export async function fetchJobArtifactsManifest(jobId: string, apiPrefix = API_PREFIX): Promise<any> {
  return jobFilesToArtifactManifest(await fetchJobFiles(jobId, apiPrefix));
}

// /reader/markdown 是旧 /markdown（JSON）的新地址：字段是旧的超集（job_id、content、raw_url、images_base_url…）。
// 还没有 Markdown 时后端回 404，当作 null。
function readerMarkdown(jobId: string, apiPrefix: string, message: string): Promise<any> {
  return orOnStatus(generated.getReaderMarkdown(apiPrefix, { job_id: jobId }, { onError: failWith(message) }), 404, null);
}

export async function fetchJobMarkdown(jobId: string, apiPrefix = API_PREFIX): Promise<any> {
  return readerMarkdown(jobId, apiPrefix, "读取 Markdown 失败，请稍后重试。");
}
