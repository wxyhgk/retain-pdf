// token 数的显示：不足 1 万显示原数（千分位），1 万到 1 亿保留一位小数加「万」，1 亿以上保留两位小数加「亿」。
// 精确值（千分位）放悬停提示。

const EXACT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function safe(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function formatTokenCountExact(value: unknown): string {
  return EXACT.format(safe(value));
}

export function formatTokenCount(value: unknown): string {
  const n = safe(value);
  if (n < 10_000) return EXACT.format(n);
  const wan = Math.round(n / 1_000) / 10;
  // 9999.95 万四舍五入成 10000.0 万时进到「亿」，不显示「10000.0 万」。
  if (wan < 10_000) return `${wan.toFixed(1)} 万`;
  return `${(Math.round(n / 1_000_000) / 100).toFixed(2)} 亿`;
}

/** 缓存命中率；服务商没报缓存（分母为 0）时返回 null，界面写「未报」而不是 0%。 */
export function cacheHitRate(bucket: { cache_hit_tokens?: number; cache_reported_input_tokens?: number }): number | null {
  const denominator = safe(bucket.cache_reported_input_tokens);
  if (!denominator) return null;
  return Math.min(1, safe(bucket.cache_hit_tokens) / denominator);
}

export function formatPercent(ratio: number): string {
  const percent = ratio * 100;
  return `${percent >= 10 || percent === 0 ? Math.round(percent) : percent.toFixed(1)}%`;
}
