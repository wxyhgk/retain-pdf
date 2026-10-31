// 处理流水线：一条传送带穿过五台机器（AssemblyLineScene），每台机器上方只挂一个状态徽标（勾、转圈、红色感叹号、虚线圈），
// 在跑的那站旁边一个百分比，能重做的站旁边一个 ↻。宽屏、手机都一样挂在画面上。
//
// 画面上没有字：站名、状态、用时、实时说明都在悬停（li 的 title）和读屏里（sr-only）。各站用时在上面 HUD 的耗时条上，
// 「最近活动」在细节区（ProcessingActivity）。以前每站三四行字：名字、状态小标签、用时、「全部 134 页 · 模型」。
//
// 「重新处理」也挂在流水线上：没有任务在跑时，能重做的站名字旁边有个 ↻ 图标（OCR 站「重新 OCR」、翻译站「重译 / 精修」、
// 版面站「重新渲染」，任务停下时文档准备站「从头翻译」），点开在画面下面列出这一站能做的事。内容由调用方给（stationActions）。
//
// 承接原有 DOM 契约（测试与门禁依赖）：
// - 根节点 data-translation-process="true"，各站带 data-stage-key（以前三站，现在多了 prepare、done）；
// - OCR 站带 data-processing-capability="ocr"，翻译站带 ="translation"；
// - 各站内一个 .book-detail-status 显示该站状态；结果一行 data-stage-meta，翻译站提醒 data-stage-warning。
//
// loading（首帧未知）：任务数据还没回来时只占位不下结论 —— 各站「读取中…」，data-state="loading"，
// 根节点带 data-loading="true"。曾经首帧一律按 pending 渲染成「未执行 / 尚未翻译」，而那份文档的 OCR 其实正在跑。

import { useState, type CSSProperties, type ReactNode } from "react";
import { Clock3, Coins, Cpu, FileText, Flag, Languages, Layers, RotateCcw, ScanText, TriangleAlert, X } from "lucide-react";
import { IconButton } from "@retainpdf/ui";

import type { LibraryCardItem } from "@/features/library/domain.js";
import {
  assemblyStations,
  clockText,
  formatElapsed,
  STATIONS,
  stationTimes,
  totalElapsedMs,
  type JobTimeline,
  type StationKey,
  type StationTime,
  type StationState,
} from "../../../domain/assembly-line-model.js";
import { AssemblyLineScene, STATION_ANCHORS } from "./AssemblyLineScene.jsx";

type StatusTone = { label?: string; tone?: string };

const STEP_LABELS: Record<string, string> = {
  done: "已完成",
  active: "处理中",
  failed: "失败",
  cancelled: "已取消",
};

function toneOf(state: string): string {
  if (state === "done") return "done";
  if (state === "active") return "active";
  if (state === "failed") return "failed";
  return "muted";
}

function ocrStateOf(ocrStatus: StatusTone): StationState {
  if (ocrStatus.tone === "active") return "active";
  if (ocrStatus.tone === "done") return "done";
  if (ocrStatus.tone === "failed") return "failed";
  return "pending";
}

/** 徽标里画这一站自己的图标；状态靠徽标的颜色、在跑时的转圈外环和失败时的红色区分。 */
const STATION_GLYPH: Record<StationKey, typeof FileText> = {
  prepare: FileText,
  ocr: ScanText,
  translate: Languages,
  render: Layers,
  done: Flag,
};

/** 站下面的一个小标签：图标（或服务商标志）+ 数，整句在悬停里。由调用方给（processingHudModel().stationChips）。 */
export type StationChipView = { key: string; kind: "pages" | "model" | "tokens"; text: string; title: string; logo?: string };

function ChipIcon({ chip }: { chip: StationChipView }) {
  if (chip.kind === "model") {
    return chip.logo ? <img src={chip.logo} alt="" aria-hidden="true" /> : <Cpu aria-hidden="true" />;
  }
  if (chip.kind === "tokens") return <Coins aria-hidden="true" />;
  return <FileText aria-hidden="true" />;
}

const CAPABILITY: Partial<Record<StationKey, string>> = { ocr: "ocr", translate: "translation" };

/** 一站能做的事：↻ 图标的名字（悬停和读屏），和点开后列出来的内容。 */
export type StationAction = { label: string; content: ReactNode };

