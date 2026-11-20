// 「进度」页加上这一次任务的模型用量（GET /jobs/:id/reports/usage）：「进度」页可见时才读，任务跑完或换了任务再读一次。
// 2026-11-20 以前读的是整本书的合计（GET /documents/:id/usage），跑过 10 次的书顶上写 1040 万 token / ¥15.58，
// 这一次其实只花了 76 万 / ¥1，看着像估价错了。全书累计放在「概览」的「花费」。
// 读用量要打接口，页签组件（tabs/）不碰接口，所以在这里接好再交给它。以前用量是右栏单独一个页签。
// 重新翻译换模型时的估价（GET /documents/:id/usage/estimate）也在这里接上，挂到 translation.estimateRetranslate。
import { useCallback } from "react";
import { useJobUsage, usageViewModel } from "@/features/usage/index.js";
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
  const rawJobId = `${item.job_id || item.active_job_id || ""}`.trim();
  // 「doc:」开头的是还没建任务时的占位编号，没有用量可读。
  const jobId = rawJobId.startsWith("doc:") ? "" : rawJobId;
  const state = useJobUsage(jobId, { enabled: visible, refreshKey: `${item.status || ""}` });
  const usage = jobId
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
