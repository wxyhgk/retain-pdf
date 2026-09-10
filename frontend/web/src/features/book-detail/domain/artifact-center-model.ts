import type { DocumentJobSummary } from "@/features/library/domain.js";

export type ArtifactCenterGroupId = "source" | "ocr" | "translation" | "diagnostics" | "agent";

export type ArtifactManifestItem = {
  artifact_key?: string;
  artifact_group?: string;
  artifact_kind?: string;
  ready?: boolean;
  file_name?: string | null;
  filename?: string | null;
  content_type?: string;
  size_bytes?: number | null;
  updated_at?: string | null;
  resource_url?: string | null;
  resource_path?: string | null;
  attempt?: number | null;
  current_attempt?: number | null;
  [key: string]: unknown;
};

export type ArtifactManifest = {
  job_id?: string;
  items?: ArtifactManifestItem[];
};

export type ArtifactResourceLink = {
  ready?: boolean;
  path?: string;
  url?: string;
  file_name?: string | null;
  size_bytes?: number | null;
};

export type ArtifactLinks = {
  pdf_ready?: boolean;
  markdown_ready?: boolean;
  bundle_ready?: boolean;
  pdf_url?: string;
  markdown_url?: string;
  bundle_url?: string;
  normalized_document_url?: string;
  normalization_report_url?: string;
  pdf?: ArtifactResourceLink;
  markdown?: ArtifactResourceLink & {
    raw_path?: string;
    raw_url?: string;
  };
  bundle?: ArtifactResourceLink;
  normalized_document?: ArtifactResourceLink;
  normalization_report?: ArtifactResourceLink;
};

export type ArtifactCenterItem = {
  id: string;
  group: ArtifactCenterGroupId;
  label: string;
  filename: string;
  kind: string;
  url: string;
  sizeBytes: number | null;
  generatedAt: string;
  attempt: number | null;
  jobId: string;
  workflow: string;
  previewable: boolean;
};

export type ArtifactCenterJob = {
  jobId: string;
  workflow: string;
  status: string;
  generatedAt: string;
  attempt: number | null;
  previewable: boolean;
};

export type AgentArtifactProjection = {
  operation_id?: string;
  status?: string;
  current_attempt?: number;
  updated_at?: string;
  candidate?: {
    version_id?: string;
    url?: string;
  } | null;
};

export type ArtifactCenterSection = {
  id: ArtifactCenterGroupId;
  label: string;
  description: string;
  items: ArtifactCenterItem[];
  jobs: ArtifactCenterJob[];
};

export type ArtifactQuickDownloadId = "source" | "markdown" | "translated" | "comparison";
export type ArtifactQuickDownloads = Record<ArtifactQuickDownloadId, ArtifactCenterItem | null>;

export type BuildArtifactCenterInput = {
  documentId: string;
  source?: {
    filename?: string;
    url?: string;
    sizeBytes?: number | null;
    generatedAt?: string;
  } | null;
  jobs?: DocumentJobSummary[];
  manifests?: Record<string, ArtifactManifest | null | undefined>;
  agentOperations?: AgentArtifactProjection[];
};

const GROUP_META: Record<ArtifactCenterGroupId, { label: string; description: string }> = {
  source: { label: "原始文件", description: "入库时保存的 PDF" },
  ocr: { label: "OCR 与结构化", description: "识别正文、Markdown、表格与结构化数据" },
  translation: { label: "翻译与阅读", description: "译文、对照文件与任务包" },
  diagnostics: { label: "诊断与报告", description: "后端实际生成的处理报告" },
  agent: { label: "Agent 版本", description: "候选文件与已应用版本" },
};

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function workflowOf(job: DocumentJobSummary): string {
  return text(job.workflow || job.job_type).toLowerCase();
}

function artifactKey(item: ArtifactManifestItem): string {
  return text(item.artifact_key || item.artifact_kind || item.file_name || item.filename).toLowerCase();
}

