// Thanh đáy: số trang (bấm để nhảy) + zoom +/- / reset mặc định theo mode.

import { useEffect, useState } from "react";
import {
  READER_ZOOM_MAX,
  READER_ZOOM_MIN,
  defaultZoomForMode,
  stepReaderZoom,
  zoomToDisplayPercent,
  type ReaderZoomMode,
} from "../../pdf/reader-zoom.js";
import { clampPageNumber } from "../../pdf/scroll-to-page.js";
import { ReaderShortcutsHelp } from "./ReaderShortcutsHelp.js";

export type ReaderZoomHudProps = {
  userZoom: number;
  onZoomChange: (zoom: number) => void;
  currentPage: number;
  numPages: number;
  onGoToPage?: (page: number) => void;
  /** Bấm phần trăm để reset về zoom mặc định của mode. */
  mode?: ReaderZoomMode | string;
};

export function ReaderZoomHud({
  userZoom,
  onZoomChange,
  currentPage,
  numPages,
  onGoToPage,
  mode = "compare",
}: ReaderZoomHudProps) {
  // Bản thân zoom là "tỷ lệ so với toàn bộ chiều rộng vùng đọc": 0.5 -> 50%, 1 -> 100%.
  const percent = zoomToDisplayPercent(userZoom);
  const canZoomOut = userZoom > READER_ZOOM_MIN + 0.001;
  const canZoomIn = userZoom < READER_ZOOM_MAX - 0.001;
  const resetZoom = defaultZoomForMode(mode);
  const resetLabel = "50% (nửa màn, phủ kín khi đối chiếu)";

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
      <div className="reader-react-hud-group" aria-label="Số trang">
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
              aria-label="Nhảy tới số trang"
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
            aria-label={numPages > 0 ? `Nhảy trang, hiện ở trang ${currentPage} trên ${numPages}` : "Số trang"}
            title={numPages > 0 ? "Bấm để nhập số trang và nhảy tới" : undefined}
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
      <div className="reader-react-hud-group" aria-label="Zoom">
        <button
          type="button"
          className="reader-react-hud-btn"
          aria-label="Thu nhỏ"
          disabled={!canZoomOut}
          onClick={() => onZoomChange(stepReaderZoom(userZoom, -1))}
        >
          −
        </button>
        <button
          type="button"
          className="reader-react-hud-btn reader-react-hud-zoom-label"
          aria-label={`Reset về ${resetLabel}`}
          title={resetLabel}
          onClick={() => onZoomChange(resetZoom)}
        >
          {percent}%
        </button>
        <button
          type="button"
          className="reader-react-hud-btn"
          aria-label="Phóng to"
          disabled={!canZoomIn}
          onClick={() => onZoomChange(stepReaderZoom(userZoom, 1))}
        >
          +
        </button>
      </div>
      <div className="reader-react-hud-group reader-react-hud-help" aria-label="Trợ giúp">
        <ReaderShortcutsHelp />
      </div>
    </div>
  );
}
