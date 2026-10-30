// 处理流水线：一条传送带穿过五台机器（AssemblyLineScene），每台机器上方挂这一站的状态和运行时间，
// 下面一块「最近活动」。宽的时候说明挂在机器上方；窄的时候（手机）说明排成一列放在画面下面。
// 不做预计剩余时间，只写已经跑了多久。
//
// 「重新处理」也挂在流水线上：没有任务在跑时，能重做的站说明里有个按钮（OCR 站「重新 OCR」、翻译站「重译 / 精修」、
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
import { Check, ChevronDown, Clock3, LoaderCircle, TriangleAlert, X } from "lucide-react";

import type { LibraryCardItem } from "@/features/library/domain.js";
import {
  assemblyStations,
  formatElapsed,
  STATIONS,
  recentActivity,
  stationTimes,
  totalElapsedMs,
  type JobTimeline,
  type StationKey,
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

function StepMark({ state }: { state: string }) {
  if (state === "done") return <Check aria-hidden="true" />;
  if (state === "active") return <LoaderCircle className="book-detail-pipeline-spin" aria-hidden="true" />;
  if (state === "failed") return <TriangleAlert aria-hidden="true" />;
  if (state === "cancelled") return <X aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
}

const CAPABILITY: Partial<Record<StationKey, string>> = { ocr: "ocr", translate: "translation" };

/** 一站能做的事：说明里的按钮文字，和点开后列出来的内容。 */
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
  const times = loading ? {} : stationTimes(timeline, { now, jobActive });
  const total = loading ? null : totalElapsedMs(timeline, { now, jobActive });
  const timeOf = (key: StationKey): string => {
    if (key === "done") return states.done === "done" && total !== null ? `共 ${formatElapsed(total)}` : "";
    const time = times[key];
    if (!time) return "";
    return time.running ? `已运行 ${formatElapsed(time.ms)}` : `用时 ${formatElapsed(time.ms)}`;
  };
  const percent = model.progress;
  const liveDetail = jobActive ? `${item.stage_snapshot?.stage_detail || item.stage_detail || ""}` : "";
  const activity = loading ? [] : recentActivity(timeline, { liveDetail });

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
            const time = loading ? "" : timeOf(station.key);
            const meta = metaOf(station.key);
            const capability = CAPABILITY[station.key];
            return (
              <li
                key={station.key}
                className={`book-detail-pipeline-stage is-${station.state}${opened === station.key ? " is-open" : ""}`}
                style={position}
                data-stage-key={station.key}
                data-state={loading ? "loading" : station.state}
                {...(capability ? { "data-processing-capability": capability } : {})}
              >
                <span className="book-detail-pipeline-rail" aria-hidden="true">
                  <span className="book-detail-pipeline-dot">
                    <StepMark state={loading ? "pending" : station.state} />
                  </span>
                </span>
                <span className="book-detail-pipeline-copy">
                  <span className="book-detail-pipeline-head">
                    <span className="book-detail-pipeline-label">{label}</span>
                    {status ? (
                      <span className={`book-detail-status book-detail-pipeline-status is-${toneOf(station.state)}`}>{status}</span>
                    ) : null}
                    {station.state === "active" && station.key !== "prepare" && percent !== null ? (
                      <span className="book-detail-pipeline-percent" data-stage-percent={station.key}>{`${Math.round(percent)}%`}</span>
                    ) : null}
                  </span>
                  {time ? <span className="book-detail-pipeline-time" data-stage-time={station.key}>{time}</span> : null}
                  {meta ? (
                    <span className="book-detail-pipeline-desc" data-stage-meta={station.key} title={meta}>{meta}</span>
                  ) : null}
                  {station.key === "translate" && translateWarning && !loading ? (
                    <span className="book-detail-pipeline-warning" data-stage-warning="translate">
                      <TriangleAlert aria-hidden="true" />
                      {translateWarning}
                    </span>
                  ) : null}
                  {stationActions[station.key] ? (
                    <button
                      type="button"
                      id={`book-detail-station-${station.key}-btn`}
                      className="book-detail-pipeline-action"
                      aria-expanded={opened === station.key}
                      aria-controls="book-detail-station-panel"
                      data-station-action={station.key}
                      onClick={() => setOpenKey((key) => (key === station.key ? "" : station.key))}
                    >
                      {stationActions[station.key]?.label}
                      <ChevronDown aria-hidden="true" />
                    </button>
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
            <button type="button" aria-label="收起" onClick={() => setOpenKey("")}>
              <X aria-hidden="true" />
            </button>
          </div>
          {stationActions[opened]?.content}
        </div>
      ) : null}
      {activity.length ? (
        <div className="book-detail-line-activity" data-line-activity="true">
          <div className="book-detail-line-activity-head">
            <span>最近活动</span>
            {total !== null ? <span data-line-total="true">{`${jobActive ? "已运行" : "共用时"} ${formatElapsed(total)}`}</span> : null}
          </div>
          <ol>
            {activity.map((line, index) => (
              <li key={line.key} className={index === 0 && jobActive ? "is-latest" : undefined}>
                <span className="book-detail-line-activity-dot" aria-hidden="true" />
                <span className="book-detail-line-activity-text">{line.text}</span>
                {line.at ? <time>{line.at}</time> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
