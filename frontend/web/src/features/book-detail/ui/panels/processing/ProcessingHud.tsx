// 「进度」页的 HUD 面板（方案 A）：四块，画面上只有图标和数，名字和整句在悬停与读屏里。
//   进度环：中间是状态图标，环是进度（在跑跟进度、完成是翻了几页、停下是走到第几站），下面一个数；
//   耗时：总时间，下面按站分段的一条（OCR / 翻译 / 版面各占多长）；
//   模型：服务商标志 + 模型名；
//   token：这本书一共用了多少，下面输入 / 输出的比例条。
// 算不出来的块不出（processingHudModel 给 null）。以前这些是状态行下面一行带图标的小字。

import type { CSSProperties } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Coins,
  Cpu,
  Languages,
  Layers,
  LoaderCircle,
  Pause,
  Recycle,
  ScanText,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";

import type { ProcessingHudModel } from "../../tabs/processing-hud-model.js";
import type { ProcessingHeaderTone } from "./ProcessingHeader.jsx";

function ToneIcon({ tone }: { tone: ProcessingHeaderTone }) {
  if (tone === "active") return <LoaderCircle className="animate-spin" aria-hidden="true" />;
  if (tone === "done") return <Check aria-hidden="true" />;
  if (tone === "warn") return <TriangleAlert aria-hidden="true" />;
  if (tone === "failed") return <X aria-hidden="true" />;
  if (tone === "stopped") return <Pause aria-hidden="true" />;
  return <Languages aria-hidden="true" />;
}

const SEGMENT_ICON = { prepare: null, ocr: ScanText, translate: Languages, render: Layers, done: null } as const;

const RING = 2 * Math.PI * 34;

export function ProcessingHud({
  model,
  bootstrapping = false,
  ocrReuse = false,
}: {
  model: ProcessingHudModel;
  bootstrapping?: boolean;
  /** 还没翻译、但已有 OCR 可以复用：进度环上一个小标。 */
  ocrReuse?: boolean;
}) {
  const { gauge, time, tokens } = model;
  const tone: ProcessingHeaderTone = bootstrapping ? "idle" : gauge.tone;
  return (
    <div className="book-detail-hud" data-processing-hud="true" data-tone={tone}>
      <div className="book-detail-hud-tile book-detail-hud-gauge" title={bootstrapping ? undefined : gauge.title} data-hud="gauge">
        <span className="book-detail-hud-ring">
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle className="book-detail-hud-ring-track" cx="40" cy="40" r="34" />
            <circle
              className="book-detail-hud-ring-fill"
              cx="40"
              cy="40"
              r="34"
              style={{ strokeDasharray: `${(bootstrapping ? 0 : gauge.value) * RING} ${RING}` } as CSSProperties}
            />
          </svg>
          <span className="book-detail-hud-ring-icon"><span className="book-detail-hud-ring-badge"><ToneIcon tone={tone} /></span></span>
        </span>
        {ocrReuse && !bootstrapping ? (
          <span className="book-detail-hud-reuse" data-ocr-reuse="true" title="复用已有 OCR">
            <Recycle aria-hidden="true" />
            <span className="sr-only">复用已有 OCR</span>
          </span>
        ) : null}
        <span className="sr-only">{bootstrapping ? "正在读取" : gauge.title}</span>
        <span className="book-detail-hud-num is-small" aria-hidden="true">{bootstrapping ? "…" : gauge.text}</span>
      </div>

      {time && !bootstrapping ? (
        <div className="book-detail-hud-tile" title={time.title} data-hud="time">
          <span className="book-detail-hud-head">
            <Timer aria-hidden="true" />
            <span className="sr-only">{time.title}</span>
            <span className="book-detail-hud-num" aria-hidden="true">{time.text}</span>
          </span>
          {time.segments.length ? (
            <>
              <span className="book-detail-hud-split" aria-hidden="true">
                {time.segments.map((segment) => (
                  <span
                    key={segment.key}
                    className={`book-detail-hud-seg is-${segment.key}${segment.running ? " is-running" : ""}`}
                    style={{ flexGrow: Math.max(segment.share, 0.02) }}
                  />
                ))}
              </span>
              <span className="book-detail-hud-legend">
                {time.segments.filter((segment) => SEGMENT_ICON[segment.key]).map((segment) => {
                  const Icon = SEGMENT_ICON[segment.key]!;
                  return (
                    <span key={segment.key} title={segment.title} data-hud-segment={segment.key}>
                      <i className={`is-${segment.key}`} aria-hidden="true" />
                      <Icon aria-hidden="true" />
                      <span className="sr-only">{segment.title}</span>
                      <span aria-hidden="true">{segment.text}</span>
                    </span>
                  );
                })}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {model.model && !bootstrapping ? (
        <div className="book-detail-hud-tile" title={model.model.title} data-hud="model">
          <span className="book-detail-hud-head"><Cpu aria-hidden="true" /></span>
          <span className="book-detail-hud-model">
            {model.model.logo ? <img src={model.model.logo} alt="" aria-hidden="true" /> : null}
            <span className="sr-only">{model.model.title}</span>
            <span className="book-detail-hud-model-name" aria-hidden="true">{model.model.name}</span>
            {model.model.agent ? <span className="book-detail-hud-badge" aria-hidden="true">agent</span> : null}
          </span>
        </div>
      ) : null}

      {tokens && !bootstrapping ? (
        <div className="book-detail-hud-tile" title={tokens.title} data-hud="tokens">
          <span className="book-detail-hud-head">
            <Coins aria-hidden="true" />
            <span className="sr-only">{tokens.title}</span>
            <span className="book-detail-hud-num" aria-hidden="true">{tokens.text}</span>
          </span>
          <span className="book-detail-hud-split" aria-hidden="true">
            <span className="book-detail-hud-seg is-input" style={{ flexGrow: Math.max(tokens.input.share, 0.02) }} />
            <span className="book-detail-hud-seg is-output" style={{ flexGrow: Math.max(tokens.output.share, 0.02) }} />
          </span>
          <span className="book-detail-hud-legend">
            <span title={`输入 ${tokens.input.text}`}><ArrowDownToLine aria-hidden="true" />{tokens.input.text}</span>
            <span title={`输出 ${tokens.output.text}`}><ArrowUpFromLine aria-hidden="true" />{tokens.output.text}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
