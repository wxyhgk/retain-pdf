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

/** mock：改单条译文总是成功，原样回显新译文（不重排版）。 */
export async function reviseTranslationItem(
  jobId: string,
  itemId: string,
  body: { translated_text: string },
  apiPrefix?: string,
) {
  void apiPrefix;
  return {
    job_id: jobId,
    item_id: itemId,
    changed: true,
    generation: 1,
    item: { item_id: itemId, page_idx: 0, translation_unit_id: itemId, unit_source_text: "", translated_text: body.translated_text, protected_translated_text: body.translated_text, final_status: "translated" },
    validation: { passed: true, error_count: 0, warning_count: 0, issues: [] },
    revision: null,
    page_hashes: {},
    live_publication: { status: "unavailable", pages: [], error: null },
    rerender: null,
    rerender_error: null,
  };
}
