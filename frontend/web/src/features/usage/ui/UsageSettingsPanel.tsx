// 设置 ·「总用量」：全部书的 token 用量，按月、按模型、按环节。只统计 token，不估算费用。
import { fetchUsageSummary } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import type { UsageSummaryView } from "@/platform/api/index.js";
import { usageViewModel } from "../domain/usage-view-model.js";
import { UsageSummary } from "./UsageSummary.jsx";
import { useUsage } from "./use-usage.js";

export function UsageSettingsPanel({
  load = () => fetchUsageSummary(API_PREFIX),
}: {
  load?: () => Promise<UsageSummaryView>;
}) {
  const state = useUsage("all", load);
  const model = usageViewModel(state.data);
  return (
    <div className="usage-settings" data-usage-settings="true">
      {state.loading && !state.data ? <p className="usage-empty">正在读取用量…</p> : null}
      {state.error ? (
        <p className="usage-empty" role="alert">
          {state.error}
          <button type="button" className="usage-retry" onClick={state.reload}>重试</button>
        </p>
      ) : null}
      {!state.loading && !state.error && model.empty ? <p className="usage-empty">还没有用量记录。</p> : null}
      {!model.empty ? (
        <>
          {model.summaryLine ? <p className="usage-settings-sub">{model.summaryLine}</p> : null}
          <UsageSummary model={model} show={["months", "models", "stages"]} />
        </>
      ) : null}
      <p className="usage-settings-foot">只统计模型 token，不估算费用；删除的书不计入。</p>
    </div>
  );
}
