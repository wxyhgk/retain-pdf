// UI hỏi đáp AI: thanh phiên + luồng tin nhắn + vùng nhập.
// Nội dung bong bóng vẫn là phần mệnh lệnh độc lập (handle answer-view);
// giữ nguyên id cấu trúc và hợp đồng kiểm thử.

import { memo, useEffect } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useReaderAiChat } from "../ai/use-reader-ai-chat.js";
import type { AiMessageEntry } from "../ai/answer-view.js";

const SUGGESTIONS = [
  "Kết luận chính của tài liệu này là gì?",
  "Tác giả đã dùng phương pháp hoặc mô hình nào?",
  "Có những kết quả hoặc dữ liệu quan trọng nào?",
];

const AiMessage = memo(function AiMessage({ entry }: { entry: AiMessageEntry }) {
  return (
    <article
      className={`reader-ai-message reader-ai-message-${entry.role}`}
      ref={entry.view.attachRoot}
    >
      <span className="reader-ai-message-role">{entry.title}</span>
      {/* body là div: Markdown tạo phần tử block, không thể đặt trong <p>. */}
      <div
        className="reader-ai-message-body-el"
        data-reader-ai-message-body="1"
        ref={entry.view.attachBody}
      ></div>
    </article>
  );
});

export function ReaderAiChat({ ports, controllerRef = null }) {
  const chat = useReaderAiChat(ports);
  useEffect(() => {
    if (controllerRef) {
      controllerRef.current = chat;
    }
  });
  const busy = chat.composer.phase === "busy";
  const disabled = chat.composer.phase === "disabled";
  const ready = chat.composer.phase === "ready" || chat.composer.phase === "idle";
  const onlyEmptySession = chat.sessions.length <= 1 && !(chat.sessions[0]?.messageCount);
  const showSessionChrome = chat.sessions.length > 1 || Boolean(chat.sessions[0]?.messageCount);
  const canSend = !disabled && !busy && `${chat.input || ""}`.trim().length > 0;

  function askSuggestion(text: string) {
    if (disabled || busy) return;
    chat.setInput(text);
    void chat.submit(text);
  }

  return (
    <div className="reader-ai-chat-root" data-reader-ai-chat="">
      {showSessionChrome ? (
        <div className="reader-ai-sessions" data-reader-ai-sessions="">
          <select
            id="reader-ai-session-select"
            className="reader-ai-session-select"
            aria-label="Chuyển hội thoại trước đây"
            value={chat.activeSessionId}
            disabled={chat.sessions.length <= 1 || busy}
            onChange={(event) => {
              const id = `${event.target.value || ""}`;
              if (id && id !== chat.activeSessionId) {
                void chat.switchConversation(id);
              }
            }}
          >
            {chat.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.messageCount ? session.title : `${session.title} (trống)`}
              </option>
            ))}
          </select>
          <button
            id="reader-ai-new-btn"
            type="button"
            className="reader-ai-session-btn"
            title="Tạo hội thoại mới"
            aria-label="Tạo hội thoại mới"
            disabled={busy}
            onClick={() => void chat.newConversation()}
          >
            <Plus size={14} strokeWidth={2.4} aria-hidden />
            <span>Hội thoại mới</span>
          </button>
          <button
            id="reader-ai-delete-btn"
            type="button"
            className="reader-ai-session-btn reader-ai-session-btn-danger"
            title="Xóa hội thoại hiện tại"
            aria-label="Xóa hội thoại hiện tại"
            disabled={onlyEmptySession || busy}
            onClick={() => void chat.deleteConversation()}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden />
            <span>Xóa</span>
          </button>
        </div>
      ) : (
        // Id hợp đồng vẫn gắn trong DOM để kiểm thử/tự động hóa định vị (gấp về mặt thị giác).
        <div className="reader-ai-sessions is-collapsed" data-reader-ai-sessions="" hidden>
          <select
            id="reader-ai-session-select"
            className="reader-ai-session-select"
            aria-hidden="true"
            tabIndex={-1}
            value={chat.activeSessionId}
            onChange={() => {}}
          >
            {chat.sessions.map((session) => (
              <option key={session.id} value={session.id}>{session.title}</option>
            ))}
          </select>
          <button id="reader-ai-new-btn" type="button" className="reader-ai-session-btn" onClick={() => void chat.newConversation()}>Hội thoại mới</button>
          <button id="reader-ai-delete-btn" type="button" className="reader-ai-session-btn reader-ai-session-btn-danger" disabled={onlyEmptySession} onClick={() => void chat.deleteConversation()}>Xóa</button>
        </div>
      )}

      <div id="reader-ai-thread" className="reader-ai-thread" aria-live="polite" ref={chat.threadRef}>
        {chat.messages.length === 0 ? (
          <div className="reader-float-ai-thread-hint" data-reader-ai-empty-hint="">
            <p>Đặt câu hỏi về toàn bộ tài liệu hiện tại</p>
            <span>Câu trả lời sẽ cố gắng trích dẫn các đoạn trong tài liệu; có thể nhấp để chuyển đến</span>
            <div className="reader-float-ai-suggestions" role="group" aria-label="Câu hỏi gợi ý">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="reader-float-ai-suggestion"
                  disabled={disabled || busy}
                  onClick={() => askSuggestion(text)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {chat.messages.map((entry) => (
          <AiMessage key={entry.id} entry={entry} />
        ))}
      </div>

      <form
        className="reader-ai-composer"
        data-reader-ai-composer=""
        onSubmit={(event) => {
          event.preventDefault();
          void chat.submit();
        }}
      >
        <textarea
          id="reader-ai-input"
          placeholder={disabled ? "Tạm thời không khả dụng" : "Nhập câu hỏi, Enter để gửi · Shift+Enter để xuống dòng"}
          aria-label="Nhập câu hỏi"
          rows={2}
          value={chat.input}
          disabled={disabled}
          onChange={(event) => chat.setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!busy && !disabled) {
                void chat.submit();
              }
            }
          }}
        ></textarea>
        <div className="reader-ai-composer-foot">
          <span
            id="reader-ai-status"
            className={`reader-ai-status is-${chat.composer.phase}${busy ? " is-busy" : ""}`}
          >
            {busy ? (
              <Loader2 className="reader-ai-status-spin" size={13} strokeWidth={2.4} aria-hidden />
            ) : null}
            <span>{chat.composer.text || (ready ? "Có thể đặt câu hỏi" : "")}</span>
          </span>
          <button
            id="reader-ai-submit-btn"
            type="submit"
            disabled={!canSend}
            aria-label={busy ? "Đang tạo" : "Gửi"}
          >
            {busy ? (
              <>
                <Loader2 className="reader-ai-status-spin" size={14} strokeWidth={2.4} aria-hidden />
                <span>Đang tạo</span>
              </>
            ) : (
              <>
                <Send size={14} strokeWidth={2.4} aria-hidden />
                <span>Gửi</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
