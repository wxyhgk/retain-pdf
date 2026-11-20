/** 阅读页「对比版本」用的后端能力（包里的 ReaderTranslationVersionsPort）：列这本书的译文版本、按版本取阅读用的任务、设成阅读用的那一份。 */
import type { ReaderTranslationVersionsPort, ReaderVersionOption } from "@retainpdf/reader/contracts";
import {
  fetchDocumentReading,
  fetchTranslationVersions,
  setCurrentTranslationVersion,
  type TranslationVersionView,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

/** 一份版本的名字：用户改过的名字优先，否则后端起的（「精翻 · deepseek-v4-flash」）。 */
function versionName(version: TranslationVersionView): string {
  return `${version.label || ""}`.trim() || `${version.name || ""}`.trim() || version.version_id;
}

export function readerVersionOption(version: TranslationVersionView): ReaderVersionOption {
  return {
    versionId: version.version_id,
    name: versionName(version),
    createdAt: `${version.created_at || ""}`,
    status: `${version.status || ""}`,
    jobIds: Array.isArray(version.job_ids) ? version.job_ids.map((id) => `${id}`) : [],
  };
}

export const translationVersionsPort: ReaderTranslationVersionsPort = {
  // 隐藏的不列；还在跑、失败、取消的也不列（没有能对比的译文）。
  list: async (documentId) => {
    const view = await fetchTranslationVersions(API_PREFIX, documentId);
    return {
      currentVersionId: view.current_version_id ?? null,
      versions: view.versions
        .filter((version: TranslationVersionView) => !version.hidden && version.status === "succeeded")
        .map(readerVersionOption),
    };
  },
  resolveJob: async (documentId, versionId) => {
    const view = await fetchDocumentReading(API_PREFIX, documentId, { version: versionId });
    return `${view?.job_id || ""}`.trim();
  },
  select: async (documentId, versionId) => {
    await setCurrentTranslationVersion(API_PREFIX, documentId, versionId);
  },
};
