// 把 UsageSummaryView（契约 token-usage.v1）整理成界面要显示的几块：主要数字、按阶段分组、按模型、按月。
// 只统计 token，不估算费用。显示规则：
// - 缓存命中率 = cache_hit_tokens / cache_reported_input_tokens；分母为 0 写「未报」（千问等服务商不报缓存）；
// - 思考为 0 写「—」；缓存写入只有 Anthropic 才有，非 0 才显示；
// - 有请求服务商没报用量、有任务按旧报告折算时各注明一句。
import type { UsageSummaryView } from "@/platform/api/index.js";
import { cacheHitRate, formatPercent, formatTokenCount, formatTokenCountExact } from "@/platform/utils/token-count.js";

type Bucket = UsageSummaryView["totals"];

export type UsageMetric = {
  key: string;
  label: string;
  value: string;
  /** 悬停显示的精确值；没有数字（「未报」「—」）时为空。 */
  exact: string;
  note: string;
  emphasis?: boolean;
};

export type UsageRow = { key: string; label: string; hint: string; value: string; exact: string; share: number };

export type UsageGroup = { key: string; label: string; value: string; exact: string; rows: UsageRow[] };

export type UsageViewModel = {
  empty: boolean;
  metrics: UsageMetric[];
  notes: string[];
  stageGroups: UsageGroup[];
  models: UsageRow[];
  months: UsageRow[];
  summaryLine: string;
};

const GROUP_LABELS: Record<string, string> = {
  translation: "翻译",
  preparation: "译前准备",
  refine: "精修与编辑部",
  assistant: "助手",
  other: "其它",
};
const GROUP_ORDER = ["translation", "preparation", "refine", "assistant", "other"] as const;

function n(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function usageMetrics(totals: Bucket): UsageMetric[] {
  const rate = cacheHitRate(totals);
  const metrics: UsageMetric[] = [
    { key: "input", label: "输入", value: formatTokenCount(totals.input_tokens), exact: formatTokenCountExact(totals.input_tokens), note: "" },
    { key: "output", label: "输出", value: formatTokenCount(totals.output_tokens), exact: formatTokenCountExact(totals.output_tokens), note: "" },
    rate === null
      ? { key: "cache", label: "缓存命中", value: "未报", exact: "", note: "服务商没报缓存" }
      : {
          key: "cache",
          label: "缓存命中",
          value: formatTokenCount(totals.cache_hit_tokens),
          exact: formatTokenCountExact(totals.cache_hit_tokens),
          note: `命中率 ${formatPercent(rate)}`,
        },
    n(totals.reasoning_tokens)
      ? { key: "reasoning", label: "思考", value: formatTokenCount(totals.reasoning_tokens), exact: formatTokenCountExact(totals.reasoning_tokens), note: "含在输出里" }
      : { key: "reasoning", label: "思考", value: "—", exact: "", note: "" },
  ];
  if (n(totals.cache_write_tokens)) {
    metrics.push({
      key: "cache_write",
      label: "缓存写入",
      value: formatTokenCount(totals.cache_write_tokens),
      exact: formatTokenCountExact(totals.cache_write_tokens),
      note: "含在输入里",
    });
  }
  metrics.push({
    key: "total",
    label: "合计",
    value: formatTokenCount(totals.total_tokens),
    exact: formatTokenCountExact(totals.total_tokens),
    note: `${formatTokenCountExact(totals.requests)} 次请求`,
    emphasis: true,
  });
  return metrics;
}

function row(key: string, label: string, hint: string, bucket: Bucket, max: number): UsageRow {
  return {
    key,
    label,
    hint,
    value: formatTokenCount(bucket.total_tokens),
    exact: formatTokenCountExact(bucket.total_tokens),
    share: max ? n(bucket.total_tokens) / max : 0,
  };
}

function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  return match ? `${match[1]} 年 ${Number(match[2])} 月` : month;
}

export function usageViewModel(view: UsageSummaryView | null | undefined): UsageViewModel {
  const totals = view?.totals;
  if (!view || !totals || (!n(totals.total_tokens) && !n(view.jobs_counted))) {
    return { empty: true, metrics: [], notes: [], stageGroups: [], models: [], months: [], summaryLine: "" };
  }
  const notes: string[] = [];
  if (n(totals.requests_without_usage)) notes.push(`有 ${formatTokenCountExact(totals.requests_without_usage)} 次请求服务商没报用量，没算进来。`);
  if (n(view.jobs_estimated_from_reports)) {
    notes.push(`其中 ${view.jobs_estimated_from_reports} 个早期任务按报告估算，没有缓存与思考明细。`);
  }

  const stages = view.by_stage || [];
  const stageMax = Math.max(0, ...stages.map((stage) => n(stage.total_tokens)));
  // 组按用量从大到小，组内沿用后端的顺序（已按用量排好）。
  const stageGroups = GROUP_ORDER
    .map((group) => {
      const items = stages.filter((stage) => (GROUP_LABELS[stage.group] ? stage.group : "other") === group);
      return { group, items, total: items.reduce((sum, stage) => sum + n(stage.total_tokens), 0) };
    })
    .filter(({ items }) => items.length)
    .sort((a, b) => b.total - a.total)
    .map(({ group, items, total }): UsageGroup => ({
      key: group,
      label: GROUP_LABELS[group],
      value: formatTokenCount(total),
      exact: formatTokenCountExact(total),
      rows: items.map((stage) => row(stage.stage, stage.label || stage.stage, "", stage, stageMax)),
    }));

  const models = view.by_model || [];
  const modelMax = Math.max(0, ...models.map((model) => n(model.total_tokens)));
  const months = view.by_month || [];
  const monthMax = Math.max(0, ...months.map((month) => n(month.total_tokens)));

  return {
    empty: false,
    metrics: usageMetrics(totals),
    notes,
    stageGroups,
    models: models.map((model) => row(`${model.model}@${model.host}`, model.model || "未知模型", model.host || "", model, modelMax)),
    months: months.map((month) => row(month.month, monthLabel(month.month), "", month, monthMax)),
    summaryLine: view.scope === "job" ? "" : `计入 ${view.jobs_counted} 个任务`,
  };
}
