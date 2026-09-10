// buildProgressRenderModel 拷贝自 components/status/job-status-card-rendering.js
// 第 45-164 行(蓝图 §1 components/status/ 判决,该文件整体死于 cutover——
// js/components/ 是防回弹门禁禁区,只能拷贝纯函数,不能 import)。
// 逐字保留,不做任何行为改写;ProgressBlock.jsx / useStagedProgressAnimation.js
// 共用本文件。

/** useStagedProgressAnimation / buildProgressOptions 输出 → ProgressBlock 输入 */
export type ProgressRenderModelInput = {
  current?: number;
  total?: number;
  fallbackText?: string;
  displayPercent?: number | null;
  percent?: number;
  progressText?: string;
  progressUnit?: string;
  stageKey?: string;
  status?: string;
  forceVisible?: boolean | null;
  indeterminate?: boolean;
};

export type ProgressRenderModel = {
  visible: boolean;
  percent: number;
  text: string;
  componentText: string;
  indeterminate: boolean;
  legacyIndeterminate: boolean;
};

function progressRenderPercent(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }
  const numericValue = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(numericValue) ? numericValue : 0));
}

function capRunningRenderPercent(percent: number, stageKey = "", status = ""): number {
  const normalizedStageKey = `${stageKey || ""}`.trim();
  const normalizedStatus = `${status || ""}`.trim();
  if (
    normalizedStatus === "running"
    && ["ocr", "translate", "render"].includes(normalizedStageKey)
    && Number(percent) >= 100
  ) {
    return 99;
  }
  return percent;
}

export function buildProgressRenderModel({
  current = NaN,
  total = NaN,
  fallbackText = "-",
  displayPercent = null,
  percent = NaN,
  progressText = "",
  progressUnit = "",
  stageKey = "",
  status = "",
  forceVisible = null,
  indeterminate = false,
}: ProgressRenderModelInput = {}): ProgressRenderModel {
  const normalizedStageKey = `${stageKey || ""}`.trim();
  const visible = forceVisible ?? ["ocr", "translate", "render"].includes(normalizedStageKey);
  if (!visible) {
    return {
      visible: false,
      percent: 0,
      text: "",
      componentText: "-",
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  const numericCurrent = Number(current);
  const numericTotal = Number(total);
  const numericDisplayPercent = progressRenderPercent(displayPercent);
  const numericPercent = Number(percent);
  const normalizedProgressUnit = `${progressUnit || ""}`.trim();
  const textFallback = progressText || fallbackText;

  if (indeterminate) {
    return {
      visible: true,
      percent: 42,
      text: textFallback,
      componentText: textFallback,
      indeterminate: true,
      legacyIndeterminate: true,
    };
  }

  if (Number.isFinite(numericDisplayPercent)) {
    const safePercent = capRunningRenderPercent(numericDisplayPercent, normalizedStageKey, status);
    const text = progressText || `进度 ${safePercent.toFixed(0)}%`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  const hasNumbers = Number.isFinite(numericCurrent) && Number.isFinite(numericTotal) && numericTotal > 0;
  if (hasNumbers && normalizedProgressUnit === "percent") {
    const safePercent = capRunningRenderPercent(
      progressRenderPercent((numericCurrent / numericTotal) * 100),
      normalizedStageKey,
      status,
    );
    const text = progressText || `进度 ${safePercent.toFixed(0)}%`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  if (hasNumbers) {
    const safePercent = capRunningRenderPercent(
      progressRenderPercent((numericCurrent / numericTotal) * 100),
      normalizedStageKey,
      status,
    );
    const text = progressText || `${numericCurrent} / ${numericTotal} (${safePercent.toFixed(0)}%)`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  if (Number.isFinite(numericPercent)) {
    const safePercent = capRunningRenderPercent(
      progressRenderPercent(numericPercent),
      normalizedStageKey,
      status,
    );
    const text = progressText || `进度 ${safePercent.toFixed(0)}%`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }
  const text = progressText || fallbackText;
  return {
    visible: true,
    percent: 0,
    text,
    componentText: text,
    indeterminate: false,
    legacyIndeterminate: false,
  };
}
