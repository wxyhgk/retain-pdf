// 进度区块(蓝图 §2 features/status/;镜像
// job-status-card-progress-renderer.js 的 renderProgressComponents/
// renderProgressModel——DOM 契约逐 id/class/CSS 变量保留(蓝图风险 §8.7:
// --status-ring-percent、--status-progress-percent、data-value、
// aria-valuenow)。renderOptions 来自 useStagedProgressAnimation 的输出,
// 本组件只管声明式渲染,不持有动画状态。

import type { CSSProperties } from "react";
import { buildProgressRenderModel, type ProgressRenderModelInput } from "../domain/progress-model.js";
import { useStatusCardIds } from "./status-card-ids-context.js";

function roundPercent(percent: number): number | null {
  const numeric = Number(percent);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(Math.max(0, Math.min(100, numeric)));
}

type ProgressBlockProps = {
  renderOptions?: ProgressRenderModelInput | null;
};

export function ProgressBlock({ renderOptions }: ProgressBlockProps) {
  const ids = useStatusCardIds();
  const model = buildProgressRenderModel(renderOptions || {});
  const {
    visible,
    percent = 0,
    text = "",
    componentText = "-",
    indeterminate = false,
    legacyIndeterminate = false,
  } = model || {};
  const rounded = roundPercent(percent);
  const finitePercent = rounded === null ? null : rounded;
  // book-detail 口径：缺数不伪造 0%。bar 宽度用 0 兜底（空条），文案显示 —/原文案。
  const barPercent = Number.isFinite(percent) ? percent : 0;

  // 是否存在一个"可以报给用户的百分比"。三种情况都不存在，此前却都被渲染成了数字：
  //   1. visible=false —— 该阶段根本不展示进度，model 返回的 percent: 0 只是占位。
  //      进度条整块靠 hidden 挡住了，但圆环在那个容器**外面**，于是凭空显示 "0%"。
  //   2. finitePercent === null —— 缺数（失败/未知）。视觉已按"不伪造 0%"显示 —，
  //      但 barPercent 的 0 兜底（本只该用于把条画空）同时喂给了 aria/data。
  //   3. indeterminate —— model 的 42 是 CSS 动画用的角度值，不是进度；
  //      ARIA 规范要求不确定态省略 aria-valuenow，而不是报一个假的 42%。
  const hasReportablePercent = visible && !indeterminate && finitePercent !== null;
  const percentLabel = hasReportablePercent ? `${finitePercent}%` : "—";
  // 无障碍数值与屏幕上的数字同源（都用已 round 的 finitePercent）；没有就不报，
  // 而不是退回 0——0% 和"无数据"对读屏用户是两件完全不同的事。
  const valueProps = hasReportablePercent
    ? { "aria-valuenow": finitePercent, "data-value": finitePercent }
    : {};

  const ringText = indeterminate ? "..." : percentLabel;
  const ringMetaText = (componentText && componentText !== "-")
    ? componentText
    : (indeterminate ? "处理中" : percentLabel);
  const footPercentText = indeterminate ? "处理中" : percentLabel;

  return (
    <>
      <div className={visible ? "status-progress-block" : "status-progress-block hidden"}>
        <div
          id={ids.progressBar}
          className={`status-progress-bar${indeterminate ? " is-indeterminate" : ""}`}
          role="progressbar"
          aria-label="任务进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={indeterminate ? "处理中" : percentLabel}
          {...valueProps}
          style={{ ["--status-progress-percent"]: `${visible ? barPercent : 0}%` } as CSSProperties}
        >
          <div className="status-progress-bar-fill" />
        </div>
        <div className="progress-track hidden">
          <div
            id={ids.legacyProgressBar}
            className={`progress-bar${visible && legacyIndeterminate ? " is-indeterminate" : ""}`}
            style={{ width: visible ? `${barPercent}%` : "0%" }}
          />
        </div>
        <div className="status-progress-foot">
          <span id={ids.progressText} className="status-progress-text">{visible ? text : ""}</span>
          <span id={ids.progressPercent} className="status-progress-percent">{footPercentText}</span>
        </div>
      </div>
      {/* 圆环与上面的进度条是同一个值的两种画法。此前两者都是 role="progressbar"
          且 aria-label 都叫"任务进度"，读屏会读出两条同名进度。语义归条所有，
          圆环整体退出无障碍树；它的 DOM id 仍是测试契约，保留不动。 */}
      <div className="status-progress-ring-wrap" aria-hidden="true">
        <div
          id={ids.progressRing}
          className={`status-progress-ring${indeterminate ? " is-indeterminate" : ""}`}
          data-value={hasReportablePercent ? finitePercent : ""}
          style={{ ["--status-ring-percent"]: `${indeterminate ? 42 : (visible ? barPercent : 0)}%` } as CSSProperties}
        >
          <span className="status-progress-ring-text">{ringText}</span>
        </div>
        <div id={ids.progressRingMeta} className="status-animation-meta">{ringMetaText}</div>
      </div>
    </>
  );
}
