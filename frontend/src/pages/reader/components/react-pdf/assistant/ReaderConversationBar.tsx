// CRUD nhiều hội thoại: chuyển list / tạo mới / đổi tên / xóa.

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ReaderAskSessionSummary } from "./use-reader-ask-runtime.js";
import {
  armReaderAiClickShield,
  lockReaderAiNavigation,
} from "../../../external.js";

export type ReaderConversationBarProps = {
  sessions: ReaderAskSessionSummary[];
  activeId: string;
  busy?: boolean;
  disabled?: boolean;
  errorText?: string;
  onSwitch: (conversationId: string) => void | Promise<void>;
  onNew: () => void | Promise<void>;
  onDelete: (conversationId: string) => void | Promise<void>;
  onRename: (conversationId: string, title: string) => void | Promise<void>;
};

function beginSessionSwitchIsolation(ms = 900, overlayDelayMs = 0) {
  armReaderAiClickShield(ms, { overlayDelayMs });
  lockReaderAiNavigation(ms);
}

export function ReaderConversationBar({
  sessions,
  activeId,
  busy = false,
  disabled = false,
  errorText = "",
  onSwitch,
  onNew,
  onDelete,
  onRename,
}: ReaderConversationBarProps) {
  const hasSessions = sessions.length > 0;
  const locked = busy || disabled;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  // Format lưu title fork thân thiện với máy là "fork-N-original-title" (parser phụ thuộc số thứ tự, không đổi storage);
  // tầng hiển thị dịch thành "original-title · Nhánh N"; ô rename vẫn hiển thị giá trị thô.
  function displaySessionTitle(raw: string): string {
    const m = `${raw || ""}`.match(/^fork-(\d+)-(.*)$/i);
    if (!m) return raw;
    const rest = m[2].trim();
    return rest ? `${rest} · Nhánh ${m[1]}` : `Nhánh ${m[1]}`;
  }
  const pickingRef = useRef(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const active = sessions.find((s) => s.id === activeId) || null;
  const label = active
    ? (active.messageCount ? displaySessionTitle(active.title) : `${displaySessionTitle(active.title)} (trống)`)
    : hasSessions
      ? "Chọn hội thoại trước"
      : "Hội thoại mới";

  useEffect(() => {
    if (!open) {
      setEditingId("");
      return;
    }
    const onDoc = (event: PointerEvent) => {
      if (pickingRef.current) return;
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
      setEditingId("");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setEditingId("");
      }
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDoc, true);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!editingId) return;
    const el = editInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingId]);

  const pick = (id: string) => {
    const next = `${id || ""}`.trim();
    if (!next || locked || pickingRef.current || editingId) return;
    pickingRef.current = true;
    beginSessionSwitchIsolation(1000, 0);
    requestAnimationFrame(() => {
      setOpen(false);
      window.setTimeout(() => {
        void (async () => {
          try {
            await onSwitch(next);
          } finally {
            beginSessionSwitchIsolation(400, 0);
            pickingRef.current = false;
          }
        })();
      }, 40);
    });
  };

  const startRename = (s: ReaderAskSessionSummary) => {
    if (locked) return;
    setEditingId(s.id);
    setEditTitle(s.title || "");
  };

  const commitRename = () => {
    const id = editingId;
    const title = editTitle;
    setEditingId("");
    if (!id) return;
    void onRename(id, title);
  };

  const cancelRename = () => {
    setEditingId("");
    setEditTitle("");
  };

  const handleDelete = (s: ReaderAskSessionSummary) => {
    if (locked || pickingRef.current) return;
    const name = s.title || "Hội thoại chưa đặt tên";
    const ok = globalThis.confirm?.(`Bạn chắc chắn muốn xóa hội thoại "${name}"? Thao tác này không thể hoàn tác.`);
    if (!ok) return;
    pickingRef.current = true;
    beginSessionSwitchIsolation(800, 0);
    void (async () => {
      try {
        await onDelete(s.id);
      } finally {
        pickingRef.current = false;
      }
    })();
  };

  return (
    <div
      className="aui-session-bar"
      data-reader-ai-sessions=""
      ref={rootRef}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="aui-session-row">
        <button
          type="button"
          className={`aui-session-trigger${open ? " is-open" : ""}`}
          aria-label="Chuyển cửa sổ hội thoại"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={locked || !hasSessions}
          title={label}
          onClick={() => {
            if (locked || !hasSessions) return;
            setOpen((v) => !v);
          }}
        >
          <span className="aui-session-trigger-label">{label}</span>
          <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
        </button>
        <button
          type="button"
          className="aui-session-btn"
          disabled={locked}
          title="Cửa sổ hội thoại mới"
          aria-label="Hội thoại mới"
          onClick={() => {
            if (locked || pickingRef.current) return;
            pickingRef.current = true;
            beginSessionSwitchIsolation(800);
            setOpen(false);
            setEditingId("");
            window.setTimeout(() => {
              void (async () => {
                try {
                  await onNew();
                } finally {
                  pickingRef.current = false;
                }
              })();
            }, 40);
          }}
        >
          {busy ? (
            <Loader2 className="aui-spin" size={14} strokeWidth={2.4} aria-hidden />
          ) : (
            <Plus size={14} strokeWidth={2.4} aria-hidden />
          )}
          <span>Hội thoại mới</span>
        </button>
      </div>

      {open && hasSessions ? (
        <ul
          id={listId}
          className="aui-session-list"
          role="listbox"
          aria-label="Hội thoại trước"
        >
          {sessions.map((s) => {
            const text = s.messageCount
              ? displaySessionTitle(s.title)
              : `${displaySessionTitle(s.title)} (trống)`;
            const selected = s.id === activeId;
            const editing = editingId === s.id;
            return (
              <li key={s.id} className="aui-session-row-item" role="presentation">
                {editing ? (
                  <div className="aui-session-edit">
                    <input
                      ref={editInputRef}
                      className="aui-session-edit-input"
                      value={editTitle}
                      maxLength={80}
                      aria-label="Tiêu đề hội thoại"
                      disabled={locked}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="aui-session-icon-btn"
                      aria-label="Lưu tiêu đề"
                      title="Lưu"
                      disabled={locked || !editTitle.trim()}
                      onClick={(e) => {
                        e.stopPropagation();
                        commitRename();
                      }}
                    >
                      <Check size={13} strokeWidth={2.5} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="aui-session-icon-btn"
                      aria-label="Hủy đổi tên"
                      title="Hủy"
                      disabled={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelRename();
                      }}
                    >
                      <X size={13} strokeWidth={2.5} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`aui-session-item${selected ? " is-active" : ""}`}
                      disabled={locked}
                      title={text}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (!selected && !locked) {
                          lockReaderAiNavigation(1000);
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selected) {
                          setOpen(false);
                          return;
                        }
                        pick(s.id);
                      }}
                    >
                      <span className="aui-session-item-title">{text}</span>
                      {selected ? (
                        <span className="aui-session-item-badge">Hiện tại</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="aui-session-icon-btn"
                      aria-label={`Đổi tên ${text}`}
                      title="Đổi tên"
                      disabled={locked}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startRename(s);
                      }}
                    >
                      <Pencil size={13} strokeWidth={2.4} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="aui-session-icon-btn is-danger"
                      aria-label={`Xóa ${text}`}
                      title="Xóa"
                      disabled={locked}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(s);
                      }}
                    >
                      <Trash2 size={13} strokeWidth={2.4} aria-hidden />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {errorText ? (
        <div className="aui-session-error" role="alert">
          {errorText}
        </div>
      ) : null}
    </div>
  );
}
