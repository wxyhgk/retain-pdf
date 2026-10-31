// 「进度」页的流水线画面：五站（文档准备 → OCR 识别 → 文本翻译 → 版面重建 → 完成）的状态和运行时间。
// 纯函数，不碰 React 和网络。
//
// - 各站状态：OCR / 翻译 / 渲染沿用 translationProcessModel（和以前的轨道同一套判断），文档准备、完成由它推出来；
// - 运行时间：任务详情 runtime.stage_history 里每段的 duration_ms，按阶段名归到五站相加；还没结束的那段按现在算。
//   不做预计剩余时间。
// - 最近活动：stage_history 倒序，每条是后端写的一句话和进入的时间。

import type { LibraryCardItem } from "@/features/library/domain.js";
import { translationProcessModel } from "./translation-process-model.js";

export const STATIONS = [
  { key: "prepare", label: "文档准备" },
  { key: "ocr", label: "OCR 识别" },
  { key: "translate", label: "文本翻译" },
  { key: "render", label: "版面重建" },
  { key: "done", label: "完成" },
] as const;

export type StationKey = (typeof STATIONS)[number]["key"];
export type StationState = "pending" | "active" | "done" | "failed" | "cancelled";

export type StageTiming = {
  stage: string;
  detail: string;
  enterAt: string;
  exitAt: string;
  durationMs: number | null;
};

export type JobTimeline = {
  history: StageTiming[];
  /** 读到这份数据的时刻（毫秒）：没结束的那段从这里往后接着走。 */
  fetchedAt: number;
};

const text = (value: unknown) => `${value ?? ""}`.trim();

/** 后端的阶段名 → 五站。认不出的返回空串（不计时）。 */
export function stationOfStage(stage: unknown): StationKey | "" {
  const name = text(stage).toLowerCase();
  if (!name) return "";
  if (name === "finished" || name === "succeeded" || name === "done" || name === "render_complete") return "done";
  if (name.includes("ocr") || name.startsWith("normaliz")) return "ocr";
  if (name.startsWith("translat")) return "translate";
  if (name.startsWith("render") || name.startsWith("refin") || name.startsWith("typst") || name.startsWith("compil")) return "render";
  if (name === "queued" || name === "pending" || name === "created" || name.startsWith("upload") || name.startsWith("prepar")) {
    return "prepare";
  }
  return "";
}

/** GET /jobs/:id 的返回 → 计时用的那几样。没有 stage_history 返回 null。 */
export function timelineFromJobPayload(payload: unknown, fetchedAt: number): JobTimeline | null {
  const record = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const runtime = (record.runtime && typeof record.runtime === "object" ? record.runtime : {}) as Record<string, unknown>;
  if (!Array.isArray(runtime.stage_history)) return null;
  const history = runtime.stage_history
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      stage: text(entry.stage),
      detail: text(entry.detail),
      enterAt: text(entry.enter_at),
      exitAt: text(entry.exit_at),
      durationMs: typeof entry.duration_ms === "number" && entry.duration_ms >= 0 ? entry.duration_ms : null,
    }));
  return { history, fetchedAt };
}

export type StationTime = { ms: number; running: boolean };

/** 每站的运行时间。还没结束的那段（没有 exit_at、没有 duration_ms）在任务还在跑时按 now 算。 */
export function stationTimes(
  timeline: JobTimeline | null | undefined,
  { now, jobActive }: { now: number; jobActive: boolean },
): Partial<Record<StationKey, StationTime>> {
  const result: Partial<Record<StationKey, StationTime>> = {};
  for (const entry of timeline?.history || []) {
    const key = stationOfStage(entry.stage);
    if (!key || key === "done") continue;
    const enter = Date.parse(entry.enterAt);
    const exit = Date.parse(entry.exitAt);
    let ms = entry.durationMs;
    let running = false;
    if (ms === null && Number.isFinite(enter) && Number.isFinite(exit)) ms = Math.max(0, exit - enter);
    if (ms === null && Number.isFinite(enter) && jobActive) {
      ms = Math.max(0, now - enter);
      running = true;
    }
    if (ms === null) continue;
    const before = result[key];
    result[key] = { ms: (before?.ms || 0) + ms, running: Boolean(before?.running) || running };
  }
  return result;
}

