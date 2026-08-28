// Trang chủ AI Danh sách tin nhắn：Trọng lượng nhẹ markdown xem trước + Trình đọc bỏ qua tham chiếu

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FlaskConical, ListTree, Loader2, Sparkles } from "lucide-react";
import {
  injectCitationMarkers,
  isAgenticCitation,
  neutralizeMarkdownAnchors,
  renderCitationFooter,
  type AiCitationLike,
} from "../../../../js/reader/ai/answer-enhance.js";
import {
  renderFinalAnswerHtml,
  renderStreamingPreviewHtml,
} from "../../../../js/reader/ai/render-answer-html.js";
import { buildFrontendPageUrl } from "../../../../js/config/runtime.js";
import { navigateToReader } from "../reader/navigate-to-reader.js";
import type { HomeAskCitation, HomeAskMessage } from "./types.js";

export const HOME_ASK_SUGGESTIONS: Array<{
  prompt: string;
  label: string;
  icon: typeof BookOpen;
}> = [
  {
    prompt: "Trong các tài liệu vừa nhập, chủ đề nào đáng đọc ưu tiên?",
    label: "Duyệt chủ đề kho lưu trữ",
    icon: BookOpen,
  },
  {
    prompt: "So sánh kết luận chính của các tài liệu khác nhau về cùng một vấn đề.",
    label: "So sánh kết luận",
    icon: ListTree,
  },
  {
    prompt: "Có các phương pháp hoặc thiết kế thí nghiệm nào thường dùng?",
    label: "Phân loại mô hình phương pháp",
    icon: FlaskConical,
  },
  {
    prompt: "Tóm tắt một bài báo cốt lõi trong thư viện bằng vài câu.",
    label: "Tóm tắt nhanh một bài",
    icon: Sparkles,
  },
];

function openCitation(citation: HomeAskCitation) {
  const jobId = `${citation.job_id || ""}`.trim();
  if (!jobId) return;
  const pageIdx = Number.isFinite(Number(citation.page_idx))
    ? Math.max(0, Math.floor(Number(citation.page_idx)))
    : undefined;
  const blockId = `${citation.block_id || ""}`.trim();
  const params: Record<string, string | number> = { job_id: jobId };
  if (pageIdx !== undefined) params.page_idx = pageIdx;
  if (blockId) params.block_id = blockId;
  const url = buildFrontendPageUrl("./reader.html", params);
  navigateToReader(url);
}

function AssistantBody({
  message,
}: {
  message: HomeAskMessage;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const streaming = message.status === "streaming";
  const bodyText = `${message.content || ""}`;
  const citations = (message.citations || []) as AiCitationLike[];
  const [finalHtml, setFinalHtml] = useState<string | null>(null);

  const citationByRef = useMemo(() => {
    const map = new Map<string, AiCitationLike>();
    for (const c of citations) {
      if (isAgenticCitation(c)) map.set(`${c.ref}`, c);
    }
    return map;
  }, [citations]);

  const streamingHtml = useMemo(
    () => (streaming && bodyText ? renderStreamingPreviewHtml(bodyText) : ""),
    [streaming, bodyText],
  );

  useEffect(() => {
    if (streaming) {
      setFinalHtml(null);
      return;
    }
    if (!bodyText.trim()) {
      setFinalHtml("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const html = await renderFinalAnswerHtml(bodyText);
        if (!cancelled) setFinalHtml(html);
      } catch {
        if (!cancelled) setFinalHtml(renderStreamingPreviewHtml(bodyText));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streaming, bodyText]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || streaming || finalHtml == null || !finalHtml) return;
    root.innerHTML = finalHtml;
    neutralizeMarkdownAnchors(root, { onOpen: () => true });
    injectCitationMarkers(root, citationByRef, (c) => openCitation(c as HomeAskCitation));
    const bubble = root.closest(".home-ask-msg-bubble");
    if (bubble instanceof HTMLElement) {
      renderCitationFooter(bubble, citations, {
        onJump: (c) => openCitation(c as HomeAskCitation),
        answerText: bodyText,
        max: 5,
      });
    }
  }, [streaming, finalHtml, citationByRef, citations, bodyText]);

  if (streaming) {
    if (!bodyText.trim()) return null;
    return (
      <div
        className="home-ask-md home-ask-md-streaming"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: streamingHtml }}
      />
    );
  }

  if (!bodyText.trim()) return null;
  if (finalHtml == null) {
    return (
      <div
        className="home-ask-md home-ask-md-pending"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderStreamingPreviewHtml(bodyText) }}
      />
    );
  }
  return <div ref={rootRef} className="home-ask-md home-ask-md-final" />;
}

export type HomeAskThreadProps = {
  messages: HomeAskMessage[];
  isRunning?: boolean;
};

export function HomeAskThread({ messages, isRunning = false }: HomeAskThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const empty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isRunning]);

  // Trạng thái trống bởi HomeAskView của hero Kết xuất khu vực（Notion：thăm hỏi sức khỏe + Đầu vào trung tâm + Khuyến nghị）
  if (empty) {
    return null;
  }

  return (
    <div className="home-ask-thread" role="log" aria-live="polite">
      {messages.map((m) => {
        if (m.role === "user") {
          return (
            <div key={m.id} className="home-ask-msg home-ask-msg-user">
              <div className="home-ask-msg-bubble">
                <div className="home-ask-md-plain">{m.content}</div>
              </div>
            </div>
          );
        }
        const streaming = m.status === "streaming";
        const hasBody = Boolean(m.content?.trim());
        return (
          <div key={m.id} className="home-ask-msg home-ask-msg-assistant">
            {streaming && m.progress ? (
              <div className="home-ask-thinking" role="status">
                <Loader2 className="home-ask-spin" size={13} strokeWidth={2.4} aria-hidden />
                <span>{m.progress}</span>
              </div>
            ) : null}
            {streaming && !m.progress && !hasBody ? (
              <div className="home-ask-thinking" role="status">
                <Loader2 className="home-ask-spin" size={13} strokeWidth={2.4} aria-hidden />
                <span>Đang suy nghĩ…</span>
              </div>
            ) : null}
            {hasBody || m.status === "error" ? (
              <div className={`home-ask-msg-bubble${m.status === "error" ? " is-error" : ""}`}>
                <AssistantBody message={m} />
              </div>
            ) : null}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
