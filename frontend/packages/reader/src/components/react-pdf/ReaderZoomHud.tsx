// 底栏（2026-11-28 起三行壳层的最下面一行：全宽、实占位、任何模式都不变形，不再浮在书页上、不再往下翻时收起）：
// - 左：给这一页加书签、改了译文还没排进 PDF 的提示（leftSlot）；
// - 中：页码（可点跳转）、深色文档、缩放 −/百分比/+；
// - 右：书页工具（toolsSlot：画笔 ▾、截图）、快捷键（?）。
// 搜索、书签列表、待处理在左栏（ReaderFinder）；提问、Markdown、对比版本在顶栏右边。

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@retainpdf/ui";
import { Minus, Plus } from "lucide-react";
import {
  readerViewportWidth,
  READER_ZOOM_DEFAULT,
  READER_ZOOM_MAX,
  READER_ZOOM_MIN,
  defaultZoomForMode,
  stepReaderZoom,
  zoomToDisplayPercent,
  type ReaderZoomMode,
} from "../../pdf/reader-zoom.js";
import { clampPageNumber } from "../../pdf/scroll-to-page.js";
import { ReaderShortcutsHelp } from "./ReaderShortcutsHelp.js";
import { ReaderBookmarkControl } from "./ReaderBookmarkControl.js";
import { useReaderContext, useReaderHudContext } from "./reader-context.js";

export type ReaderZoomHudProps = {
  /** 以下显示值缺省时从 reader context / hud context 取 */
  userZoom?: number;
  onZoomChange?: (zoom: number) => void;
  currentPage?: number;
  numPages?: number;
  onGoToPage?: (page: number) => void;
  /** 点百分比时重置到该模式默认缩放 */
  mode?: ReaderZoomMode | string;
  modeControls?: ReactNode;
  /** 书签按这本书存（和阅读位置同一个 scope）；不给就不显示书签。 */
  bookmarkScope?: string;
  /** 页码后面放的按钮（宿主自己加；阅读页不放，搜索在左栏）。 */
  searchSlot?: ReactNode;
  /** 左边书签后面（阅读页：改了译文还没排进 PDF 的提示）。 */
  leftSlot?: ReactNode;
  /** 右边快捷键前面（阅读页：ReaderBarTools place="bottom"，画笔 ▾、截图）。 */
  toolsSlot?: ReactNode;
};

export function ReaderZoomHud(props: ReaderZoomHudProps) {
  const ctx = useReaderContext();
  const hud = useReaderHudContext();
  const { mode = "compare", modeControls } = props;
  const userZoom = props.userZoom ?? ctx?.userZoom ?? READER_ZOOM_DEFAULT;
  const onZoomChange = props.onZoomChange ?? ctx?.onZoomChange ?? (() => {});
  const currentPage = props.currentPage ?? hud?.currentPage ?? 1;
  const numPages = props.numPages ?? hud?.numPages ?? 0;
  const onGoToPage = props.onGoToPage ?? ctx?.goToPage;
  // zoom 本身就是「占阅读区全宽的比例」：0.5→50%，1→100%
  const percent = zoomToDisplayPercent(userZoom);
  const canZoomOut = userZoom > READER_ZOOM_MIN + 0.001;
  const canZoomIn = userZoom < READER_ZOOM_MAX - 0.001;
  const resetZoom = defaultZoomForMode(mode, readerViewportWidth());
  // 窄屏单栏的默认是铺满（见 reader-zoom.ts 的 READER_NARROW_VIEWPORT_PX）。
  const resetLabel = resetZoom >= READER_ZOOM_MAX ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(`${currentPage}`);

  useEffect(() => {
    if (!editing) {
      setDraft(`${Math.min(Math.max(currentPage, 1), Math.max(numPages, 1))}`);
    }
  }, [currentPage, numPages, editing]);

  const commitPage = () => {
    setEditing(false);
    if (!onGoToPage || numPages <= 0) {
      return;
    }
    const parsed = Number(`${draft}`.trim());
    onGoToPage(clampPageNumber(parsed, numPages));
  };

  return (
    <footer className="reader-bottombar" data-reader-hud="true">
      <div className="reader-bottombar-start">
        {props.bookmarkScope ? (
          <ReaderBookmarkControl
            scope={props.bookmarkScope}
            currentPage={currentPage}
            numPages={numPages}
            regions={ctx?.regions}
          />
        ) : null}
        {props.leftSlot}
      </div>
      <div className="reader-bottombar-center">
      {modeControls ? <div className="reader-react-hud-group reader-react-hud-modes">{modeControls}</div> : null}
      <div className="reader-react-hud-group" aria-label="页码">
        {editing ? (
          <form
            className="reader-react-hud-page-form"
            onSubmit={(event) => {
              event.preventDefault();
              commitPage();
            }}
          >
            <input
              className="reader-react-hud-page-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="跳转到页码"
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
              onBlur={commitPage}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditing(false);
                  setDraft(`${currentPage}`);
                }
              }}
            />
            <span className="reader-react-hud-page-suffix">/ {numPages || "—"}</span>
          </form>
        ) : (
          <button
            type="button"
            className="reader-react-hud-page reader-react-hud-page-btn"
            aria-label={numPages > 0 ? `跳转页码，当前第 ${currentPage} 页，共 ${numPages} 页` : "页码"}
            title={numPages > 0 ? "点击输入页码跳转" : undefined}
            disabled={!onGoToPage || numPages <= 0}
            onClick={() => {
              if (!onGoToPage || numPages <= 0) return;
              setDraft(`${currentPage}`);
              setEditing(true);
            }}
          >
            {numPages > 0
              ? `${Math.min(currentPage, numPages)} / ${numPages}`
              : "—"}
          </button>
        )}
      </div>
      {props.searchSlot ? <div className="reader-react-hud-group" aria-label="搜索">{props.searchSlot}</div> : null}
      {ctx?.toggleDocDark ? (
        <div className="reader-react-hud-group" aria-label="显示">
          <Button
            className="reader-react-hud-btn reader-react-hud-doc-dark"
            aria-pressed={ctx.docDark ? "true" : "false"}
            aria-label={ctx.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字"}
            title={ctx.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）"}
            onClick={ctx.toggleDocDark}
          >
            <DocDarkIcon />
          </Button>
        </div>
      ) : null}
      <div className="reader-react-hud-group" aria-label="缩放">
        <button
          type="button"
          className="reader-react-hud-btn"
          aria-label="缩小"
          disabled={!canZoomOut}
          onClick={() => onZoomChange(stepReaderZoom(userZoom, -1))}
        >
          <Minus size={14} strokeWidth={2.2} aria-hidden />
        </button>
        <button
          type="button"
          className="reader-react-hud-btn reader-react-hud-zoom-label"
          aria-label={`${percent}%，点击${resetLabel}`}
          title={resetLabel}
          onClick={() => onZoomChange(resetZoom)}
        >
          {percent}%
        </button>
        <button
          type="button"
          className="reader-react-hud-btn"
          aria-label="放大"
          disabled={!canZoomIn}
          onClick={() => onZoomChange(stepReaderZoom(userZoom, 1))}
        >
          <Plus size={14} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
      </div>
      <div className="reader-bottombar-end">
        {props.toolsSlot}
        <div className="reader-react-hud-group reader-react-hud-help" aria-label="帮助">
          <ReaderShortcutsHelp />
        </div>
      </div>
    </footer>
  );
}

/** 半边黑的圆：深色文档开关。 */
function DocDarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
    </svg>
  );
}
