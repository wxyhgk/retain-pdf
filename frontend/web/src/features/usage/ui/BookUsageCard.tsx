// 书籍详情 · 概览里的「用量」卡：这本书的全部任务，加上问这本书时助手花的 token。
import { Coins } from "lucide-react";

import { fetchDocumentUsage } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import type { UsageSummaryView } from "@/platform/api/index.js";
import { usageViewModel } from "../domain/usage-view-model.js";
import { UsageSummary } from "./UsageSummary.jsx";
import { useUsage } from "./use-usage.js";

export function BookUsageCard({
  documentId,
  load = (id: string) => fetchDocumentUsage(id, API_PREFIX),
}: {
  documentId: string;
  load?: (documentId: string) => Promise<UsageSummaryView>;
}) {
  const state = useUsage(documentId, () => load(documentId));
  const model = usageViewModel(state.data);
  return (
    <section className="book-detail-overview-card usage-card" aria-label="用量" data-book-usage="true">
      <div className="book-detail-overview-card-heading">
        <h3><Coins aria-hidden="true" />用量</h3>
        {model.summaryLine ? <span className="usage-card-sub">{model.summaryLine}</span> : null}
      </div>
      {state.loading && !state.data ? <p className="usage-empty">正在读取用量…</p> : null}
      {state.error ? (
        <p className="usage-empty" role="alert">
          {state.error}
          <button type="button" className="usage-retry" onClick={state.reload}>重试</button>
        </p>
      ) : null}
      {!state.loading && !state.error && model.empty ? <p className="usage-empty">这本书还没有用量记录。</p> : null}
      {!model.empty ? <UsageSummary model={model} show={["stages"]} /> : null}
    </section>
  );
}
