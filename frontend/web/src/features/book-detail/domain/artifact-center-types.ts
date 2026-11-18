import type { DocumentJobSummary } from "@/platform/contracts/library-payloads.js";

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
  /** 排查用的文件（事件流、请求日志、OCR 原始返回、诊断报告等）：文件页收进默认折叠的「调试文件」。 */
  debug?: boolean;
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
  /** 文件页去重后用：这一组的文件和「翻译与阅读」里的相同，已在那里显示。 */
  mergedIntoTranslation?: boolean;
};

export type ArtifactQuickDownloadId = "source" | "markdown" | "translated" | "comparison" | "word";
export type ArtifactQuickDownloads = Record<ArtifactQuickDownloadId, ArtifactCenterItem | null>;

export type BuildArtifactCenterInput = {
  documentId: string;
  /** 书名（详情页显示的那个）：文件页列表据此写出下载文件名。没有就显示存储时的原名。 */
  title?: string;
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