export type ProcessingPipelineRailProps = {
  item?: LibraryCardItem;
  hasTranslationJob?: boolean;
  ocrStatus?: StatusTone;
  translationStatus?: StatusTone;
  /** 翻译站说明，例如"复用已有 OCR，直接翻译并生成阅读产物"。只在还没有翻译任务时显示。 */
  translationDescription?: string;
  /** 各站一行真实结果（processingFacts().stageMeta），任务在跑时是当前站的实时说明。 */
  stageMeta?: { ocr?: string; translate?: string; render?: string };
  /** 翻译站的提醒，例如「16 块保留原文」。 */
  translateWarning?: string;
  /** 首帧未知：任务数据还没回来，只占位，不给「未执行 / 尚未翻译」的结论。 */
  loading?: boolean;
  /** 任务详情里的分段计时（useJobTimeline）；没有就不写时间。 */
  timeline?: JobTimeline | null;
  /** 现在（毫秒），正在跑的那站按它算时间。 */
  now?: number;
  /** 各站能做的事（重新 OCR、重新翻译……）；没有任务在跑时才给。 */
  stationActions?: Partial<Record<StationKey, StationAction>>;
  /** 各站下面除了用时以外的小标签（OCR 站页数、翻译站模型和 token……）。 */
  stationChips?: Partial<Record<StationKey, StationChipView[]>>;
  /** OCR 子任务自己的分段计时：OCR 和翻译并行时翻译任务的计时里没有 OCR 那段，OCR 站的用时看它。 */
  ocrTimeline?: JobTimeline | null;
  /** 某几站在跑时的百分比（OCR 站看 OCR 任务、并行时翻译站看 ocr_stream）；没给的站用翻译任务自己的进度。 */
  stationPercent?: Partial<Record<StationKey, number | null>>;
};

