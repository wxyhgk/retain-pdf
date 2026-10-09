// 处理流水线轨道：把 OCR / 翻译 / 渲染 画成同一条流程，
// OCR 不再是与翻译并列的独立能力，而是流水线第一站。
//
// 承接原有 DOM 契约（测试与门禁依赖）：
// - 根节点 data-translation-process="true"，三个站点各带 data-stage-key；
// - OCR 站带 data-processing-capability="ocr"，翻译站带 ="translation"；
// - 两站内各有一个 .book-detail-status 显示该站状态。
//
// 每站下面一行写这一站的真实结果（页数、模型、用时，来自覆盖接口），没有数据就不写。
// 曾经还有第四站「完成」：渲染打勾就等于完成，它只是多一个勾；翻译站下面那句
// 「复用已有 OCR，直接翻译并生成阅读产物」是固定说明、不是状态，只在还没翻译时保留。
//
// loading（首帧未知）：任务数据还没回来时，轨道只占位不下结论——四站显示
// 「读取中…」，data-state="loading"，根节点带 data-loading="true"。
// 曾经这里没有这个态，首帧一律按 pending 渲染成「未执行 / 尚未翻译」，
// 而那份文档的 OCR 其实正在跑。视觉沿用 is-pending 的样式类，
// 避免引入尚未打进 CSS 产物的新类名。

import { Check, TriangleAlert, X } from "lucide-react";

import type { LibraryCardItem } from "@/features/library/domain.js";
import { translationProcessModel } from "../../../domain/translation-process-model.js";

const STAGES = [
  { key: "ocr", label: "OCR" },
  { key: "translate", label: "翻译" },
  { key: "render", label: "渲染" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];
type StepState = "pending" | "active" | "done" | "failed" | "cancelled";

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

/** 没有翻译 job 时，用 OCR 状态推出轨道（翻译及之后为待执行）。 */
function deriveOcrModel(ocrStatus: StatusTone = {}) {
  const state: StepState = ocrStatus.tone === "active"
    ? "active"
    : ocrStatus.tone === "done"
      ? "done"
      : ocrStatus.tone === "failed"
        ? "failed"
        : "pending";
  return {
    currentStage: state === "pending" ? "" : "ocr",
    status: "",
    ocrReused: false,
    steps: STAGES.map((stage) => ({
      ...stage,
      state: (stage.key === "ocr" ? state : "pending") as StepState,
    })),
  };
}

/** 首帧未知：四站都停在占位，不声称任何一站「没跑过」。 */
function loadingModel() {
  return {
    currentStage: "",
    status: "",
    ocrReused: false,
    steps: STAGES.map((stage) => ({ ...stage, state: "pending" as StepState })),
  };
}

function StepMark({ state }: { state: string }) {
  if (state === "done") return <Check aria-hidden="true" />;
  if (state === "failed") return <TriangleAlert aria-hidden="true" />;
  if (state === "cancelled") return <X aria-hidden="true" />;
  return <span className="book-detail-pipeline-mark-idle" aria-hidden="true" />;
}

export type ProcessingPipelineRailProps = {
  item?: LibraryCardItem;
  hasTranslationJob?: boolean;
  ocrStatus?: StatusTone;
  translationStatus?: StatusTone;
  /** 翻译站说明，例如"复用已有 OCR，直接翻译并生成阅读产物"。只在还没有翻译任务时显示。 */
  translationDescription?: string;
  /** 各站一行真实结果（processingFacts().stageMeta）。 */
  stageMeta?: { ocr?: string; translate?: string; render?: string };
  /** 翻译站的提醒，例如「16 块保留原文」。 */
  translateWarning?: string;
  /** 首帧未知：任务数据还没回来，轨道只占位，不给「未执行 / 尚未翻译」的结论。 */
  loading?: boolean;
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
}: ProcessingPipelineRailProps) {
  const model = loading
    ? loadingModel()
    : hasTranslationJob ? translationProcessModel(item) : deriveOcrModel(ocrStatus);
  const stationLabels: Record<StageKey, string> = {
    ocr: loading ? "读取中…" : ocrStatus.label || "未执行",
    translate: loading ? "读取中…" : translationStatus.label || "未翻译",
    render: "",
  };
  // 有翻译任务时，每站的状态字只看这一站自己：以前直接拿整本书的状态，于是 OCR 失败时
  // 根本没开始的翻译站也写「失败」，渲染失败时「失败」挂在翻译站、渲染站一个字没有。
  // 任务在跑：没轮到的站写「等待中」；任务已失败 / 取消：没轮到的站写「未开始」。
  const anyActive = !loading && hasTranslationJob && model.steps.some((entry) => entry.state === "active");
  const jobEnded = !loading && hasTranslationJob && model.steps.some(
    (entry) => entry.state === "failed" || entry.state === "cancelled",
  );
  const labelOf = (key: StageKey, state: string): string => {
    if (loading || !hasTranslationJob) return stationLabels[key];
    if (state === "pending") return anyActive ? "等待中" : jobEnded ? "未开始" : stationLabels[key];
    return STEP_LABELS[state] || stationLabels[key];
  };
  const metaOf = (key: StageKey): string => {
    if (loading) return "";
    if (key === "translate" && !hasTranslationJob) return translationDescription;
    return stageMeta[key] || "";
  };

  return (
    <section
      className="book-detail-pipeline"
      aria-label="处理流程"
      data-translation-process="true"
      data-current-stage={model.currentStage}
      data-status={model.status}
      {...(loading ? { "data-loading": "true", "aria-busy": true } : {})}
    >
      <ol className="book-detail-pipeline-track" aria-label="OCR、翻译、渲染">
        {STAGES.map((stage) => {
          const step = model.steps.find((entry) => entry.key === stage.key)
            || { key: stage.key, label: stage.label, state: "pending" as StepState };
          const capability = stage.key === "ocr"
            ? "ocr"
            : stage.key === "translate"
              ? "translation"
              : undefined;
          const label = stage.key === "ocr" && model.ocrReused ? "OCR 复用" : stage.label;
          return (
            <li
              key={stage.key}
              className={`book-detail-pipeline-stage is-${step.state}`}
              data-stage-key={stage.key}
              data-state={loading ? "loading" : step.state}
              {...(capability ? { "data-processing-capability": capability } : {})}
            >
              <span className="book-detail-pipeline-rail" aria-hidden="true">
                <span className="book-detail-pipeline-dot">
                  <StepMark state={step.state} />
                </span>
              </span>
              <span className="book-detail-pipeline-copy">
                <span className="book-detail-pipeline-head">
                  <span className="book-detail-pipeline-label">{label}</span>
                  {labelOf(stage.key, step.state) ? (
                    <span className={`book-detail-status book-detail-pipeline-status is-${toneOf(step.state)}`}>
                      {labelOf(stage.key, step.state)}
                    </span>
                  ) : null}
                </span>
                {metaOf(stage.key) ? (
                  <span className="book-detail-pipeline-desc" data-stage-meta={stage.key}>{metaOf(stage.key)}</span>
                ) : null}
                {stage.key === "translate" && translateWarning && !loading ? (
                  <span className="book-detail-pipeline-warning" data-stage-warning="translate">
                    <TriangleAlert aria-hidden="true" />
                    {translateWarning}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
