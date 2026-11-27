// 快捷键说明：底栏键盘图标 + 浮层列表；h / ? 也可打开。

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { READER_SHORTCUT_HELP } from "../../hooks/reader-keyboard-map.js";
import { collectShortcutGroups, useReaderContributions } from "../../extensions/registry.js";

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
  // 阅读页自己的几组 + 扩展登记的（贡献表的 shortcuts，组名是扩展名）。
  const contributions = useReaderContributions();
  const groups = useMemo(() => [...READER_SHORTCUT_HELP, ...collectShortcutGroups(contributions)], [contributions]);

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
        // / 在部分键盘上是 ? 未 shift；也接受 h
        if (key === "/" && !event.shiftKey) {
          // 单独 / 不当帮助，避免误触
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
        aria-label="快捷键说明"
        aria-expanded={open}
        aria-controls={panelId}
        title="快捷键（H 或 ?）"
        onClick={() => setOpen((v) => !v)}
      >
        {/* 一个轻的「?」字（2026-11-28：以前是键盘方框图标，底栏右边看着重）。 */}
        <span className="reader-react-shortcuts-mark" aria-hidden>?</span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="reader-react-shortcuts-panel reader-floating-surface"
          role="dialog"
          aria-label="阅读器快捷键"
        >
          <div className="reader-react-shortcuts-head">
            <strong>快捷键</strong>
            <button
              type="button"
              className="reader-react-shortcuts-close reader-floating-close"
              aria-label="关闭"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="reader-react-shortcuts-body">
            {groups.map((group) => (
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
          <p className="reader-react-shortcuts-foot">在输入框内不会触发快捷键</p>
        </div>
      ) : null}
    </div>
  );
}
