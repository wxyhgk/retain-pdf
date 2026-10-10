// 演示模式的用量：形状照 token-usage.v1，数字取自真实书库（29 个旧任务、qwen3.8-flash）。
import type { UsageSummaryView } from "@retainpdf/api/usage";

function bucket(input: number, output: number, extra: Partial<UsageSummaryView["totals"]> = {}) {
  return {
    requests: Math.round((input + output) / 2400),
    requests_without_usage: 0,
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
    cache_hit_tokens: 0,
    cache_reported_input_tokens: 0,
    cache_write_tokens: 0,
    reasoning_tokens: 0,
    ...extra,
  };
}

function summary(scope: UsageSummaryView["scope"], scale: number): UsageSummaryView {
  const s = (n: number) => Math.round(n * scale);
  return {
    scope,
    totals: bucket(s(4_120_000), s(1_350_000)),
    by_stage: [
      { stage: "translation", label: "翻译", group: "translation", ...bucket(s(2_900_000), s(1_020_000)) },
      { stage: "refine_review", label: "审校挑错", group: "refine", ...bucket(s(720_000), s(160_000)) },
      { stage: "term_prescan", label: "术语预扫", group: "preparation", ...bucket(s(380_000), s(120_000)) },
      { stage: "assistant_ask", label: "问答助手", group: "assistant", ...bucket(s(120_000), s(50_000)) },
    ],
    by_model: [{ model: "qwen3.8-flash", host: "dashscope.aliyuncs.com", ...bucket(s(4_120_000), s(1_350_000)) }],
    by_month: [
      { month: "2026-09", ...bucket(s(980_000), s(316_000)) },
      { month: "2026-10", ...bucket(s(3_140_000), s(1_034_000)) },
    ],
    jobs_counted: scope === "all" ? 29 : 2,
    jobs_estimated_from_reports: scope === "all" ? 29 : 2,
    first_at: "2026-09-12T08:00:00Z",
    last_at: "2026-10-10T02:56:00Z",
  };
}

export async function fetchDocumentUsage(): Promise<UsageSummaryView> {
  return summary("document", 0.16);
}

export async function fetchUsageSummary(): Promise<UsageSummaryView> {
  return summary("all", 1);
}

export async function fetchJobUsage(): Promise<UsageSummaryView> {
  return summary("job", 0.08);
}
