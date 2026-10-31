// 「进度」页 HUD 面板要显示的数（纯计算）：进度环（页数）、耗时（按站分段）、模型、token（输入 / 输出）。
// 只读传入的真实数据（覆盖接口、分段计时、用量），算不出来的块就不出，不编数。
import type { TranslationCoverageView } from "@/platform/api/index.js";
import type { UsageViewModel } from "@/features/usage/index.js";
import {
  stationTimes,
  totalElapsedMs,
  formatElapsed,
  type JobTimeline,
  type StationKey,
} from "../../domain/assembly-line-model.js";
import type { ProcessingHeaderTone } from "../panels/processing/ProcessingHeader.jsx";

export type HudSegment = { key: StationKey; share: number; text: string; title: string; running: boolean };

export type ProcessingHudModel = {
  gauge: { value: number; tone: ProcessingHeaderTone; text: string; title: string };
  time: { text: string; title: string; segments: HudSegment[] } | null;
  model: { name: string; logo: string; agent: boolean; title: string } | null;
  tokens: { text: string; title: string; input: { share: number; text: string }; output: { share: number; text: string } } | null;
};

const STATION_NAMES: Partial<Record<StationKey, string>> = { prepare: "文档准备", ocr: "OCR 识别", translate: "文本翻译", render: "版面重建" };

/** 1:28、2:51、1:02:03 —— HUD 上的数，比「1 分 28 秒」短。 */
export function clockText(ms: number): string {
  const total = Math.round(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

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

  // 耗时：总时间一个大数，下面按站分段（OCR / 翻译 / 版面各占多长）。
  const total = totalElapsedMs(timeline, { now, jobActive });
  const times = stationTimes(timeline, { now, jobActive });
  const keys: StationKey[] = ["prepare", "ocr", "translate", "render"];
  const sum = keys.reduce((acc, key) => acc + (times[key]?.ms || 0), 0);
  // 只有「文档准备」一段（刚开始跑）时不画分段：一整条灰什么也没说。
  const segments: HudSegment[] = sum && keys.some((key) => key !== "prepare" && times[key])
    ? keys
      .filter((key) => (times[key]?.ms || 0) > 0 || times[key]?.running)
      .map((key) => {
        const time = times[key]!;
        const text = clockText(time.ms);
        return {
          key,
          share: time.ms / sum,
          text,
          title: `${STATION_NAMES[key]} ${time.running ? "已运行" : "用时"} ${formatElapsed(time.ms)}`,
          running: time.running,
        };
      })
    : [];
  const time = total === null ? null : {
    text: clockText(total),
    title: `${jobActive ? "已运行" : "共用时"} ${formatElapsed(total)}`,
    segments,
  };

  // 模型：这次任务用的；覆盖接口里还没有这次的就用最近一次翻完的。
  const job = coverage?.jobs.find((item) => item.job_id === translationJobId && item.model)
    || coverage?.jobs.find((item) => item.status === "succeeded" && item.model);
  const model = job?.model
    ? { name: job.model, logo: modelLogo(job.model), agent: job.engine === "agent", title: `${job.engine === "agent" ? "翻译 agent · " : ""}模型 ${job.model}` }
    : null;

  // token：这本书一共用了多少（含问这本书时助手花的）；在跑时数还在涨，不摆。
  const totalMetric = usage && !usage.empty ? usage.metrics.find((metric) => metric.key === "total") : null;
  const inputMetric = usage?.metrics.find((metric) => metric.key === "input");
  const outputMetric = usage?.metrics.find((metric) => metric.key === "output");
  const splitSum = (usage?.split.input || 0) + (usage?.split.output || 0);
  const tokens = totalMetric && !jobActive ? {
    text: totalMetric.value,
    title: `模型用量合计 ${totalMetric.exact} token · ${totalMetric.note}`,
    input: { share: splitSum ? (usage?.split.input || 0) / splitSum : 0, text: inputMetric?.value || "" },
    output: { share: splitSum ? (usage?.split.output || 0) / splitSum : 0, text: outputMetric?.value || "" },
  } : null;

  return { gauge, time, model, tokens };
}
