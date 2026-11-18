// 产物中心 section 组装：把 source、manifest items 与 Agent 投影归一成
// 按 source/ocr/translation/diagnostics/agent 分组、带可见性过滤的列表。

import type { DocumentJobSummary } from "@/platform/contracts/library-payloads.js";
import type {
  ArtifactCenterGroupId,
  ArtifactCenterItem,
  ArtifactCenterJob,
  ArtifactCenterSection,
  BuildArtifactCenterInput,
} from "./artifact-center-types.js";
import { GROUP_META, groupFor, isDebugArtifact, kindFor, labelFor, previewable } from "./artifact-classification.js";
import { artifactKey, jobAttempt, numberOrNull, text, workflowOf } from "./artifact-values.js";
import { DOWNLOAD_KIND_BY_ARTIFACT_KEY, downloadFileName } from "./download-names.js";

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
    filename: text(input.title) ? downloadFileName(text(input.title), "source") : text(source?.filename) || "原始 PDF",
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

/** 给用户的几类文件写出「下载下来会叫什么」（和后端同一个命名规则）；排查用的文件、
 *  以及不知道书名时，保持存储时的原名。 */
function displayFileName(input: BuildArtifactCenterInput, key: string, stored: string): string {
  const title = text(input.title);
  const kind = DOWNLOAD_KIND_BY_ARTIFACT_KEY[key];
  return title && kind ? downloadFileName(title, kind) : stored;
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
        filename: displayFileName(input, key, text(item.file_name || item.filename) || labelFor(item)),
        kind: kindFor(item),
        url,
        sizeBytes: numberOrNull(item.size_bytes),
        generatedAt: text(item.updated_at || job.updated_at || job.created_at),
        attempt: numberOrNull(item.current_attempt ?? item.attempt) ?? jobAttempt(job),
        jobId,
        workflow: workflowOf(job),
        previewable: previewable(item),
        debug: isDebugArtifact(item),
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
