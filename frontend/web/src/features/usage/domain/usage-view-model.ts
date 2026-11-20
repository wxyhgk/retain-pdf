// 把 UsageSummaryView（契约 token-usage.v1）整理成界面要显示的几块：主要数字、按阶段分组、按模型、按月。
// 花费是后端按 models.dev 标价估的（estimated_cost_usd，2026-11-19 加），不含折扣、包月和代金券；界面按人民币显示（按后端 pricing.usd_cny 折算），写成「约 ¥3.10」。显示规则：
// - 缓存命中率 = cache_hit_tokens / cache_reported_input_tokens；分母为 0 写「未报」（千问等服务商不报缓存）；
// - 思考为 0 写「—」；缓存写入只有 Anthropic 才有，非 0 才显示；
// - 有请求服务商没报用量、有任务按旧报告折算时各注明一句。
import { modelLogoFor, vendorLogoForBaseUrl, type BrandLogo } from "@/platform/config/brand-logos.js";
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
  /** 悬停的整句；不给就按「名字 · 精确值 token · 说明」拼。 */
  title?: string;
};

export type UsageRow = {
  key: string; label: string; hint: string; value: string; exact: string; share: number;
  /** 按模型那一栏：模型家族的标志，认不出模型就按接口主机认厂商（platform/config/brand-logos.ts）。 */
  logo?: BrandLogo | null;
};

export type UsageGroup = {
  key: string;
  label: string;
  value: string;
  exact: string;
  /** 占最大一组的比例（0–1），画条形用。 */
  share: number;
  /** 这一组的 token 数（几组相加时用）。 */
  total: number;
  /** 这一组的估算花费（「约 ¥2.23」）；后端没给或为 0 是空串。 */
  cost: string;
  rows: UsageRow[];
};

/** 估算花费：画面上「约 ¥3.10」，悬停是精确值和怎么估的。 */
export type UsageCost = { text: string; title: string };

export type UsageViewModel = {
  empty: boolean;
  /** 估算花了多少；旧后端没这个字段、或者一分钱都没花（也没有查不到价的）时为 null。 */
  cost: UsageCost | null;
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

/**
 * 后端给的是美元（models.dev 的价目是美元），界面按人民币显示。汇率用后端价目里的 pricing.usd_cny
 * （写死 7.16，和 models.dev 换算国内站价格用的一致）；旧后端没这个字段时用这个默认值。
 * 金额本来就是按标价的粗估，汇率差几分不影响「大概花了多少」；悬停里写着原始美元和汇率。
 */
export const DEFAULT_USD_TO_CNY = 7.16;

export function usdToCnyRate(view: { pricing?: { usd_cny?: number | null } | null } | null | undefined): number {
  return n(view?.pricing?.usd_cny) || DEFAULT_USD_TO_CNY;
}

/** 人民币金额：不足 1 分写「< ¥0.01」，100 元以下两位小数，再大取整。0 或没给是空串。 */
export function formatCny(cnyValue: unknown): string {
  const cny = n(cnyValue);
  if (!cny) return "";
  if (cny < 0.01) return "< ¥0.01";
  if (cny < 100) return `约 ¥${cny.toFixed(2)}`;
  return `约 ¥${Math.round(cny).toLocaleString("en-US")}`;
}

/** 美元金额按汇率折成人民币再写。 */
export function formatCost(usdValue: unknown, rate = DEFAULT_USD_TO_CNY): string {
  return formatCny(n(usdValue) * rate);
}

export function costBasis(rate = DEFAULT_USD_TO_CNY): string {
  return `按 models.dev 的标价估算、1 美元按 ${rate} 元折算，不含折扣、包月和代金券`;
}

/** 花费和它的说明：查不到价的请求、按官方标价估的、价格是内置的价目。 */
export function usageCost(view: UsageSummaryView | null | undefined): { cost: UsageCost | null; notes: string[] } {
  const totals = view?.totals;
  if (!totals || totals.estimated_cost_usd === undefined || totals.estimated_cost_usd === null) return { cost: null, notes: [] };
  const unpriced = n(totals.unpriced_requests);
  const rate = usdToCnyRate(view);
  const text = formatCost(totals.estimated_cost_usd, rate);
  if (!text && !unpriced) return { cost: null, notes: [] };
  const notes: string[] = [];
  if (unpriced) notes.push(`有 ${formatTokenCountExact(unpriced)} 次请求的模型查不到价，没算进花费。`);
  if (n(totals.list_priced_requests)) {
    notes.push(`有 ${formatTokenCountExact(totals.list_priced_requests)} 次请求的接口地址对不上服务商，按官方标价估算。`);
  }
  const pricing = view?.pricing;
  if (pricing && !pricing.synced_at) notes.push(`价格还没同步过，用的是内置价目（${pricing.snapshot_date || "日期不详"}）。`);
  const usd = n(totals.estimated_cost_usd);
  const exact = `¥${(usd * rate).toFixed(4)}（$${usd.toFixed(6)}）`;
  return {
    cost: { text: text || "—", title: text ? `估算花费 ${exact} · ${costBasis(rate)}` : "这些请求的模型都查不到价" },
    notes,
  };
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
    return { empty: true, cost: null, metrics: [], notes: [], stageGroups: [], models: [], months: [], summaryLine: "" };
  }
  const { cost, notes: costNotes } = usageCost(view);
  const notes: string[] = [];
  if (n(totals.requests_without_usage)) notes.push(`有 ${formatTokenCountExact(totals.requests_without_usage)} 次请求服务商没报用量，没算进来。`);
  if (n(view.jobs_estimated_from_reports)) {
    notes.push(`其中 ${view.jobs_estimated_from_reports} 个早期任务按当时的报告折算，缓存与思考明细可能不全。`);
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
    .sort((a, b) => b.total - a.total);
  const groupMax = Math.max(0, ...stageGroups.map(({ total }) => total));
  const groups = stageGroups
    .map(({ group, items, total }): UsageGroup => ({
      key: group,
      label: GROUP_LABELS[group],
      value: formatTokenCount(total),
      exact: formatTokenCountExact(total),
      share: groupMax ? total / groupMax : 0,
      total,
      cost: formatCost(items.reduce((sum, stage) => sum + n(stage.estimated_cost_usd), 0), usdToCnyRate(view)),
      rows: items.map((stage) => row(stage.stage, stage.label || stage.stage, "", stage, stageMax)),
    }));

  const models = view.by_model || [];
  const modelMax = Math.max(0, ...models.map((model) => n(model.total_tokens)));
  const months = view.by_month || [];
  const monthMax = Math.max(0, ...months.map((month) => n(month.total_tokens)));

  const metrics = usageMetrics(totals);
  // 花费放在最前面：一眼要看的就是花了多少钱。
  if (cost) metrics.unshift({ key: "cost", label: "花费", value: cost.text, exact: "", note: "按标价估算", title: cost.title });
  return {
    empty: false,
    cost,
    metrics,
    notes: [...notes, ...costNotes],
    stageGroups: groups,
    models: models.map((model) => ({
      ...row(`${model.model}@${model.host}`, model.model || "未知模型", model.host || "", model, modelMax),
      logo: modelLogoFor(model.model) || (model.host ? vendorLogoForBaseUrl(`https://${model.host}`) : null),
    })),
    months: months.map((month) => row(month.month, monthLabel(month.month), "", month, monthMax)),
    summaryLine: view.scope === "job" ? "只算这一次任务，不含这本书的其它任务" : `计入 ${view.jobs_counted} 个任务`,
  };
}
