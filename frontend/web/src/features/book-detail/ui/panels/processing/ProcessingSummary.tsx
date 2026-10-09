// 「进度」页顶部摘要：一句状态 + 几项真实数字 + （没翻全时）一条提醒。
//
// 以前这里是固定的「处理」两个字、一句状态，再加一条进度条 —— 任务完成后进度条满格，
// 占一大块却什么也没说；而真正该说的（翻了几页、用了多久、有没有内容没翻出来）全不在。
// 现在：
// - 标题就是状态本身；
// - 数字只读覆盖接口（processingFacts），算不出来的项不出现，不编数；
// - 进度条只在任务进行中出现；
// - 「N 个内容块保留原文」以前只写在任务的 completion_note 里，前端从没读过，
//   用户看到的是一排绿勾。现在在这里明确说出来。

import type { ReactNode } from "react";
import { Check, LoaderCircle, TriangleAlert, Languages } from "lucide-react";

export type ProcessingSummaryTone = "active" | "done" | "warn" | "failed" | "idle";

export type ProcessingSummaryProps = {
  headline: string;
  tone: ProcessingSummaryTone;
  /** 进行中的百分比；不在进行中或没有真实数字时为 null。 */
  percent: number | null;
  /** 首帧还不知道任务情况：只占位，不下结论。 */
  bootstrapping?: boolean;
  facts?: string[];
  keptOriginBlocks?: number;
  /** 卡片头右侧的动作（「重新处理」开关）。 */
  action?: ReactNode;
};

function ToneIcon({ tone }: { tone: ProcessingSummaryTone }) {
  if (tone === "active") return <LoaderCircle className="animate-spin" />;
  if (tone === "done") return <Check />;
  if (tone === "warn" || tone === "failed") return <TriangleAlert />;
  return <Languages />;
}

export function ProcessingSummary({
  headline,
  tone,
  percent,
  bootstrapping = false,
  facts = [],
  keptOriginBlocks = 0,
  action = null,
}: ProcessingSummaryProps) {
  const shownTone: ProcessingSummaryTone = bootstrapping ? "idle" : tone;
  return (
    <>
      <header className="book-detail-processing-head" data-tone={shownTone}>
        <span className="book-detail-processing-head-icon" aria-hidden="true">
          <ToneIcon tone={shownTone} />
        </span>
        <div className="book-detail-processing-head-copy">
          <h3 className="book-detail-processing-unified-status" data-processing-unified-status="true">
            {bootstrapping ? "正在读取处理状态…" : headline}
          </h3>
          {!bootstrapping && facts.length ? (
            <p className="book-detail-processing-facts" data-processing-facts="true">
              {facts.map((fact) => (
                <span key={fact} className="book-detail-processing-fact">{fact}</span>
              ))}
            </p>
          ) : null}
        </div>
        {action ? <div className="book-detail-processing-head-action">{action}</div> : null}
      </header>

      {/* 首帧未知时留一条空轨占位：进度条稍后可能出现，先占好位置避免跳变。 */}
      {bootstrapping ? (
        <div className="book-detail-processing-progress" aria-hidden="true" />
      ) : percent !== null ? (
        <div
          className="book-detail-processing-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label="处理进度"
        >
          <div className="book-detail-processing-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      ) : null}

      {!bootstrapping && tone !== "active" && keptOriginBlocks > 0 ? (
        <p className="book-detail-processing-warning" role="note" data-kept-origin-blocks={keptOriginBlocks}>
          {`有 ${keptOriginBlocks} 个内容块没能翻译出来（多为余额不足、上游限流或超时），重新翻译可以补齐。`}
        </p>
      ) : null}
    </>
  );
}
