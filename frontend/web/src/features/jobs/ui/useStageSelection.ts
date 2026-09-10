// 阶段选择语义 hook(蓝图 §2 features/status/)。
//
// 语义拷贝自 components/status/job-status-card-selection.js 的
// createStatusCardSelectionState(该文件属"死,由 StatusCard.jsx 家族替代"
// 清单,js/components/ 禁止 import——这里重写为 useState 驱动,resolve 逻辑
// 本身调用 @retainpdf/domain/job-status 的 resolveSelectedStatusStage,
// 纯函数原样复用,不拷贝):
// - 换 job(jobId 变化):selectedStageKey/manualStageSelection 复位;
// - currentStageKey 推进(轮询命中新阶段):manualStageSelection 复位,除非
//   用户又手动点了一次(selectStage 会重新置 true 并立即用新的
//   currentStageKey 校验是否仍可选,不可选则回退跟随当前阶段——
//   isSelectableStatusStage 语义:只能选"已到达或正在进行"的阶段)。

import { useCallback, useMemo, useState } from "react";
import {
  resolveSelectedStatusStage,
} from "@retainpdf/domain/job-status";

type StageSelectionState = {
  currentJobId: string;
  currentStageKey: string;
  selectedStageKey: string;
  manualStageSelection: boolean;
};

const INITIAL_STATE: StageSelectionState = {
  currentJobId: "",
  currentStageKey: "",
  selectedStageKey: "",
  manualStageSelection: false,
};

export function useStageSelection({ jobId = "", currentStageKey = "" } = {}) {
  const [state, setState] = useState<StageSelectionState>(INITIAL_STATE);
  const normalizedJobId = `${jobId || ""}`.trim();
  const normalizedStageKey = `${currentStageKey || ""}`.trim();

  // 任务轮询、乐观提交与终态对账可能在一帧内交替提供不同阶段。
  // 这些外部变化只参与派生，不能通过 effect 再写本地 state；否则外部
  // snapshot 与本地 selection 会互相推动，最终触发 React update depth 185。
  const resolvedState = useMemo(() => {
    const jobChanged = normalizedJobId !== state.currentJobId;
    const stageChanged = normalizedStageKey !== state.currentStageKey;
    const manualStageSelection = jobChanged || stageChanged
      ? false
      : state.manualStageSelection;
    const resolved = resolveSelectedStatusStage({
      currentStageKey: normalizedStageKey,
      selectedStageKey: jobChanged ? "" : state.selectedStageKey,
      manualStageSelection,
    });
    return {
      currentJobId: normalizedJobId,
      currentStageKey: normalizedStageKey,
      selectedStageKey: resolved.selectedStageKey,
      manualStageSelection: resolved.manualStageSelection,
    };
  }, [normalizedJobId, normalizedStageKey, state]);

  const selectStage = useCallback((stageKey) => {
    setState(() => {
      const resolved = resolveSelectedStatusStage({
        currentStageKey: normalizedStageKey,
        selectedStageKey: stageKey,
        manualStageSelection: true,
      });
      return {
        currentJobId: normalizedJobId,
        currentStageKey: normalizedStageKey,
        selectedStageKey: resolved.selectedStageKey,
        manualStageSelection: resolved.manualStageSelection,
      };
    });
  }, [normalizedJobId, normalizedStageKey]);

  const selectedIsCurrent = !resolvedState.selectedStageKey
    || resolvedState.selectedStageKey === resolvedState.currentStageKey;

  return {
    currentStageKey: resolvedState.currentStageKey,
    selectedStageKey: resolvedState.selectedStageKey,
    manualStageSelection: resolvedState.manualStageSelection,
    selectedIsCurrent,
    selectStage,
  };
}
