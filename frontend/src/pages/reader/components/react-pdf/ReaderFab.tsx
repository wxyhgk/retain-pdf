// Nút công cụ nổi kéo được (FAB): bấm để mở menu, kéo để đổi vị trí.
// Menu: ghi chú + download (gốc / bản dịch / đối chiếu).

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Bookmark,
  Columns2,
  Download,
  FileCode2,
  FileText,
  Languages,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import type { ReaderDownloadContext } from "../../hooks/use-reader-session.js";
import type { ReaderToolId } from "../../tools/registry.js";
import { READER_TOOLS } from "../../tools/registry.js";
import {
  READER_DOWNLOAD_ACTIONS,
  downloadProtectedResource,
  failDownloadToast,
  readerDownloadDisabledReason,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimReaderDownloadString,
} from "../../external.js";

const TOOL_ICONS: Record<ReaderToolId, typeof StickyNote> = {
  notes: StickyNote,
  favorites: Bookmark,
  markdown: FileCode2,
  ai: Sparkles,
};

const STORAGE_KEY = "retainpdf.reader.fab.pos.v1";
const FAB_SIZE = 52;
const EDGE = 12;
const DRAG_THRESHOLD = 6;

const DOWNLOAD_ORDER = ["source", "sideBySide", "translated"] as const;
type DownloadAction = (typeof DOWNLOAD_ORDER)[number];

const DOWNLOAD_ICONS: Record<DownloadAction, typeof FileText> = {
  source: FileText,
  sideBySide: Columns2,
  translated: Languages,
};

const DOWNLOAD_SHORT: Record<DownloadAction, string> = {
  source: "Gốc",
  sideBySide: "Đối chiếu",
  translated: "Dịch",
};

type FabPos = { x: number; y: number };

export type ReaderFabProps = {
  /** Tool id đang mở; null nghĩa là tất cả đang đóng. */
  activeTool: ReaderToolId | null;
  notesCount: number;
  sourceOnly: boolean;
  onToggleTool: (id: ReaderToolId) => void;
  download: ReaderDownloadContext;
};

function clampPos(x: number, y: number): FabPos {
  const maxX = Math.max(EDGE, window.innerWidth - FAB_SIZE - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - FAB_SIZE - EDGE);
  return {
    x: Math.min(maxX, Math.max(EDGE, x)),
    y: Math.min(maxY, Math.max(EDGE, y)),
  };
}

function defaultPos(): FabPos {
  if (typeof window === "undefined") {
    return { x: 24, y: 120 };
  }
  return clampPos(
    window.innerWidth - FAB_SIZE - 20,
    window.innerHeight - FAB_SIZE - 88,
  );
}

function loadPos(): FabPos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPos();
    const parsed = JSON.parse(raw) as Partial<FabPos>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return clampPos(parsed.x, parsed.y);
    }
  } catch {
    /* ignore */
  }
  return defaultPos();
}

