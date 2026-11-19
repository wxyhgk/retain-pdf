// 「进度」页加上这本书的模型用量：用量在「进度」页可见时才读，任务跑完或换了任务再读一次。
// 读用量要打接口，页签组件（tabs/）不碰接口，所以在这里接好再交给它。以前用量是右栏单独一个页签。
// 重新翻译换模型时的估价（GET /documents/:id/usage/estimate）也在这里接上，挂到 translation.estimateRetranslate。
import { useCallback } from "react";
import { useDocumentUsage, usageViewModel } from "@/features/usage/index.js";
import { estimateDocumentUsage } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

import { BookDetailProcessingTab } from "./tabs/BookDetailProcessingTab.jsx";
import type { BookDetailProcessingTabProps } from "./tabs/processing-tab-types.js";

export function ProcessingTabWithUsage({
  documentId,
  visible,
  ...props
}: Omit<BookDetailProcessingTabProps, "usage"> & { documentId: string; visible: boolean }) {
  const item = props.translation?.item || {};
  const refreshKey = `${item.job_id || item.active_job_id || ""}:${item.status || ""}`;
  const state = useDocumentUsage(documentId, { enabled: visible, refreshKey });
  const usage = documentId
    ? { model: usageViewModel(state.data), loading: state.loading, error: state.error, reload: state.reload }
    : null;
  const estimateRetranslate = useCallback(
    (baseUrl: string, model: string) => estimateDocumentUsage(documentId, { baseUrl, model }, API_PREFIX),
    [documentId],
  );
  const translation = props.translation && documentId
    ? { ...props.translation, estimateRetranslate }
    : props.translation;
  return <BookDetailProcessingTab {...props} translation={translation} usage={usage} />;
}
