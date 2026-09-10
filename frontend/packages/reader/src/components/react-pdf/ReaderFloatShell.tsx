// 通用悬浮窗壳：拖标题、Esc 关闭、位置持久化

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { GripHorizontal, X } from "lucide-react";

export type ReaderFloatShellProps = {
  id: string;
  open: boolean;
  title: string;
  subtitle?: string;
  titleIcon?: ReactNode;
  storageKey: string;
  ariaLabel: string;
  className?: string;
  /** 默认宽（px），会 min 到视口 */
  width?: number;
  /** dock-right 用于 PDF / Markdown 等稳定双栏，不启用拖拽定位。 */
  placement?: "floating" | "dock-right" | "workspace";
  showHeader?: boolean;
  onClose: () => void;
  toolbar?: ReactNode;
  children: ReactNode;
};

type PanelPos = { x: number; y: number };

const EDGE = 12;
const DRAG_THRESHOLD = 4;

function clampPos(x: number, y: number, width: number): PanelPos {
  if (typeof window === "undefined") return { x, y };
  const w = Math.min(width, window.innerWidth - EDGE * 2);
  const maxX = Math.max(EDGE, window.innerWidth - w - EDGE);
  const approxH = Math.min(window.innerHeight * 0.9, 860);
  const maxY = Math.max(EDGE, window.innerHeight - approxH - EDGE);
  return {
    x: Math.min(maxX, Math.max(EDGE, x)),
    y: Math.min(maxY, Math.max(EDGE, y)),
  };
}

function defaultPos(width: number): PanelPos {
  if (typeof window === "undefined") return { x: 24, y: 72 };
  const w = Math.min(width, window.innerWidth - EDGE * 2);
  return clampPos(window.innerWidth - w - 20, 72, width);
}

function loadPos(key: string, width: number): PanelPos {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultPos(width);
    const parsed = JSON.parse(raw) as Partial<PanelPos>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return clampPos(parsed.x, parsed.y, width);
    }
  } catch {
    /* ignore */
  }
  return defaultPos(width);
}

function savePos(key: string, pos: PanelPos) {
  try {
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export function ReaderFloatShell({
  id,
  open,
  title,
  subtitle = "拖动标题可移动",
  titleIcon,
  storageKey,
  ariaLabel,
  className = "",
  width = 360,
  placement = "floating",
  showHeader = true,
  onClose,
  toolbar,
  children,
}: ReaderFloatShellProps) {
  const workspace = placement === "workspace";
  const docked = placement === "dock-right";
  const anchored = docked || workspace;
  const [pos, setPos] = useState<PanelPos>(() => loadPos(storageKey, width));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open || anchored) return;
    setPos((p) => clampPos(p.x, p.y, width));
  }, [anchored, open, width]);

  useEffect(() => {
    if (!open || anchored) return;
    const onResize = () => setPos((p) => clampPos(p.x, p.y, width));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchored, open, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("textarea, input, select, [contenteditable='true']")) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (anchored) return;
    if (event.button !== 0) return;
    if ((event.target as HTMLElement)?.closest?.("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
    setDragging(true);
  }, [anchored, pos.x, pos.y]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setPos(clampPos(drag.originX + dx, drag.originY + dy, width));
  }, [width]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (drag.moved) {
      setPos((p) => {
        const next = clampPos(p.x, p.y, width);
        savePos(storageKey, next);
        return next;
      });
    }
  }, [storageKey, width]);

  if (!open) return null;

  return (
    <aside
      id={id}
      className={`reader-notes-panel reader-notes-panel--${workspace ? "workspace" : docked ? "docked" : "float"}${anchored ? "" : " reader-floating-surface"}${showHeader ? " has-panel-header" : " is-headerless"}${toolbar ? " has-panel-toolbar" : ""}${dragging ? " is-dragging" : ""} ${className}`.trim()}
      style={anchored ? undefined : { left: pos.x, top: pos.y, width: Math.min(width, typeof window !== "undefined" ? window.innerWidth - 24 : width) }}
      aria-label={ariaLabel}
      role="dialog"
      aria-modal="false"
    >
      {showHeader ? <header
        className="reader-notes-panel-head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {anchored ? null : (
          <div className="reader-notes-panel-drag" aria-hidden="true">
            <GripHorizontal size={14} strokeWidth={2.25} />
          </div>
        )}
        <div className="reader-notes-panel-head-text">
          <strong>
            {titleIcon}
            {title}
          </strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <button type="button" className="reader-notes-close reader-floating-close" aria-label={`关闭${title}`} onClick={onClose}>
          <X size={14} strokeWidth={2.5} aria-hidden />
        </button>
      </header> : null}
      {toolbar ? <div className="reader-notes-panel-toolbar">{toolbar}</div> : null}
      <div className="reader-notes-panel-body">{children}</div>
    </aside>
  );
}