function isDiagnosticArtifact(item: ArtifactManifestItem): boolean {
  const key = `${artifactKey(item)} ${text(item.artifact_group)}`;
  return /(diagnostic|report|summary|failure|error|log|trace)/.test(key);
}

function groupFor(job: DocumentJobSummary, item: ArtifactManifestItem): ArtifactCenterGroupId {
  if (isDiagnosticArtifact(item)) return "diagnostics";
  const workflow = workflowOf(job);
  return workflow === "ocr" ? "ocr" : "translation";
}

function labelFor(item: ArtifactManifestItem): string {
  const key = artifactKey(item);
  if (/side.by.side|comparison|bilingual/.test(key)) return "对照 PDF";
  if (/translated.pdf|output.pdf|result.pdf|^pdf$/.test(key)) return "译文 PDF";
  if (/normalized.document/.test(key)) return "结构化文档";
  if (/normalization.report/.test(key)) return "识别报告";
  if (/markdown.*bundle|bundle.*markdown/.test(key)) return "Markdown 任务包";
  if (/bundle|archive|zip/.test(key)) return "完整任务包";
  if (/markdown/.test(key)) return "Markdown";
  if (/diagnostic/.test(key)) return "诊断报告";
  if (/report/.test(key)) return "处理报告";
  if (/summary/.test(key)) return "处理摘要";
  return text(item.file_name || item.filename) || text(item.artifact_key) || "任务产物";
}

function kindFor(item: ArtifactManifestItem): string {
  const explicit = text(item.artifact_kind).toUpperCase();
  if (explicit && explicit !== "FILE") return explicit;
  const name = text(item.file_name || item.filename || item.artifact_key);
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1];
  if (extension) return extension.toUpperCase();
  const contentType = text(item.content_type);
  if (contentType.includes("pdf")) return "PDF";
  if (contentType.includes("json")) return "JSON";
  if (contentType.includes("markdown")) return "MD";
  return explicit || "FILE";
}

function previewable(item: ArtifactManifestItem): boolean {
  const key = artifactKey(item);
  return /(pdf|markdown|normalized.document)/.test(key);
}

function jobAttempt(job: DocumentJobSummary): number | null {
  return numberOrNull(job.current_attempt ?? job.attempt ?? job.run_attempt);
}

function resolvedResourceUrl(resource: ArtifactResourceLink | undefined, fallback: unknown): string {
  return text(resource?.url || resource?.path || fallback);
}

