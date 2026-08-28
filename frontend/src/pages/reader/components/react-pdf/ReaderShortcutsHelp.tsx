// Hướng dẫn phím tắt: icon bàn phím ở thanh đáy + danh sách nổi; h / ? cũng mở được.

import { useEffect, useId, useRef, useState } from "react";
import { Keyboard } from "lucide-react";

const SHORTCUT_GROUPS: { title: string; items: { keys: string; desc: string }[] }[] = [
  {
    title: "Chuyển trang",
    items: [
      { keys: "J · ↓ · PgDn", desc: "Trang sau" },
      { keys: "K · ↑ · PgUp", desc: "Trang trước" },
      { keys: "Home / End", desc: "Trang đầu / cuối" },
      { keys: "Bấm số trang đáy", desc: "Nhập số trang để nhảy" },
    ],
  },
  {
    title: "Zoom",
    items: [
      { keys: "+ / −", desc: "Phóng to / thu nhỏ" },
      { keys: "0", desc: "Reset về mặc định của mode" },
      { keys: "Bấm phần trăm", desc: "Reset về mặc định của mode" },
    ],
  },
  {
    title: "Mode",
    items: [
      { keys: "1", desc: "Bản gốc" },
      { keys: "2", desc: "Bản dịch" },
      { keys: "3", desc: "Đọc đối chiếu" },
    ],
  },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function ReaderShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key;
      if (key === "?" || key === "h" || key === "H" || key === "/") {
        // Trên một số bàn phím, / là ? khi chưa shift; cũng chấp nhận h.
        if (key === "/" && !event.shiftKey) {
          // / đơn lẻ không mở trợ giúp để tránh chạm nhầm.
          return;
        }
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="reader-react-shortcuts" ref={rootRef} data-reader-shortcuts="">
      <button
        type="button"
        className={`reader-react-hud-btn reader-react-shortcuts-btn${open ? " is-active" : ""}`}
        aria-label="Hướng dẫn phím tắt"
        aria-expanded={open}
        aria-controls={panelId}
        title="Phím tắt (H hoặc ?)"
        onClick={() => setOpen((v) => !v)}
      >
        <Keyboard className="reader-react-shortcuts-icon" size={16} strokeWidth={2.25} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          className="reader-react-shortcuts-panel"
          role="dialog"
          aria-label="Phím tắt reader"
        >
          <div className="reader-react-shortcuts-head">
            <strong>Phím tắt</strong>
            <button
              type="button"
              className="reader-react-shortcuts-close"
              aria-label="Đóng"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="reader-react-shortcuts-body">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className="reader-react-shortcuts-group">
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={`${group.title}-${item.keys}`}>
                      <kbd>{item.keys}</kbd>
                      <span>{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="reader-react-shortcuts-foot">Phím tắt không kích hoạt khi đang ở trong ô nhập</p>
        </div>
      ) : null}
    </div>
  );
}
