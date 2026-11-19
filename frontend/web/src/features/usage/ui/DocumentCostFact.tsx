// 书籍详情「概览」信息区里的「花费」：这本书估算花了多少钱（全部任务，加上问这本书时助手花的）。
// 金额是后端按 models.dev 标价估的，不含折扣、包月和代金券，写「约 ¥3.10」（美元按固定汇率折人民币）；不足 1 分写「< ¥0.01」。
// 有查不到价的请求时小字注一句。没有用量、旧后端没这个字段时整项不画。
// 详情页打开时才读；任务列表一变（翻完、重翻）重读。
import { useMemo } from "react";

import { usageCost } from "../domain/usage-view-model.js";
import { useDocumentUsage } from "./use-usage.js";

export function DocumentCostFact({
  open,
  documentId,
  jobs,
}: {
  open: boolean;
  documentId: string;
  jobs: Array<{ job_id?: string; id?: string; status?: string }>;
}) {
  const refreshKey = useMemo(
    () => jobs.map((job) => `${job.job_id || job.id || ""}:${job.status || ""}`).sort().join("|"),
    [jobs],
  );
  const state = useDocumentUsage(documentId, { enabled: open, refreshKey });
  const { cost, notes } = usageCost(state.data);
  if (!cost) return null;
  const unpricedNote = notes.find((note) => note.includes("查不到价"));
  return (
    <div data-book-detail-fact="cost">
      <dt>花费</dt>
      <dd title={[cost.title, ...notes].join("\n")}>
        <span data-usage-cost="total">{cost.text}</span>
        <small>{unpricedNote || "按标价估算"}</small>
      </dd>
    </div>
  );
}
