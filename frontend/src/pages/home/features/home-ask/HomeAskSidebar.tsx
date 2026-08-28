// Lịch sử AI kiểu Notion: có thể thu gọn + thao tác hội thoại + nhóm theo thời gian.

import { useEffect, useRef, useState } from "react";
import {
  Check,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { HomeAskSession } from "./use-home-ask-runtime.js";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupLabel(updatedAt: string, now = Date.now()): string {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return "Sớm hơn";
  const day = startOfDay(new Date(t));
  const today = startOfDay(new Date(now));
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return "7 ngày qua";
  if (diffDays < 30) return "30 ngày qua";
  return "Sớm hơn";
}

function groupSessions(sessions: HomeAskSession[]) {
  const order = ["Hôm nay", "Hôm qua", "7 ngày qua", "30 ngày qua", "Sớm hơn"];
  const map = new Map<string, HomeAskSession[]>();
  for (const s of sessions) {
    const label = groupLabel(s.updatedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(s);
  }
  return order
    .filter((k) => map.has(k))
    .map((label) => ({ label, items: map.get(label)! }));
}

function displayTitle(raw: string): string {
  const m = `${raw || ""}`.match(/^fork-(\d+)-(.*)$/i);
  if (!m) return raw || "Hội thoại chưa đặt tên";
  const rest = m[2].trim();
  return rest ? `${rest} · Nhánh${m[1]}` : `Nhánh${m[1]}`;
}

export type HomeAskSidebarProps = {
  sessions: HomeAskSession[];
  activeId: string;
  loading?: boolean;
  busy?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void | Promise<boolean>;
};

export function HomeAskSidebar({
  sessions,
  activeId,
  loading = false,
  busy = false,
  collapsed = false,
  onCollapsedChange,
  onNew,
  onSelect,
  onDelete,
  onRename,
}: HomeAskSidebarProps) {
  const groups = groupSessions(sessions);
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const el = editInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingId]);

  const startRename = (s: HomeAskSession) => {
    if (busy) return;
    setEditingId(s.id);
    // Đặt tiêu đề ban đầu; phần văn bản sau tiền tố fork-n cũng có thể đổi toàn bộ.
    setEditTitle(s.title || "");
  };

  const cancelRename = () => {
    setEditingId("");
    setEditTitle("");
  };

  const commitRename = async () => {
    const id = editingId;
    const title = editTitle.trim();
    if (!id) return;
    if (!title) {
      cancelRename();
      return;
    }
    setEditingId("");
    await onRename(id, title);
  };

  if (collapsed) {
    return (
      <aside
        className="home-ask-sidebar is-collapsed"
        aria-label="Lịch sử hội thoại (đã thu gọn)"
      >
        <button
          type="button"
          className="home-ask-sidebar-icon-btn"
          title="Mở rộng lịch sử"
          aria-label="Mở rộng lịch sử hội thoại"
          aria-expanded={false}
          onClick={() => onCollapsedChange?.(false)}
        >
          <PanelLeftOpen size={16} strokeWidth={2.1} aria-hidden />
        </button>
        <button
          type="button"
          className="home-ask-sidebar-icon-btn"
          disabled={busy}
          title="Hội thoại mới"
          aria-label="Hội thoại mới"
          onClick={onNew}
        >
          <MessageSquarePlus size={16} strokeWidth={2.1} aria-hidden />
        </button>
      </aside>
    );
  }

  return (
    <aside className="home-ask-sidebar" aria-label="Lịch sử hội thoại">
      <div className="home-ask-sidebar-head">
        <div className="home-ask-sidebar-head-row">
          <span className="home-ask-sidebar-brand">Lịch sử</span>
          <button
            type="button"
            className="home-ask-sidebar-icon-btn home-ask-sidebar-collapse"
            title="Thu gọn thanh bên"
            aria-label="Thu gọn lịch sử hội thoại"
            aria-expanded={true}
            onClick={() => onCollapsedChange?.(true)}
          >
            <PanelLeftClose size={15} strokeWidth={2.1} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className="home-ask-sidebar-new"
          disabled={busy}
          title="Hội thoại mới"
          onClick={onNew}
        >
          <MessageSquarePlus size={15} strokeWidth={2.1} aria-hidden />
          <span>Đoạn hội thoại mới</span>
        </button>
      </div>

      <div className="home-ask-sidebar-scroll">
        {loading && sessions.length === 0 ? (
          <p className="home-ask-sidebar-empty">Đang tải lịch sử…</p>
        ) : sessions.length === 0 ? (
          <p className="home-ask-sidebar-empty">Chưa có lịch sử hội thoại</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="home-ask-sidebar-group">
              <div className="home-ask-sidebar-group-label">{g.label}</div>
              <ul className="home-ask-sidebar-list">
                {g.items.map((s) => {
                  const active = s.id === activeId;
                  const title = displayTitle(s.title);
                  const editing = editingId === s.id;
                  return (
                    <li key={s.id} className="home-ask-sidebar-row">
                      {editing ? (
                        <div className="home-ask-sidebar-edit">
                          <input
                            ref={editInputRef}
                            className="home-ask-sidebar-edit-input"
                            value={editTitle}
                            maxLength={80}
                            disabled={busy}
                            aria-label="Tiêu đề hội thoại"
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitRename();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            type="button"
                            className="home-ask-sidebar-icon-btn"
                            disabled={busy || !editTitle.trim()}
                            aria-label="Lưu tiêu đề"
                            title="Lưu"
                            onClick={(e) => {
                              e.stopPropagation();
                              void commitRename();
                            }}
                          >
                            <Check size={13} strokeWidth={2.5} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="home-ask-sidebar-icon-btn"
                            disabled={busy}
                            aria-label="Hủy đổi tên"
                            title="Hủy"
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
                            className={`home-ask-sidebar-item${active ? " is-active" : ""}`}
                            disabled={busy}
                            title={`${title} (nhấp đúp để đổi tên)`}
                            onClick={() => onSelect(s.id)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startRename(s);
                            }}
                          >
                            <span className="home-ask-sidebar-item-title">{title}</span>
                          </button>
                          <button
                            type="button"
                            className="home-ask-sidebar-rename"
                            disabled={busy}
                            aria-label={`Đổi tên ${title}`}
                            title="Đổi tên"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(s);
                            }}
                          >
                            <Pencil size={12} strokeWidth={2.2} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="home-ask-sidebar-del"
                            disabled={busy}
                            aria-label={`Xóa ${title}`}
                            title="Xóa"
                            onClick={(e) => {
                              e.stopPropagation();
                              const ok = globalThis.confirm?.(`Xóa hội thoại «${title}»?`);
                              if (ok) onDelete(s.id);
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2.2} aria-hidden />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