export function ProcessingPipelineRail({
  item = {},
  hasTranslationJob = false,
  ocrStatus = {},
  translationStatus = {},
  translationDescription = "",
  stageMeta = {},
  translateWarning = "",
  loading = false,
  timeline = null,
  now = Date.now(),
  stationActions = {},
  stationChips = {},
  ocrTimeline = null,
  stationPercent = {},
}: ProcessingPipelineRailProps) {
  const [openKey, setOpenKey] = useState<StationKey | "">("");
  const opened = openKey && stationActions[openKey] ? openKey : "";
  const model = assemblyStations(item, { hasTranslationJob, ocrState: ocrStateOf(ocrStatus), loading });
  const states = Object.fromEntries(model.stations.map((station) => [station.key, station.state])) as Record<StationKey, StationState>;
  // 每站的状态字只看这一站自己。任务在跑：没轮到的站写「等待中」；任务已失败 / 取消：没轮到的站写「未开始」。
  const anyActive = !loading && hasTranslationJob && model.stations.some((station) => station.state === "active");
  const jobEnded = !loading && hasTranslationJob && model.stations.some(
    (station) => station.state === "failed" || station.state === "cancelled",
  );
  const idleLabel: Partial<Record<StationKey, string>> = {
    ocr: ocrStatus.label || "未执行",
    translate: translationStatus.label || "未翻译",
  };
  const labelOf = (key: StationKey, state: StationState): string => {
    if (loading) return "读取中…";
    if (!hasTranslationJob && key !== "prepare" && key !== "done") return idleLabel[key] || "";
    if (key === "prepare" && state === "active") return "排队中";
    if (state === "pending") return anyActive ? "等待中" : jobEnded ? "未开始" : idleLabel[key] || "";
    return STEP_LABELS[state] || "";
  };
  const metaOf = (key: StationKey): string => {
    if (loading || key === "prepare" || key === "done") return "";
    if (key === "translate" && !hasTranslationJob) return translationDescription;
    return stageMeta[key] || "";
  };
  const jobActive = anyActive;
  const times: Partial<Record<StationKey, StationTime>> = loading ? {} : stationTimes(timeline, { now, jobActive });
  // OCR 子任务有自己的计时就用它（并行时翻译任务那边只有一秒的「提交 OCR」）；两站的时间可以重叠。
  const ocrTime = loading || !ocrTimeline ? null : stationTimes(ocrTimeline, { now, jobActive: states.ocr === "active" }).ocr;
  if (ocrTime) times.ocr = ocrTime;
  const total = loading ? null : totalElapsedMs(timeline, { now, jobActive });
  // 时间画成钟表 + 「1:28」；「已运行」「用时」「共」和「1 分 28 秒」的写法放在悬停和读屏里。
  const timeOf = (key: StationKey): { text: string; title: string } | null => {
    if (key === "done") {
      return states.done === "done" && total !== null ? { text: clockText(total), title: `共用时 ${formatElapsed(total)}` } : null;
    }
    const time = times[key];
    if (!time) return null;
    const full = formatElapsed(time.ms);
    return { text: clockText(time.ms), title: time.running ? `已运行 ${full}` : `用时 ${full}` };
  };
  const percent = model.progress;

  return (
    <section
      className="book-detail-pipeline"
      aria-label="处理流程"
      data-translation-process="true"
      data-current-stage={model.currentStage}
      data-status={model.status}
      {...(loading ? { "data-loading": "true", "aria-busy": true } : {})}
    >
      <div className="book-detail-line">
        <AssemblyLineScene states={states} running={jobActive} />
        <ol className="book-detail-pipeline-track" aria-label="文档准备、OCR 识别、文本翻译、版面重建、完成">
          {model.stations.map((station) => {
            const label = station.key === "ocr" && model.ocrReused ? "OCR 复用" : station.label;
            const status = labelOf(station.key, station.state);
            const anchor = STATION_ANCHORS[station.key];
            const position = { "--line-left": `${anchor.left.toFixed(2)}%`, "--line-top": `${anchor.top.toFixed(2)}%` } as CSSProperties;
            const time = loading ? null : timeOf(station.key);
            const meta = metaOf(station.key);
            const capability = CAPABILITY[station.key];
            const chips = loading ? [] : stationChips[station.key] || [];
            const hover = [label, status, time?.title, meta, ...chips.map((chip) => chip.title)].filter(Boolean).join(" · ");
            const Glyph = STATION_GLYPH[station.key];
            const stationPct = station.key in stationPercent ? stationPercent[station.key] : percent;
            return (
              <li
                key={station.key}
                className={`book-detail-pipeline-stage is-${station.state}${opened === station.key ? " is-open" : ""}`}
                style={position}
                title={hover}
                data-stage-key={station.key}
                data-state={loading ? "loading" : station.state}
                {...(capability ? { "data-processing-capability": capability } : {})}
              >
                <span className="book-detail-pipeline-rail" aria-hidden="true">
                  <span className="book-detail-pipeline-dot">
                    <Glyph aria-hidden="true" />
                  </span>
                </span>
                {stationActions[station.key] ? (
                  <IconButton
                    size="sm"
                    variant="secondary"
                    label={`${stationActions[station.key]?.label}`}
                    id={`book-detail-station-${station.key}-btn`}
                    className="book-detail-pipeline-action"
                    aria-expanded={opened === station.key}
                    aria-controls="book-detail-station-panel"
                    data-station-action={station.key}
                    onClick={() => setOpenKey((key) => (key === station.key ? "" : station.key))}
                  >
                    <RotateCcw aria-hidden="true" />
                  </IconButton>
                ) : null}
                <span className="book-detail-pipeline-copy">
                  <span className="book-detail-pipeline-label sr-only">{label}</span>
                  {status ? (
                    <span className={`book-detail-status book-detail-pipeline-status is-${toneOf(station.state)} sr-only`}>{status}</span>
                  ) : null}
                  {meta ? (
                    <span className="book-detail-pipeline-desc sr-only" data-stage-meta={station.key}>{meta}</span>
                  ) : null}
                  {station.state === "active" && station.key !== "prepare" && stationPct !== null && stationPct !== undefined ? (
                    <span className="book-detail-pipeline-chip is-percent" data-stage-percent={station.key}>{`${Math.round(stationPct)}%`}</span>
                  ) : null}
                  {time ? (
                    <span className="book-detail-pipeline-chip book-detail-pipeline-time" data-stage-time={station.key} title={time.title}>
                      <Clock3 aria-hidden="true" />
                      <span className="sr-only">{time.title}</span>
                      <span aria-hidden="true">{time.text}</span>
                    </span>
                  ) : null}
                  {chips.map((chip) => (
                    <span key={chip.key} className="book-detail-pipeline-chip" data-stage-chip={chip.kind} title={chip.title}>
                      <ChipIcon chip={chip} />
                      <span className="sr-only">{chip.title}</span>
                      {chip.kind === "model" ? null : <span aria-hidden="true">{chip.text}</span>}
                    </span>
                  ))}
                  {station.key === "translate" && translateWarning && !loading ? (
                    <span className="book-detail-pipeline-chip is-warning" data-stage-warning="translate" title={translateWarning}>
                      <TriangleAlert aria-hidden="true" />
                      <span className="sr-only">{translateWarning}</span>
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {opened ? (
        <div id="book-detail-station-panel" className="book-detail-station-panel" data-station-panel={opened}>
          <div className="book-detail-station-panel-head">
            <strong>{STATIONS.find((station) => station.key === opened)?.label}</strong>
            <IconButton size="sm" label="收起" className="book-detail-station-panel-close" onClick={() => setOpenKey("")}>
              <X aria-hidden="true" />
            </IconButton>
          </div>
          {stationActions[opened]?.content}
        </div>
      ) : null}
    </section>
  );
}
