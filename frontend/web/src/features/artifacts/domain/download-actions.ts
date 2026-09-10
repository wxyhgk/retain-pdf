export {
  DOWNLOAD_ACTION_IDS,
  PROTECTED_ARTIFACT_SELECTOR,
} from "@/platform/contracts/download-action-contract.js";
import {
  DOWNLOAD_ACTION_IDS,
} from "@/platform/contracts/download-action-contract.js";

const DOWNLOAD_ACTIONS = {
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

export function downloadActionForLink(link) {
  return DOWNLOAD_ACTIONS[link?.id || ""] || null;
}

export function resolveDownloadActionTarget({
  action,
  state,
  jobId,
  nameResolver = defaultDownloadNameResolver,
}: any) {
  return resolveDownloadActionTargetWithResolver({
    action,
    state,
    jobId,
    nameResolver,
  });
}

export const defaultDownloadNameResolver = Object.freeze({
  resolveSourcePdfName: (_state, fallbackName) => fallbackName,
  resolveTranslatedPdfName: (_state, fallbackName) => fallbackName,
});

export function resolveDownloadActionTargetWithResolver({
  action,
  state,
  jobId,
  nameResolver = defaultDownloadNameResolver,
}: any) {
  const normalizedJobId = `${jobId || "result"}`.trim() || "result";
  const fallbackName = action?.fallbackName?.(normalizedJobId) || `${normalizedJobId}.json`;
  const preferredName = action?.preferredName?.(state, fallbackName, nameResolver) || fallbackName;
  return {
    fallbackName,
    preferredName,
    preferSuggestedName: Boolean(action?.preferSuggestedName),
  };
}
