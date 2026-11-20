// 「对比版本」的界面：悬浮小球里的版本列表（选一份放左栏、用左边这份、退出对比），和对比时两栏书页上淡淡的水印
// （RetainPDF 标记 + 模型名大字 + 「对比 / 正在读 · 方式 · 时间」小字，2026-11-20 起代替书页上方那一条文字）。
// 数据和动作在 hooks/use-reader-version-compare.ts。
import { useLayoutEffect, useState, type ReactElement } from "react";
import { Check, LoaderCircle, LogOut, Pin } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { VersionCompare } from "../../hooks/use-reader-version-compare.js";
import { READER_PANE_ATTR } from "../../pdf/reader-dom-contract.js";

/** 「11月18日 18:31」；读不出写空。 */
export function versionTimeText(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 版本名拆成「方式」和「模型」：「精翻 · deepseek-v4-flash」→ 精翻 / deepseek-v4-flash；拆不开整个当模型。 */
export function splitVersionName(name: string): { engine: string; model: string } {
  const at = name.indexOf(" · ");
  return at > 0 ? { engine: name.slice(0, at), model: name.slice(at + 3) } : { engine: "", model: name };
}

/** 小球里「对比版本」点开的那张卡。 */
export function VersionCompareMenu({ compare, onDone }: { compare: VersionCompare; onDone: () => void }): ReactElement {
  return (
    <div className="reader-version-compare-menu" role="dialog" aria-label="选一份译文放在左边对照">
      <p className="reader-version-compare-hint">选一份放在左边，和右边正在读的这份逐段对着看。</p>
      <ol className="reader-version-compare-list">
        {[...compare.versions].reverse().map((version) => {
          const reading = version.versionId === compare.readingVersionId;
          const active = compare.compared?.versionId === version.versionId;
          const loading = compare.loading === version.versionId;
          return (
            <li key={version.versionId}>
              <Button
                className="reader-version-compare-item"
                data-version-id={version.versionId}
                aria-current={active ? "true" : undefined}
                disabled={reading}
                onClick={() => {
                  compare.choose(version.versionId);
                  onDone();
                }}
              >
                <span className="reader-version-compare-name">{version.name}</span>
                <span className="reader-version-compare-time">{versionTimeText(version.createdAt)}</span>
                {reading ? <span className="reader-version-compare-tag">正在读</span> : null}
                {active ? <Check size={14} aria-hidden /> : null}
                {loading ? <LoaderCircle size={14} className="reader-version-compare-spin" aria-hidden /> : null}
              </Button>
            </li>
          );
        })}
      </ol>
      {compare.error ? <p className="reader-version-compare-error" role="alert">{compare.error}</p> : null}
      {compare.compared ? (
        <div className="reader-version-compare-actions">
          <Button
            className="reader-version-compare-adopt"
            title="以后阅读就用左边这份（和书详情「译文版本」里选的一样）"
            onClick={() => {
              void compare.adopt();
              onDone();
            }}
          >
            <Pin size={13} aria-hidden />
            用左边这份
          </Button>
          <Button
            className="reader-version-compare-close"
            title="左栏换回原文"
            onClick={() => {
              compare.clear();
              onDone();
            }}
          >
            <LogOut size={13} aria-hidden />
            退出对比
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** 对比时一栏书页上方淡淡的水印：RetainPDF 标记、模型名大字、「对比 / 正在读 · 方式 · 时间」小字。不接鼠标。 */
export function VersionWatermark({ role, name, createdAt }: { role: "compare" | "reading"; name: string; createdAt: string }): ReactElement {
  const { engine, model } = splitVersionName(name);
  const meta = [role === "compare" ? "对比" : "正在读", engine, versionTimeText(createdAt)].filter(Boolean).join(" · ");
  return (
    <div className={`reader-version-watermark is-${role}`} data-version-watermark={role}>
      <em>RetainPDF</em>
      <strong>{model}</strong>
      <span>{meta}</span>
    </div>
  );
}

type Placement = { x: number; top: number } | null;

/**
 * 两栏的水印，固定在每栏正上方（书页区顶下 14px，横向对着栏的中线）。
 * 每栏自己是个 overflow:auto 的容器（从不滚），sticky 贴不住，所以量出栏的位置用 fixed 放；栏宽、窗口一变、横向滚动时重量。
 */
export function VersionWatermarks({
  shellEl,
  left,
  right,
}: {
  shellEl: HTMLElement | null | undefined;
  left: { name: string; createdAt: string };
  right: { name: string; createdAt: string };
}): ReactElement | null {
  const [spots, setSpots] = useState<{ source: Placement; translated: Placement }>({ source: null, translated: null });
  useLayoutEffect(() => {
    if (!shellEl) return undefined;
    const measure = () => {
      const shell = shellEl.getBoundingClientRect();
      const at = (pane: string): Placement => {
        const el = shellEl.querySelector<HTMLElement>(`[${READER_PANE_ATTR}="${pane}"]`);
        const box = el?.getBoundingClientRect();
        return box && box.width > 0 ? { x: Math.round(box.left + box.width / 2), top: Math.round(shell.top + 14) } : null;
      };
      setSpots({ source: at("source"), translated: at("translated") });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(shellEl);
    shellEl.querySelectorAll(`[${READER_PANE_ATTR}]`).forEach((el) => observer?.observe(el));
    window.addEventListener("resize", measure);
    shellEl.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      shellEl.removeEventListener("scroll", measure);
    };
  }, [shellEl]);
  return (
    <div className="reader-version-watermarks" aria-hidden="true">
      {spots.source ? (
        <div className="reader-version-watermark-slot" style={{ left: spots.source.x, top: spots.source.top }}>
          <VersionWatermark role="compare" {...left} />
        </div>
      ) : null}
      {spots.translated ? (
        <div className="reader-version-watermark-slot" style={{ left: spots.translated.x, top: spots.translated.top }}>
          <VersionWatermark role="reading" {...right} />
        </div>
      ) : null}
    </div>
  );
}
