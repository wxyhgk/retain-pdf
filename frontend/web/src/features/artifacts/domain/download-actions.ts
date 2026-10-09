export {
  DOWNLOAD_ACTION_IDS,
  PROTECTED_ARTIFACT_SELECTOR,
} from "@/platform/contracts/download-action-contract.js";
import {
  DOWNLOAD_ACTION_IDS,
} from "@/platform/contracts/download-action-contract.js";
import type { ArtifactRuntimeState } from "@retainpdf/domain/job";

/** 文件名解析器：PDF 类动作按任务状态解析建议文件名。 */
export type DownloadNameResolver = {
  resolveSourcePdfName: (state: ArtifactRuntimeState, fallbackName: string) => string;
  resolveTranslatedPdfName: (state: ArtifactRuntimeState, fallbackName: string) => string;
};

/** 下载动作描述：fallbackName 必有，preferredName 可选（只有 PDF 类动作会给）。 */
export type DownloadActionSpec = {
  fallbackName: (jobId: string) => string;
  preferredName?: (state: ArtifactRuntimeState, fallbackName: string, resolver: DownloadNameResolver) => string | undefined;
  preferSuggestedName?: boolean;
};

const DOWNLOAD_ACTIONS: Record<string, DownloadActionSpec> = {
  [DOWNLOAD_ACTION_IDS.BUNDLE]: {
    fallbackName: (jobId) => `${jobId}.zip`,
  },
  [DOWNLOAD_ACTION_IDS.MARKDOWN_BUNDLE]: {
    fallbackName: (jobId) => `${jobId}-markdown.zip`,
  },
  [DOWNLOAD_ACTION_IDS.STATUS_MARKDOWN_BUNDLE]: {
    fallbackName: (jobId) => `${jobId}-markdown.zip`,
  },
  [DOWNLOAD_ACTION_IDS.SOURCE_PDF]: {
    fallbackName: (jobId) => `${jobId}-source.pdf`,
    preferredName: (state, fallbackName, resolver) => resolver.resolveSourcePdfName(state, fallbackName),
    preferSuggestedName: true,
  },
  [DOWNLOAD_ACTION_IDS.PDF]: {
    fallbackName: (jobId) => `${jobId}.pdf`,
    preferredName: (state, fallbackName, resolver) => resolver.resolveTranslatedPdfName(state, fallbackName),
    preferSuggestedName: true,
  },
  [DOWNLOAD_ACTION_IDS.MARKDOWN_RAW]: {
    fallbackName: (jobId) => `${jobId}.md`,
  },
  [DOWNLOAD_ACTION_IDS.MARKDOWN_JSON]: {
    fallbackName: (jobId) => `${jobId}.json`,
  },
};

export function downloadActionForLink(link: { id?: string } | null | undefined) {
  return DOWNLOAD_ACTIONS[link?.id || ""] || null;
}

export function resolveDownloadActionTarget({
  action,
  state,
  jobId,
  nameResolver = defaultDownloadNameResolver,
}: {
  action: DownloadActionSpec | null | undefined;
  state: ArtifactRuntimeState;
  jobId?: string;
  nameResolver?: DownloadNameResolver;
}) {
  return resolveDownloadActionTargetWithResolver({
    action,
    state,
    jobId,
    nameResolver,
  });
}

export const defaultDownloadNameResolver: DownloadNameResolver = Object.freeze({
  resolveSourcePdfName: (_state: unknown, fallbackName: string) => fallbackName,
  resolveTranslatedPdfName: (_state: unknown, fallbackName: string) => fallbackName,
});

export function resolveDownloadActionTargetWithResolver({
  action,
  state,
  jobId,
  nameResolver = defaultDownloadNameResolver,
}: {
  action: DownloadActionSpec | null | undefined;
  state: ArtifactRuntimeState;
  jobId?: string;
  nameResolver?: DownloadNameResolver;
}) {
  const normalizedJobId = `${jobId || "result"}`.trim() || "result";
  const fallbackName = action?.fallbackName?.(normalizedJobId) || `${normalizedJobId}.json`;
  const preferredName = action?.preferredName?.(state, fallbackName, nameResolver) || fallbackName;
  return {
    fallbackName,
    preferredName,
    preferSuggestedName: Boolean(action?.preferSuggestedName),
  };
}