function sideBySideUrl(pdfUrl: string): string {
  const clean = pdfUrl.split("?")[0].replace(/\/$/, "");
  return clean ? `${clean}/side-by-side` : "";
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
    sideBySideUrl(pdfUrl),
    `${jobId || "document"}-side-by-side.pdf`,
    "application/pdf",
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

function buildJob(job: DocumentJobSummary): ArtifactCenterJob | null {
  const jobId = text(job.job_id);
  if (!jobId || jobId.startsWith("doc:")) return null;
  const workflow = workflowOf(job);
  const status = text(job.status).toLowerCase();
  return {
    jobId,
    workflow,
    status,
    generatedAt: text(job.updated_at || job.created_at),
    attempt: jobAttempt(job),
    previewable: status === "succeeded" && ["ocr", "book", "translate", "translation", "render"].includes(workflow),
  };
}

function sourceItem(input: BuildArtifactCenterInput): ArtifactCenterItem | null {
  const source = input.source;
  const url = text(source?.url);
  if (!input.documentId || !url) return null;
  return {
    id: `source:${input.documentId}`,
    group: "source",
    label: "原始 PDF",
    filename: text(source?.filename) || "原始 PDF",
    kind: "PDF",
    url,
    sizeBytes: numberOrNull(source?.sizeBytes),
    generatedAt: text(source?.generatedAt),
    attempt: null,
    jobId: "",
    workflow: "source",
    previewable: true,
  };
}

export function buildArtifactCenterSections(input: BuildArtifactCenterInput): ArtifactCenterSection[] {
  const jobs = (input.jobs || []).map(buildJob).filter(Boolean) as ArtifactCenterJob[];
  const items: ArtifactCenterItem[] = [];
  const source = sourceItem(input);
  if (source) items.push(source);

  for (const job of input.jobs || []) {
    const jobId = text(job.job_id);
    if (!jobId) continue;
    const manifest = input.manifests?.[jobId];
    for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {
      const key = artifactKey(item);
      const url = text(item.resource_url || item.resource_path);
      const artifactKind = text(item.artifact_kind).toLowerCase();
      if (
        !item.ready
        || !key
        || !url
        || key === "source_pdf"
        || url.endsWith("/")
        || artifactKind === "dir"
        || artifactKind === "directory"
      ) continue;
      const group = groupFor(job, item);
      items.push({
        id: `${jobId}:${key}`,
        group,
        label: labelFor(item),
        filename: text(item.file_name || item.filename) || labelFor(item),
        kind: kindFor(item),
        url,
        sizeBytes: numberOrNull(item.size_bytes),
        generatedAt: text(item.updated_at || job.updated_at || job.created_at),
        attempt: numberOrNull(item.current_attempt ?? item.attempt) ?? jobAttempt(job),
        jobId,
        workflow: workflowOf(job),
        previewable: previewable(item),
      });
    }
  }

  for (const operation of input.agentOperations || []) {
    const operationId = text(operation.operation_id);
    const url = text(operation.candidate?.url);
    if (!operationId || !url) continue;
    const status = text(operation.status).toLowerCase();
    items.push({
      id: `agent:${operationId}:${text(operation.candidate?.version_id) || status}`,
      group: "agent",
      label: status === "committed" ? "已应用版本" : "候选 PDF",
      filename: `${text(operation.candidate?.version_id) || operationId}.pdf`,
      kind: "PDF",
      url,
      sizeBytes: null,
      generatedAt: text(operation.updated_at),
      attempt: numberOrNull(operation.current_attempt),
      jobId: "",
      workflow: "agent",
      previewable: false,
    });
  }

  const sectionOrder: ArtifactCenterGroupId[] = ["source", "ocr", "translation", "diagnostics", "agent"];
  return sectionOrder.map((id) => ({
    id,
    ...GROUP_META[id],
    items: items.filter((item) => item.group === id),
    jobs: id === "ocr"
      ? jobs.filter((job) => job.workflow === "ocr")
      : id === "translation"
        ? jobs.filter((job) => ["book", "translate", "translation", "render"].includes(job.workflow))
        : [],
  })).filter((section) => section.items.length > 0 || section.jobs.length > 0);
}

function latestArtifact(items: ArtifactCenterItem[]): ArtifactCenterItem | null {
  if (!items.length) return null;
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.generatedAt || "") || 0;
    const rightTime = Date.parse(right.generatedAt || "") || 0;
    return rightTime - leftTime;
  })[0] || null;
}

/** 常用下载只投影四种稳定入口；完整产物仍由文件 Tab 展示。 */
export function selectArtifactQuickDownloads(
  sections: ArtifactCenterSection[] = [],
): ArtifactQuickDownloads {
  const items = sections.flatMap((section) => section.items);
  const byLabel = (label: string) => latestArtifact(items.filter((item) => item.label === label));
  return {
    source: latestArtifact(items.filter((item) => item.group === "source" && item.kind === "PDF")),
    markdown: byLabel("Markdown") || latestArtifact(items.filter((item) => item.label.startsWith("Markdown"))),
    translated: byLabel("译文 PDF"),
    comparison: byLabel("对照 PDF"),
  };
}

export function formatArtifactBytes(value: number | null): string {
  if (value == null) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatArtifactTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
