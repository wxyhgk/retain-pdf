// 「进度」页的状态行：左边一个状态图标、一句标题、一行带图标的小字（用时、批次、停在哪站、翻了几页），
// 右边是这一刻能做的事（tools，由页签按状态给）；下面一条进度条，失败时变红、停在出错的位置。
//
// 这一页的按钮只在这里：以前「取消任务 / 详情」在一张状态卡上，「从断点继续 / 查看日志」在失败卡上，
// 「翻译整本 / 开始 OCR」在页面最下面，三处各说各的。
//
// 契约：标题带 data-processing-unified-status，小字带 data-processing-facts；
// 「N 个内容块没能翻译出来」的提醒是 .book-detail-processing-warning。

import type { ReactNode } from "react";
import {
  Check,
  CircleAlert,
  Clock3,
  Cpu,
  FileText,
  History,
  Languages,
  Layers,
  LoaderCircle,
  Pause,
  Recycle,
  TriangleAlert,
} from "lucide-react";

export type ProcessingHeaderTone = "active" | "done" | "warn" | "failed" | "stopped" | "idle";

/** 小字一项：图标按 kind 选，文字原样。 */
export type ProcessingHeaderFact = {
  key: string;
  text: string;
  kind?: "time" | "count" | "stopped" | "pages" | "merged" | "when" | "model" | "reuse";
};

export type ProcessingHeaderProps = {
  headline: string;
  tone: ProcessingHeaderTone;
  /** 进行中的百分比；没有就不画数字。 */
  percent?: number | null;
  /** 进度条宽度：在跑时是 percent，失败 / 停下时停在原处；null 不画条。 */
  bar?: number | null;
  /** 首帧还不知道任务情况：只占位，不下结论。 */
  bootstrapping?: boolean;
  facts?: ProcessingHeaderFact[];
  keptOriginBlocks?: number;
  tools?: ReactNode;
  /** 状态行下面紧跟的一块（指定页码、报错）。 */
  children?: ReactNode;
};

function ToneIcon({ tone }: { tone: ProcessingHeaderTone }) {
  if (tone === "active") return <LoaderCircle className="animate-spin" />;
  if (tone === "done") return <Check />;
  if (tone === "warn") return <TriangleAlert />;
  if (tone === "failed") return <CircleAlert />;
  if (tone === "stopped") return <Pause />;
  return <Languages />;
}

const FACT_ICON = {
  time: Clock3,
  count: Layers,
  stopped: Pause,
  pages: FileText,
  merged: Layers,
  when: History,
  model: Cpu,
  reuse: Recycle,
} as const;

/** 覆盖接口给的是成句的字（「已翻译 4 / 6 页」「最近 10/31 11:52」），按开头认出是哪一类。 */
export function coverageFactKind(text: string): ProcessingHeaderFact["kind"] {
  if (text.startsWith("已翻译")) return "pages";
  if (text.includes("拼成")) return "merged";
  if (text.startsWith("最近")) return "when";
  if (text.startsWith("用时")) return "time";
  return "model";
}

export function ProcessingHeader({
  headline,
  tone,
  percent = null,
  bar = null,
  bootstrapping = false,
  facts = [],
  keptOriginBlocks = 0,
  tools = null,
  children = null,
}: ProcessingHeaderProps) {
  const shownTone: ProcessingHeaderTone = bootstrapping ? "idle" : tone;
  const barWidth = bootstrapping ? null : bar;
  return (
    <>
      <header className="book-detail-processing-head" data-tone={shownTone}>
        <span className="book-detail-processing-head-icon" aria-hidden="true">
          <ToneIcon tone={shownTone} />
        </span>
        <div className="book-detail-processing-head-copy">
          <p className="book-detail-processing-head-title">
            <span className="book-detail-processing-unified-status" data-processing-unified-status="true">
              {bootstrapping ? "正在读取处理状态…" : headline}
            </span>
            {!bootstrapping && percent !== null ? (
              <span className="book-detail-processing-head-percent">{`${Math.round(percent)}%`}</span>
            ) : null}
          </p>
          {!bootstrapping && facts.length ? (
            <p className="book-detail-processing-facts" data-processing-facts="true">
              {facts.map((fact) => {
                const Icon = FACT_ICON[fact.kind || "model"];
                return (
                  <span
                    key={fact.key}
                    className="book-detail-processing-fact"
                    data-fact={fact.kind || "model"}
                    {...(fact.kind === "reuse" ? { "data-ocr-reuse": "true" } : {})}
                  >
                    <Icon aria-hidden="true" />
                    {fact.text}
                  </span>
                );
              })}
            </p>
          ) : null}
        </div>
        {tools ? <div className="book-detail-processing-tools">{tools}</div> : null}
      </header>

      {/* 首帧未知时留一条空轨占位：进度条稍后可能出现，先占好位置避免跳变。 */}
      {bootstrapping ? (
        <div className="book-detail-processing-progress" aria-hidden="true" />
      ) : barWidth !== null ? (
        <div
          className="book-detail-processing-progress"
          data-tone={shownTone}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(barWidth)}
          aria-label="处理进度"
        >
          <div className="book-detail-processing-progress-fill" style={{ width: `${barWidth}%` }} />
        </div>
      ) : null}

      {children}

      {!bootstrapping && tone !== "active" && keptOriginBlocks > 0 ? (
        <p className="book-detail-processing-warning" role="note" data-kept-origin-blocks={keptOriginBlocks}>
          <TriangleAlert aria-hidden="true" />
          {`${keptOriginBlocks} 个内容块没能翻译出来，重新翻译可以补齐`}
        </p>
      ) : null}
    </>
  );
}
