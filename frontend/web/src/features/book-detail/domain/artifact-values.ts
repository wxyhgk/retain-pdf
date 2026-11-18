// 产物中心的低层取值/归一化工具：数字、文本、工作流与产物键。
// 纯函数，供分组、链接合并与 sections 构建共享。

import type { DocumentJobSummary } from "@/platform/contracts/library-payloads.js";
import type { ArtifactManifestItem } from "./artifact-center-types.js";

export function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

export function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function workflowOf(job: DocumentJobSummary): string {
  return text(job.workflow || job.job_type).toLowerCase();
}

export function artifactKey(item: ArtifactManifestItem): string {
  return text(item.artifact_key || item.artifact_kind || item.file_name || item.filename).toLowerCase();
}

export function jobAttempt(job: DocumentJobSummary): number | null {
  return numberOrNull(job.current_attempt ?? job.attempt ?? job.run_attempt);
}
