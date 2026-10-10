// 底栏：页码（可点跳转）+ 缩放 +/- / 模式默认重置。

import { useEffect, useState, type ReactNode } from "react";
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
  const resetLabel = resetZoom >= READER_ZOOM_MAX ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）";

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
    <div className="reader-react-hud" data-reader-hud="true">
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
      {props.bookmarkScope ? (
        <ReaderBookmarkControl
          scope={props.bookmarkScope}
          currentPage={currentPage}
          numPages={numPages}
          regions={ctx?.regions}
          onGoToPage={onGoToPage}
        />
      ) : null}
      <div className="reader-react-hud-group" aria-label="缩放">
        <button
          type="button"
          className="reader-react-hud-btn"
          aria-label="缩小"
          disabled={!canZoomOut}
          onClick={() => onZoomChange(stepReaderZoom(userZoom, -1))}
        >
          −
        </button>
        <button
          type="button"
          className="reader-react-hud-btn reader-react-hud-zoom-label"
          aria-label={`重置为${resetLabel}`}
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
          +
        </button>
      </div>
      <div className="reader-react-hud-group reader-react-hud-help" aria-label="帮助">
        <ReaderShortcutsHelp />
      </div>
    </div>
  );
}
