// 上次精修的结果 → 「重新处理」里精修那一行下面的一句话。纯函数，单测直接覆盖。

import type { LastRefineView } from "@retainpdf/api/jobs-actions";

const STOP_LABELS: Record<string, string> = {
  max_items: "达到块数上限",
  max_tokens: "达到用量上限",
  llm_unavailable: "没有可用的模型",
  llm_error: "模型调用失败",
  error: "出错",
};

/** 没审完时从哪一页接着精修；审完了为 null。 */
export function refineContinuePage(last: LastRefineView | null | undefined): number | null {
  const page = Number(last?.next_page);
  return Number.isInteger(page) && page >= 1 ? page : null;
}

export function describeLastRefine(last: LastRefineView | null | undefined): string {
  if (!last) return "";
  const result = `发现 ${last.finding_count || 0} 处，改了 ${last.applied || 0} 处`;
  if (last.status === "failed") return `上次精修出错，没有做完（${result}）。`;
  const page = refineContinuePage(last);
  if (page) {
    const reason = STOP_LABELS[`${last.stopped_reason || ""}`] || "没有审完";
    const left = last.unreviewed_item_count || 0;
    return `上次精修只审到第 ${page} 页之前（${reason}，还有 ${left} 块没审）：${result}。`;
  }
  return `上次精修审完了全书：${result}。`;
}