/** 「42 秒」「3 分 5 秒」「1 小时 2 分」。不到 1 秒算 1 秒以内。 */
export function formatElapsed(ms: number): string {
  const seconds = Math.round(Math.max(0, ms) / 1000);
  if (seconds < 1) return "不到 1 秒";
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes} 分 ${seconds % 60} 秒` : `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} 小时 ${minutes % 60} 分` : `${hours} 小时`;
}

/** 1:28、2:51、1:02:03 —— 画面上的短写法，比「1 分 28 秒」短（HUD 和流水线各站的小标签用）。 */
export function clockText(ms: number): string {
  const total = Math.round(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** 整个任务跑了多久：第一段进入到最后一段结束（还在跑就到现在）。 */
export function totalElapsedMs(timeline: JobTimeline | null | undefined, { now, jobActive }: { now: number; jobActive: boolean }) {
  const history = timeline?.history || [];
  const start = Date.parse(history[0]?.enterAt || "");
  if (!Number.isFinite(start)) return null;
  const last = history[history.length - 1];
  const end = jobActive ? now : Date.parse(last?.exitAt || last?.enterAt || "");
  return Number.isFinite(end) ? Math.max(0, end - start) : null;
}

export type ActivityLine = { key: string; text: string; at: string; station: StationKey | "" };

const clock = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
};

/** 最近活动：最新的在上。liveDetail 是后端此刻的一句话（「正在翻译第 2/10 页」），有就放最上面。 */
export function recentActivity(
  timeline: JobTimeline | null | undefined,
  { liveDetail = "", limit = 4 }: { liveDetail?: string; limit?: number } = {},
): ActivityLine[] {
  const lines: ActivityLine[] = (timeline?.history || [])
    .map((entry, index) => ({
      key: `${index}-${entry.stage}`,
      text: entry.detail || STATIONS.find((station) => station.key === stationOfStage(entry.stage))?.label || entry.stage,
      at: clock(entry.enterAt),
      station: stationOfStage(entry.stage),
    }))
    .reverse();
  const live = text(liveDetail);
  if (live && lines[0]?.text !== live) lines.unshift({ key: "live", text: live, at: "", station: "" });
  return lines.slice(0, limit);
}

export type StationView = { key: StationKey; label: string; state: StationState };

/** 五站的状态。loading（首帧未知）时全部 pending，不下结论。 */
export function assemblyStations(
  item: LibraryCardItem,
  { hasTranslationJob, ocrState, loading }: { hasTranslationJob: boolean; ocrState: StationState; loading: boolean },
) {
  const model = translationProcessModel(item);
  const stateOf = (key: "ocr" | "translate" | "render" | "done"): StationState => {
    if (loading) return "pending";
    if (!hasTranslationJob) return key === "ocr" ? ocrState : "pending";
    return (model.steps.find((step) => step.key === key)?.state || "pending") as StationState;
  };
  const ocr = stateOf("ocr");
  const translate = stateOf("translate");
  const render = stateOf("render");
  const started = [ocr, translate, render].some((state) => state !== "pending");
  const status = text(item.status).toLowerCase();
  const queued = hasTranslationJob && (status === "queued" || status === "pending" || status === "running");
  const prepare: StationState = loading ? "pending" : started ? "done" : queued ? "active" : "pending";
  const done = stateOf("done");
  const states: Record<StationKey, StationState> = { prepare, ocr, translate, render, done };
  return {
    stations: STATIONS.map((station): StationView => ({ ...station, state: states[station.key] })),
    currentStage: loading ? "" : model.currentStage,
    status: loading ? "" : model.status,
    progress: model.progress,
    ocrReused: hasTranslationJob && model.ocrReused,
  };
}
