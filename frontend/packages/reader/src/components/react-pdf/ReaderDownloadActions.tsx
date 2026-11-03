/** 顶栏的下载：一个「下载」按钮，点开是原文 / 对照 / 译文三路。
 *
 * ## 为什么在顶栏而不是原来的圆钮菜单里
 *
 * 原来它是可拖动圆钮（FAB）菜单的最后一段，而圆钮被
 * `.is-assistant-open .reader-fab { opacity: 0; pointer-events: none }` 一条
 * CSS 在任何 dock 面板开着时整个吃掉 —— 开着 Markdown 就下不了 PDF，而且看不
 * 出为什么。顶栏这一组和「关闭回主页」同一层，永远在，也永远不被面板遮住。
 *
 * ## 为什么收成一个按钮
 *
 * 以前三路摊开在顶栏右上角，托盘约 320px 宽；顶栏为了不被它压住，右边留位、左边
 * 不留，中间的模式页签（原文 / 对照 / 译文）就是相对「除去托盘的那块」居中，
 * 1440px 下往左偏了 114px —— 用户说「原文、对照、译文都不在中间了」。收成一个按钮后
 * 托盘只剩「下载 + 关闭」，顶栏两边留同样的宽度，页签真正居中。
 *
 * disabled 的那一路照样就地说出原因：原因直接写在菜单项下面一行（以前是 title，
 * 要悬停才看得到）。用原生 <details>：三路按钮一直在 DOM 里（id 不变，下载委托和
 * 测试都认它们），只是收起时不显示。
 */
import { ChevronDown, Columns2, Download, FileText, Languages } from "lucide-react";
import { useEffect, useRef, type ReactElement } from "react";

import {
  READER_DOWNLOAD_ACTIONS,
  readerDownloadDisabledReason,
  trimReaderDownloadString,
} from "../../external.js";
import { useReaderContext } from "./reader-context.js";
import {
  useReaderDownloads,
  type ReaderDownloadAction,
} from "./use-reader-downloads.js";
import type { ReaderDownloadContext } from "../../hooks/use-reader-session.js";

const ICONS: Record<ReaderDownloadAction, typeof FileText> = {
  source: FileText,
  sideBySide: Columns2,
  translated: Languages,
};

const SHORT: Record<ReaderDownloadAction, string> = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文",
};

export type ReaderDownloadActionsProps = {
  /** 缺省时从 reader context 取 controller.download */
  download?: ReaderDownloadContext;
};

export function ReaderDownloadActions(props: ReaderDownloadActionsProps): ReactElement {
  const ctx = useReaderContext();
  const download = props.download ?? ctx?.download;
  const { urls, downloadItems, busyActions, handleDownload } = useReaderDownloads(download);
  const menuRef = useRef<HTMLDetailsElement | null>(null);

  // 点菜单外面或按 Esc 收起（<details> 自己只会在点 summary 时开合）。
  useEffect(() => {
    const close = () => {
      if (menuRef.current?.open) menuRef.current.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={menuRef} className="reader-download-actions">
      <summary className="reader-download-trigger" aria-label="下载 PDF" title="下载 PDF">
        <Download size={15} strokeWidth={2.1} aria-hidden />
        <span className="reader-download-trigger-label">下载</span>
        <ChevronDown size={13} strokeWidth={2.2} aria-hidden className="reader-download-trigger-caret" />
      </summary>
      <div className="reader-download-menu" role="group" aria-label="下载 PDF">
        {downloadItems.map((action) => {
          const meta = READER_DOWNLOAD_ACTIONS[action];
          const url = trimReaderDownloadString(urls[action]);
          const busy = busyActions.has(action);
          const enabled = Boolean(url) && !busy;
          const reason = enabled ? "" : readerDownloadDisabledReason(action, urls);
          const Icon = ICONS[action];
          return (
            <button
              key={action}
              type="button"
              id={`reader-download-${action}`}
              className={`reader-download-action${busy ? " is-busy" : ""}`}
              disabled={!enabled}
              aria-label={enabled ? `下载${meta.label}` : reason}
              onClick={() => {
                if (menuRef.current) menuRef.current.open = false;
                void handleDownload(action);
              }}
            >
              <Icon size={15} strokeWidth={2.1} aria-hidden />
              <span className="reader-download-action-text">
                <span className="reader-download-action-label">{SHORT[action]} PDF</span>
                {reason ? <span className="reader-download-action-reason">{reason}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </details>
  );
}
