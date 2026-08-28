// Hook ngữ nghĩa chọn giai đoạn (bản thiết kế §2 features/status/).
//
// Ngữ nghĩa sao chép từ createStatusCardSelectionState của
// components/status/job-status-card-selection.js (file đó thuộc danh sách "chết, do
// họ StatusCard.jsx thay thế", js/components/ cấm import — ở đây viết lại dùng
// useState, bản thân logic resolve gọi trực tiếp resolveSelectedStatusStage của
// job-status/stage-flow-model.js, hàm thuần tái sử dụng nguyên trạng, không sao chép):
// - Đổi job (jobId đổi): selectedStageKey/manualStageSelection đặt lại;
// - currentStageKey tiến (polling trúng giai đoạn mới): manualStageSelection đặt lại,
//   trừ khi người dùng vừa nhấn tay (selectStage sẽ đặt lại true và ngay lập tức kiểm
//   tra currentStageKey mới có còn chọn được không, nếu không thì lùi về bám theo giai
//   đoạn hiện tại — ngữ nghĩa isSelectableStatusStage: chỉ chọn được giai đoạn "đã tới
//   hoặc đang tiến hành").

import { useCallback, useEffect, useState } from "react";
import { resolveSelectedStatusStage } from "../../composition/external.js";

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

  useEffect(() => {
    setState((prev) => {
      const normalizedJobId = `${jobId || ""}`.trim();
      const normalizedStageKey = `${currentStageKey || ""}`.trim();
      const jobChanged = Boolean(normalizedJobId && normalizedJobId !== prev.currentJobId);
      const base = jobChanged
        ? { ...prev, currentJobId: normalizedJobId, selectedStageKey: "", manualStageSelection: false }
        : prev;
      const previousStageKey = base.currentStageKey;
      const stageAdvanced = Boolean(previousStageKey && previousStageKey !== normalizedStageKey);
      const manualStageSelection = stageAdvanced ? false : base.manualStageSelection;
      const resolved = resolveSelectedStatusStage({
        currentStageKey: normalizedStageKey,
        selectedStageKey: base.selectedStageKey,
        manualStageSelection,
      });
      return {
        currentJobId: base.currentJobId,
        currentStageKey: normalizedStageKey,
        selectedStageKey: resolved.selectedStageKey,
        manualStageSelection: resolved.manualStageSelection,
      };
    });
  }, [jobId, currentStageKey]);

  const selectStage = useCallback((stageKey) => {
    setState((prev) => {
      const resolved = resolveSelectedStatusStage({
        currentStageKey: prev.currentStageKey,
        selectedStageKey: stageKey,
        manualStageSelection: true,
      });
      return {
        ...prev,
        selectedStageKey: resolved.selectedStageKey,
        manualStageSelection: resolved.manualStageSelection,
      };
    });
  }, []);

  const selectedIsCurrent = !state.selectedStageKey || state.selectedStageKey === state.currentStageKey;

  return {
    currentStageKey: state.currentStageKey,
    selectedStageKey: state.selectedStageKey,
    manualStageSelection: state.manualStageSelection,
    selectedIsCurrent,
    selectStage,
  };
}