function savePos(pos: FabPos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

function resolveDownloadUrls(ctx: ReaderDownloadContext) {
  if (ctx.sourceOnly || !ctx.jobId) {
    const source = trimReaderDownloadString(ctx.sourceUrl);
    const translated = trimReaderDownloadString(ctx.translatedUrl);
    return {
      source,
      translated,
      sideBySide: source && translated ? source : "",
    };
  }
  return resolveReaderDownloadUrls({
    jobId: ctx.jobId,
    jobPayload: ctx.jobPayload,
    manifestPayload: ctx.manifestPayload,
  });
}

export function ReaderFab({
  activeTool,
  notesCount,
  sourceOnly,
  onToggleTool,
  download,
}: ReaderFabProps) {
  const [pos, setPos] = useState<FabPos>(() => loadPos());
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const menuId = useId();

  const urls = useMemo(() => resolveDownloadUrls(download), [download]);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleTool = useCallback((id: ReaderToolId) => {
    onToggleTool(id);
    setOpen(false);
  }, [onToggleTool]);

  const handleDownload = useCallback(
    async (action: DownloadAction) => {
      const url = trimReaderDownloadString(urls[action]);
      if (!url || busyAction) return;
      try {
        const filename = download.jobId
          ? resolveReaderDownloadName(action, {
              jobId: download.jobId,
              jobPayload: download.jobPayload,
              manifestPayload: download.manifestPayload,
            })
          : `${download.sourceOnly ? "document" : "reader"}-${action}.pdf`;
        await downloadProtectedResource(
          download.fetchProtected,
          url,
          filename,
          filename,
          null,
          (busy: boolean) => setBusyAction(busy ? action : ""),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tải xuống thất bại";
        failDownloadToast(message);
        setBusyAction("");
      }
    },
    [urls, busyAction, download],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    if (open) setOpen(false);
    setPos(clampPos(drag.originX + dx, drag.originY + dy));
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (drag.moved) {
      setPos((p) => {
        const next = clampPos(p.x, p.y);
        savePos(next);
        return next;
      });
      return;
    }
    setOpen((v) => !v);
  };

  const badge =
    notesCount > 0 ? (notesCount > 99 ? "99+" : String(notesCount)) : null;
  const openUp = typeof window !== "undefined" && pos.y > window.innerHeight * 0.55;

  const downloadItems = DOWNLOAD_ORDER.filter((action) => {
    if (download.sourceOnly && action !== "source") return false;
    return true;
  });

  return (
    <div
      ref={rootRef}
      className={`reader-fab${open ? " is-open" : ""}${openUp ? " is-open-up" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      data-reader-fab=""
    >
      {open ? (
        <div
          id={menuId}
          className="reader-fab-menu"
          role="menu"
          aria-label="Công cụ đọc"
        >
          <header className="reader-fab-menu-head">
            <div className="reader-fab-menu-head-text">
              <strong>Công cụ</strong>
              <span>Kéo nút tròn để di chuyển</span>
            </div>
            <button
              type="button"
              className="reader-fab-menu-close"
              aria-label="Đóng menu"
              onClick={() => setOpen(false)}
            >
              <X size={14} strokeWidth={2.5} aria-hidden />
            </button>
          </header>

          {READER_TOOLS.map((tool, index) => {
            const Icon = TOOL_ICONS[tool.id];
            const isActive = activeTool === tool.id;
            const disabled = tool.needsJob && sourceOnly;
            let sub = isActive ? tool.subOpen : tool.subIdle;
            if (tool.id === "notes" && !isActive && notesCount > 0) {
              sub = `${notesCount} ghi chú`;
            }
            if (disabled) {
              sub = "Cần mở reader từ tác vụ";
            }
            return (
              <button
                key={tool.id}
                type="button"
                role="menuitem"
                className={`reader-fab-row${isActive ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => handleTool(tool.id)}
                style={{ ["--fab-i" as string]: index }}
              >
                <span className="reader-fab-row-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span className="reader-fab-row-copy">
                  <span className="reader-fab-row-title">{tool.label}</span>
                  <span className="reader-fab-row-sub">{sub}</span>
                </span>
                {tool.id === "notes" && badge ? (
                  <span className="reader-fab-row-badge">{badge}</span>
                ) : null}
              </button>
            );
          })}

          <div className="reader-fab-section" role="group" aria-label="Download">
            <div className="reader-fab-section-head">
              <Download size={12} strokeWidth={2.5} aria-hidden />
              <span>Tải PDF</span>
            </div>
            <div className="reader-fab-download-grid">
              {downloadItems.map((action, index) => {
                const meta = READER_DOWNLOAD_ACTIONS[action];
                const url = trimReaderDownloadString(urls[action]);
                const enabled = Boolean(url) && busyAction !== action;
                const reason = enabled ? "" : readerDownloadDisabledReason(action, urls);
                const busy = busyAction === action;
                const Icon = DOWNLOAD_ICONS[action];
                return (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    id={`reader-fab-download-${action}`}
                    className={`reader-fab-chip${busy ? " is-busy" : ""}${enabled ? "" : " is-disabled"}`}
                    disabled={!enabled}
                    title={enabled ? `Tải ${DOWNLOAD_SHORT[action]}` : reason}
                    onClick={() => void handleDownload(action)}
                    style={{ ["--fab-i" as string]: index }}
                  >
                    <span className="reader-fab-chip-icon" aria-hidden="true">
                      <Icon size={16} strokeWidth={2} />
                    </span>
                    <span className="reader-fab-chip-label">{DOWNLOAD_SHORT[action]}</span>
                    <span className="reader-fab-chip-state">
                      {busy ? "…" : enabled ? "↓" : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
            {downloadItems.every((a) => !trimReaderDownloadString(urls[a])) ? (
              <p className="reader-fab-empty">Artifact chưa sẵn sàng</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`reader-fab-trigger${open ? " is-open" : ""}${activeTool ? " has-notes" : ""}`}
        aria-label={open ? "Thu gọn menu công cụ" : "Mở menu công cụ"}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="menu"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="reader-fab-icon" aria-hidden="true">
          {open ? <X size={20} strokeWidth={2.5} /> : (
            <span className="reader-fab-dots">
              <i /><i /><i />
            </span>
          )}
        </span>
        {!open && badge ? (
          <span className="reader-fab-badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </button>
    </div>
  );
}
