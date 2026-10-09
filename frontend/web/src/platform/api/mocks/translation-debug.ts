import {
  getMockTranslationItem,
  getMockTranslationItems,
  getMockTranslationReplay,
  getMockTranslationSummary,
} from "@/platform/mock/translation.js";

export async function fetchTranslationDiagnostics(jobId: string, apiPrefix: string) {
  void apiPrefix;
  return getMockTranslationSummary(jobId);
}

export async function fetchTranslationItems(
  jobId: string,
  apiPrefix: string,
  {
    limit = 20,
    offset = 0,
    page = "",
    finalStatus = "",
    errorType = "",
    route = "",
    q = "",
  }: {
    limit?: number;
    offset?: number;
    page?: string;
    finalStatus?: string;
    errorType?: string;
    route?: string;
    q?: string;
  } = {},
) {
  void apiPrefix;
  void errorType;
  void route;
  return getMockTranslationItems(jobId, { limit, offset, page, finalStatus, q });
}

export async function fetchTranslationItem(jobId: string, itemId: string, apiPrefix: string) {
  void apiPrefix;
  return getMockTranslationItem(jobId, itemId);
}

export async function replayTranslationItem(jobId: string, itemId: string, apiPrefix: string) {
  void apiPrefix;
  return getMockTranslationReplay(jobId, itemId);
}
