// 「进度」页 HUD 条和流水线各站小标签要显示的数（纯计算）。
//   HUD 一条：进度环（页数 / 进度 / 停在哪站）、总耗时、模型、token 合计；
//   各站小标签（stationChips）：OCR 站页数，翻译站模型标志 + 这一站的 token，版面站精修的 token。各站耗时由流水线自己按分段计时写。
// 只读传入的真实数据（覆盖接口、分段计时、用量），算不出来的就不出，不编数。
import type { TranslationCoverageView } from "@/platform/api/index.js";
import type { UsageViewModel } from "@/features/usage/index.js";
import { formatTokenCount, formatTokenCountExact } from "@/platform/utils/token-count.js";
import {
  clockText,
  totalElapsedMs,
  formatElapsed,
  type JobTimeline,
  type StationKey,
} from "../../domain/assembly-line-model.js";
import type { ProcessingHeaderTone } from "../panels/processing/ProcessingHeader.jsx";

/** 流水线某站下面的一个小标签：图标 + 数（或标志 + 数），整句在悬停里。 */
export type StationChip = { key: string; kind: "pages" | "model" | "tokens"; text: string; title: string; logo?: string };

export type ProcessingHudModel = {
  gauge: { value: number; tone: ProcessingHeaderTone; text: string; title: string };
  time: { text: string; title: string } | null;
  model: { name: string; logo: string; agent: boolean; title: string } | null;
  tokens: { text: string; title: string } | null;
  stationChips: Partial<Record<StationKey, StationChip[]>>;
};

export { clockText };

/** 按模型名认出是哪家，挑它的标志；认不出就不画标志。 */
export function modelLogo(model: string): string {
  const name = model.toLowerCase();
  if (/claude|anthropic/.test(name)) return "src/assets/providers/anthropic.svg";
  if (/deepseek/.test(name)) return "src/assets/providers/deepseek.svg";
  if (/qwen/.test(name)) return "src/assets/providers/qwen.svg";
  if (/glm|zhipu|bigmodel/.test(name)) return "src/assets/providers/zai.svg";
  if (/gpt|openai|^o\d/.test(name)) return "src/assets/providers/openai.svg";
  return "";
}

export function processingHudModel({
  tone,
  jobActive,
  runningPercent,
  liveCount,
  stoppedAt,
  stationsDone,
  coverage,
  translationJobId,
  pageCount,
  timeline,
  now,
  usage,
}: {
  tone: ProcessingHeaderTone;
  jobActive: boolean;
  runningPercent: number | null;
  liveCount: string | null;
  stoppedAt: string;
  /** 流水线上做完了几站（文档准备、OCR、翻译、版面，最多 4）。 */
  stationsDone: number;
  coverage: TranslationCoverageView | null | undefined;
  translationJobId: string;
  pageCount?: number;
  timeline: JobTimeline | null | undefined;
  now: number;
  usage: UsageViewModel | null;
}): ProcessingHudModel {
  // 进度环：在跑时跟进度；完成时是翻了几页；停下时是走到了第几站；还没开始是空的。
  const pages = Number(coverage?.page_count || pageCount || 0);
  const translated = Number(coverage?.translated_pages || 0);
  let gauge: ProcessingHudModel["gauge"];
  if (jobActive) {
    const value = runningPercent === null ? 0.04 : runningPercent / 100;
    const text = liveCount || (runningPercent === null ? "…" : `${Math.round(runningPercent)}%`);
    gauge = { value, tone, text, title: `进度 ${text}` };
  } else if (tone === "failed" || tone === "stopped") {
    gauge = { value: Math.min(1, stationsDone / 4), tone, text: stoppedAt || "—", title: stoppedAt ? `停在${stoppedAt}` : "任务停下了" };
  } else if (tone === "done" || tone === "warn") {
    const value = pages ? Math.min(1, translated / pages) || 1 : 1;
    const text = pages ? `${translated || pages}/${pages}` : "✓";
    gauge = { value, tone, text, title: pages ? `已翻译 ${translated || pages} / ${pages} 页` : "已完成" };
  } else {
    gauge = { value: 0, tone, text: pages ? `${pages} 页` : "—", title: pages ? `共 ${pages} 页` : "还没开始" };
  }

  // 耗时：总时间；各站分开的用时由流水线自己写在各站下面。
  const total = totalElapsedMs(timeline, { now, jobActive });
  const time = total === null ? null : { text: clockText(total), title: `${jobActive ? "已运行" : "共用时"} ${formatElapsed(total)}` };

  // 模型：这次任务用的；覆盖接口里还没有这次的就用最近一次翻完的。
  const job = coverage?.jobs.find((item) => item.job_id === translationJobId && item.model)
    || coverage?.jobs.find((item) => item.status === "succeeded" && item.model);
  const model = job?.model
    ? { name: job.model, logo: modelLogo(job.model), agent: job.engine === "agent", title: `${job.engine === "agent" ? "翻译 agent · " : ""}模型 ${job.model}` }
    : null;

  // token：这本书一共用了多少（含问这本书时助手花的）；在跑时数还在涨，不摆。
  const totalMetric = usage && !usage.empty ? usage.metrics.find((metric) => metric.key === "total") : null;
  const tokens = totalMetric && !jobActive
    ? { text: totalMetric.value, title: `模型用量合计 ${totalMetric.exact} token · ${totalMetric.note}` }
    : null;

  // 各站小标签。用量按环节分组：翻译和译前准备归翻译站，精修与编辑部跑在渲染阶段、归版面站；助手不归哪一站。
  const stationChips: Partial<Record<StationKey, StationChip[]>> = {};
  const push = (key: StationKey, chip: StationChip) => { (stationChips[key] ||= []).push(chip); };
  if (pages && !jobActive) push("ocr", { key: "pages", kind: "pages", text: `${pages}`, title: `共 ${pages} 页` });
  if (model) push("translate", { key: "model", kind: "model", text: model.name, title: model.title, logo: model.logo });
  const groupTokens = (keys: string[]) => (usage?.stageGroups || []).filter((group) => keys.includes(group.key));
  if (!jobActive) {
    const translateGroups = groupTokens(["translation", "preparation"]);
    if (translateGroups.length) {
      const sum = translateGroups.reduce((acc, group) => acc + group.total, 0);
      push("translate", {
        key: "tokens",
        kind: "tokens",
        text: formatTokenCount(sum),
        title: `翻译这一站 ${formatTokenCountExact(sum)} token（${translateGroups.map((group) => `${group.label} ${group.value}`).join("、")}）`,
      });
    }
    const refine = groupTokens(["refine"]);
    if (refine.length) push("render", { key: "tokens", kind: "tokens", text: refine[0].value, title: `${refine[0].label} ${refine[0].exact} token` });
  }

  return { gauge, time, model, tokens, stationChips };
}
