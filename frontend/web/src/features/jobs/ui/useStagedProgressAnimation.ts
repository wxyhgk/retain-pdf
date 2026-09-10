// staged 进度动画 hook(蓝图 §2 features/status/,风险 §8.1——全项目最容易
// 翻车的时序点)。
//
// 拷贝自 components/status/job-status-card-progress-animation.js 的
// createStatusCardProgressAnimation(该文件属"死,由 StatusCard.jsx 家族
// 替代"清单,js/components/ 禁止 import;buildProgressOptions/
// shouldAnimateRenderPageProgress 是 @retainpdf/domain/job-status 纯 VM)。
//
// 铁律(风险 §8.1):displayedProgressByStage 与 timer 必须是 useRef,不是
// useState——每 120ms 跳一页的动画如果改用 useState,会导致每 tick 触发一次
// 整组件重渲染,且闭包捕获的是旧的 state 值(setState 的函数式更新虽能绕开
// 闭包旧值问题,但仍无法避免每 tick 重渲——ref 是唯一同时满足"跨 tick 持久化
// 又不触发渲染"的方案)。真正需要触发渲染的只有 renderOptions(通过独立的
// useState 输出,交给 ProgressBlock.jsx 渲染)。

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildProgressOptions,
  shouldAnimateRenderPageProgress,
} from "@retainpdf/domain/job-status";

const TICK_DELAY_MS = 120;

function progressNumber(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
}

export function useStagedProgressAnimation({ selected, selectedIsCurrent, snapshot, selectedProgress, jobId }) {
  const displayedProgressByStageRef = useRef({});
  const timerRef = useRef(null);
  const normalizedJobId = `${jobId || ""}`.trim();
  const normalizedSelected = `${selected || ""}`.trim();
  const [animationFrame, setAnimationFrame] = useState(null);
  // embedded 状态卡每次 render 都可能重新组装 snapshot/selectedProgress 对象。
  // effect 只应跟随真正参与进度展示的标量；若依赖对象引用，内部 setState
  // 会再次 render 并拿到新对象，最终触发 React #185（Maximum update depth）。
  const snapshotStatus = `${snapshot?.status || ""}`.trim();
  const snapshotProgressPercent = progressNumber(snapshot?.progressPercent);
  const snapshotProgressFallbackText = `${snapshot?.progressFallbackText || ""}`;
  const selectedCurrent = progressNumber(selectedProgress?.current);
  const selectedTotal = progressNumber(selectedProgress?.total);
  const selectedProgressUnit = `${selectedProgress?.progressUnit || ""}`;
  const selectedDisplayPercent = selectedProgress?.displayPercent === null
    || selectedProgress?.displayPercent === undefined
    ? null
    : Number(selectedProgress.displayPercent);
  const selectedProgressText = `${selectedProgress?.progressText || ""}`;
  const selectedIndeterminate = Boolean(selectedProgress?.indeterminate);
  const stableSnapshot = useMemo(() => ({
    status: snapshotStatus,
    progressPercent: snapshotProgressPercent,
    progressFallbackText: snapshotProgressFallbackText,
  }), [snapshotProgressFallbackText, snapshotProgressPercent, snapshotStatus]);
  const stableSelectedProgress = useMemo(() => ({
    current: selectedCurrent,
    total: selectedTotal,
    progressUnit: selectedProgressUnit,
    displayPercent: selectedDisplayPercent,
    progressText: selectedProgressText,
    indeterminate: selectedIndeterminate,
  }), [
    selectedCurrent,
    selectedDisplayPercent,
    selectedIndeterminate,
    selectedProgressText,
    selectedProgressUnit,
    selectedTotal,
  ]);

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function rememberProgress(stageKey, current, total) {
    displayedProgressByStageRef.current[stageKey] = {
      current: Number.isFinite(current) ? current : null,
      total: Number.isFinite(total) ? total : null,
    };
  }

  // 换 job 复位(风险 §8.1 附带语义):displayedProgressByStage 是"跨阶段的
  // 已显示进度记忆",job 切换后旧任务的记忆必须清空,否则新任务同名阶段会
  // 复用旧任务的显示进度做动画起点。
  useEffect(() => {
    clear();
    displayedProgressByStageRef.current = {};
    setAnimationFrame((current) => (current === null ? current : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedJobId]);

  useEffect(() => {
    const previous = displayedProgressByStageRef.current[normalizedSelected];
    const {
      previousCurrent,
      shouldAnimate,
      targetCurrent,
      targetTotal,
    } = shouldAnimateRenderPageProgress({
      selected: normalizedSelected,
      selectedIsCurrent,
      snapshot: stableSnapshot,
      selectedProgress: stableSelectedProgress,
      previous,
    });

    if (!shouldAnimate) {
      clear();
      rememberProgress(normalizedSelected, targetCurrent, targetTotal);
      setAnimationFrame((current) => (current === null ? current : null));
      return undefined;
    }

    clear();
    let displayedCurrent = previousCurrent;
    const tick = () => {
      displayedCurrent = Math.min(targetCurrent, displayedCurrent + 1);
      rememberProgress(normalizedSelected, displayedCurrent, targetTotal);
      setAnimationFrame((current) => {
        if (
          current?.jobId === normalizedJobId
          && current?.stageKey === normalizedSelected
          && Object.is(current?.displayedCurrent, displayedCurrent)
        ) {
          return current;
        }
        return {
          jobId: normalizedJobId,
          stageKey: normalizedSelected,
          displayedCurrent,
        };
      });
      if (displayedCurrent < targetCurrent) {
        timerRef.current = setTimeout(tick, TICK_DELAY_MS);
      }
    };
    tick();
    return clear;
    // snapshot/selectedProgress 的对象引用不稳定；上面的标量字段覆盖了
    // shouldAnimateRenderPageProgress/buildProgressOptions 读取的完整输入。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    normalizedJobId,
    normalizedSelected,
    selectedIsCurrent,
    snapshotStatus,
    snapshotProgressPercent,
    snapshotProgressFallbackText,
    selectedCurrent,
    selectedTotal,
    selectedProgressUnit,
    selectedDisplayPercent,
    selectedProgressText,
    selectedIndeterminate,
  ]);

  useEffect(() => clear, []);

  const displayedCurrent = animationFrame?.jobId === normalizedJobId
    && animationFrame?.stageKey === normalizedSelected
    ? animationFrame.displayedCurrent
    : null;

  return useMemo(() => buildProgressOptions({
    selected: normalizedSelected,
    selectedIsCurrent,
    snapshot: stableSnapshot,
    selectedProgress: stableSelectedProgress,
    displayedCurrent,
  }), [
    displayedCurrent,
    normalizedSelected,
    selectedIsCurrent,
    stableSelectedProgress,
    stableSnapshot,
  ]);
}
