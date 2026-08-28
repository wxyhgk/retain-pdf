// Thanh nhập AI trang chủ: @ chọn tài liệu / bộ sưu tập + chip + gửi.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ArrowUp, BookOpen, FolderOpen, Loader2, Square, X } from "lucide-react";
import {
  filterDocumentOptions,
  loadPickerOptions,
  parseAtQuery,
} from "./document-picker.js";
import type { HomeAskScope } from "./types.js";
import { scopeKey } from "./types.js";

const MAX_SCOPES = 4;

export type HomeAskComposerProps = {
  disabled?: boolean;
  isRunning?: boolean;
  /** Tắt gửi và hiển thị nhắc nhở khi model chưa cấu hình Key. */
  missingLlmKey?: boolean;
  scopes: HomeAskScope[];
  onScopesChange: (next: HomeAskScope[]) => void;
  onSend: (question: string) => void;
  onStop?: () => void;
  /** hero: vùng nhập lớn ở trạng thái trống; dock: thanh cuối hội thoại. */
  variant?: "hero" | "dock";
};

export function HomeAskComposer({
  disabled = false,
  isRunning = false,
  missingLlmKey = false,
  scopes,
  onScopesChange,
  onSend,
  onStop,
  variant = "dock",
}: HomeAskComposerProps) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<HomeAskScope[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [atStart, setAtStart] = useState(-1);
  const [atQuery, setAtQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const listId = useId();

  const filtered = filterDocumentOptions(
    options,
    atQuery,
    scopes.map((s) => scopeKey(s)),
  );

  const ensureOptions = useCallback(async () => {
    if (optionsLoaded || loadingOpts) return;
    setLoadingOpts(true);
    try {
      const list = await loadPickerOptions(100);
      setOptions(list);
      setOptionsLoaded(true);
    } catch {
      setOptions([]);
      setOptionsLoaded(true);
    } finally {
      setLoadingOpts(false);
    }
  }, [loadingOpts, optionsLoaded]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setAtStart(-1);
    setAtQuery("");
    setHighlight(0);
  }, []);

  const pickScope = useCallback((item: HomeAskScope) => {
    if (!item.id) return;
    if (scopes.some((s) => scopeKey(s) === scopeKey(item))) {
      closePicker();
      return;
    }
    if (scopes.length >= MAX_SCOPES) {
      closePicker();
      return;
    }
    const el = textareaRef.current;
    const value = text;
    const start = atStart >= 0 ? atStart : value.lastIndexOf("@");
    if (start >= 0 && el) {
      const caret = el.selectionStart ?? value.length;
      const next = `${value.slice(0, start)}${value.slice(caret)}`.replace(/\s{2,}/g, " ");
      setText(next.trimStart());
    }
    onScopesChange([...scopes, item]);
    closePicker();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [atStart, closePicker, onScopesChange, scopes, text]);

  const syncAtState = useCallback((value: string, caret: number) => {
    const parsed = parseAtQuery(value, caret);
    if (!parsed) {
      if (pickerOpen) closePicker();
      return;
    }
    void ensureOptions();
    setAtStart(parsed.start);
    setAtQuery(parsed.query);
    setPickerOpen(true);
    setHighlight(0);
  }, [closePicker, ensureOptions, pickerOpen]);

  const handleSend = () => {
    const q = text.trim();
    if (!q || disabled || isRunning || missingLlmKey) return;
    onSend(q);
    setText("");
    closePicker();
  };

  const inputDisabled = disabled || missingLlmKey;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen && filtered.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        pickScope(filtered[highlight] || filtered[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node | null;
      const root = textareaRef.current?.closest(".home-ask-composer");
      if (root && t && root.contains(t)) return;
      closePicker();
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [closePicker, pickerOpen]);

  const canSend = Boolean(text.trim()) && !disabled && !isRunning && !missingLlmKey;

  const scopeHint = (() => {
    if (missingLlmKey) return "Hãy nhập API Key của model tại Cài đặt → API";
    if (!scopes.length) return "Toàn thư viện · @ bài viết hoặc bộ sưu tập";
    const cols = scopes.filter((s) => s.kind === "collection").length;
    const docs = scopes.filter((s) => s.kind === "document").length;
    const parts: string[] = [];
    if (cols) parts.push(`${cols} bộ sưu tập`);
    if (docs) parts.push(`${docs} bài`);
    return parts.join(" · ") || "Đã giới hạn";
  })();

  return (
    <div className={`home-ask-composer home-ask-composer-${variant}${missingLlmKey ? " is-locked" : ""}`}>
      {missingLlmKey ? (
        <div className="home-ask-key-banner" role="alert">
          <p>Chưa cấu hình API Key của model, không thể nhập hoặc đặt câu hỏi.</p>
          <button
            type="button"
            className="home-ask-key-banner-btn"
            onClick={() => {
              // Tương tự kiểm soát truy cập tải lên: mở "Cài đặt → Cài đặt API"
              // (lối vào thông thường duy nhất).
              document.dispatchEvent(
                new CustomEvent("retainpdf:open-browser-credentials"),
              );
            }}
          >
            Mở cài đặt
          </button>
        </div>
      ) : null}
      {scopes.length > 0 ? (
        <div className="home-ask-chips" aria-label="Phạm vi hỏi">
          {scopes.map((s) => (
            <span
              key={scopeKey(s)}
              className={`home-ask-chip${s.kind === "collection" ? " is-collection" : ""}`}
            >
              {s.kind === "collection" ? (
                <FolderOpen size={12} strokeWidth={2.2} aria-hidden />
              ) : (
                <BookOpen size={12} strokeWidth={2.2} aria-hidden />
              )}
              <span className="home-ask-chip-label" title={s.title}>
                {s.kind === "collection" ? `Bộ sưu tập · ${s.title}` : s.title}
              </span>
              <button
                type="button"
                className="home-ask-chip-remove"
                aria-label={`Xóa ${s.title}`}
                disabled={disabled || isRunning}
                onClick={() => onScopesChange(scopes.filter((x) => scopeKey(x) !== scopeKey(s)))}
              >
                <X size={12} strokeWidth={2.4} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="home-ask-composer-shell" aria-disabled={missingLlmKey || undefined}>
        {/* Lớp khóa chặn mọi thao tác nhập (ổn định hơn chỉ dùng disabled). */}
        {missingLlmKey ? (
          <div
            className="home-ask-composer-lock"
            aria-hidden
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          className="home-ask-input"
          rows={2}
          value={missingLlmKey ? "" : text}
          disabled={inputDisabled}
          readOnly={missingLlmKey}
          tabIndex={missingLlmKey ? -1 : 0}
          aria-disabled={missingLlmKey}
          placeholder={
            missingLlmKey
              ? "Vui lòng cấu hình API Key của model trước…"
              : scopes.length
                ? "Tiếp tục đặt câu hỏi… @ có thể chỉ định bài viết hoặc bộ sưu tập"
                : variant === "hero"
                  ? "Dùng AI làm mọi việc… Nhập @ để chỉ định bài viết hoặc bộ sưu tập"
                  : "Tiếp tục đặt câu hỏi… Nhập @ để chỉ định bài viết hoặc bộ sưu tập"
          }
          onChange={(e) => {
            if (missingLlmKey) return;
            const value = e.target.value;
            setText(value);
            syncAtState(value, e.target.selectionStart ?? value.length);
          }}
          onBeforeInput={(e) => {
            if (missingLlmKey) e.preventDefault();
          }}
          onPaste={(e) => {
            if (missingLlmKey) e.preventDefault();
          }}
          onClick={(e) => {
            if (missingLlmKey) {
              e.preventDefault();
              return;
            }
            const t = e.currentTarget;
            syncAtState(t.value, t.selectionStart ?? t.value.length);
          }}
          onKeyUp={(e) => {
            if (missingLlmKey) return;
            const t = e.currentTarget;
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              syncAtState(t.value, t.selectionStart ?? t.value.length);
            }
          }}
          onKeyDown={(e) => {
            if (missingLlmKey) {
              e.preventDefault();
              return;
            }
            onKeyDown(e);
          }}
        />

        {pickerOpen ? (
          <div className="home-ask-picker" role="listbox" id={listId} aria-label="Chọn tài liệu hoặc bộ sưu tập">
            {loadingOpts && !optionsLoaded ? (
              <div className="home-ask-picker-empty">
                <Loader2 className="home-ask-spin" size={14} aria-hidden />
                Đang tải…
              </div>
            ) : filtered.length === 0 ? (
              <div className="home-ask-picker-empty">
                {optionsLoaded ? "Không có bài viết hoặc bộ sưu tập phù hợp" : "Không có dữ liệu"}
              </div>
            ) : (
              filtered.map((item, index) => (
                <button
                  key={scopeKey(item)}
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={`home-ask-picker-item${index === highlight ? " is-active" : ""}${
                    item.kind === "collection" ? " is-collection" : ""
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pickScope(item)}
                >
                  {item.kind === "collection" ? (
                    <FolderOpen size={14} strokeWidth={2} aria-hidden />
                  ) : (
                    <BookOpen size={14} strokeWidth={2} aria-hidden />
                  )}
                  <span className="home-ask-picker-title">{item.title}</span>
                  <span className="home-ask-picker-kind">
                    {item.kind === "collection"
                      ? `Bộ sưu tập${item.document_count != null ? ` · ${item.document_count}` : ""}`
                      : "Bài viết"}
                  </span>
                </button>
              ))
            )}
            {scopes.length >= MAX_SCOPES ? (
              <div className="home-ask-picker-hint">Tối đa chỉ định {MAX_SCOPES} phạm vi</div>
            ) : (
              <div className="home-ask-picker-hint">Bộ sưu tập sẽ mở rộng các tài liệu trong đó để tìm kiếm</div>
            )}
          </div>
        ) : null}

        <div className="home-ask-toolbar">
          <span className="home-ask-scope-hint">{scopeHint}</span>
          {isRunning ? (
            <button
              type="button"
              className="home-ask-send home-ask-send-stop"
              aria-label="Dừng tạo"
              title="Dừng tạo"
              disabled={!onStop}
              onClick={() => onStop?.()}
            >
              <Square size={12} strokeWidth={2.6} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="home-ask-send"
              aria-label="Gửi"
              disabled={!canSend}
              onClick={handleSend}
            >
              <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
