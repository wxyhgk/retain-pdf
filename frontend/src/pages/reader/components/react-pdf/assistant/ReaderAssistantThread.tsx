// assistant-ui reader Q&A: tách progress khỏi body; sau khi hoàn tất mới render Markdown + công thức + citation một lần.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
  useMessagePartText,
  useThreadRuntime,
  type TextMessagePartComponent,
} from "@assistant-ui/react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  GitBranch,
  ListTree,
  Loader2,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";
import {
  armReaderAiClickShield,
  hydrateProtectedImages,
  revokeHydratedImageUrls,
  injectCitationMarkers,
  isAgenticCitation,
  lockReaderAiNavigation,
  neutralizeMarkdownAnchors,
  peekFinalAnswerHtmlCache,
  renderCitationFooter,
  renderFinalAnswerHtml,
  renderStreamingPreviewHtml,
  shouldIgnoreReaderAiNavEvent,
  type AiCitationLike,
} from "../../../external.js";
import {
  CREDENTIALS_CHANGED_EVENT,
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
} from "../../../../../js/reader/ai/config.js";

/** Gợi ý kiểu sidebar Notion: icon + tiêu đề ngắn. */
const SUGGESTIONS: Array<{
  prompt: string;
  label: string;
  icon: typeof BookOpen;
}> = [
  {
    prompt: "Summarize the core content of this paper in a few sentences.",
    label: "Tóm tắt tài liệu",
    icon: BookOpen,
  },
  {
    prompt: "What are the main conclusions of this paper?",
    label: "Rút ý kết luận chính",
    icon: ListTree,
  },
  {
    prompt: "What methods or models did the authors use?",
    label: "Tóm lược phương pháp",
    icon: FlaskConical,
  },
  {
    prompt: "What key results or data are reported?",
    label: "Nêu kết quả chính",
    icon: Sparkles,
  },
];

export type ReaderAssistantThreadProps = {
  jobId?: string;
  citationsByMessageId?: Record<string, AiCitationLike[]>;
  progressByMessageId?: Record<string, string>;
  /** Bypass body từ store để token streaming render ngay. */
  contentByMessageId?: Record<string, string>;
  /** Id assistant đang generate hiện tại (status bypass, tránh aui không refresh running). */
  streamingAssistantId?: string;
  isRunning?: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  /** Mở cửa sổ hội thoại mới từ câu trả lời assistant (copy lịch sử tới điểm đó). */
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
  branchBusy?: boolean;
};

type AskUiContextValue = {
  jobId: string;
  citationsByMessageId: Record<string, AiCitationLike[]>;
  progressByMessageId: Record<string, string>;
  contentByMessageId: Record<string, string>;
  streamingAssistantId: string;
  isRunning: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
  branchBusy?: boolean;
};

const AskUiContext = createContext<AskUiContextValue>({
  jobId: "",
  citationsByMessageId: {},
  progressByMessageId: {},
  contentByMessageId: {},
  streamingAssistantId: "",
  isRunning: false,
});

function messageIsStreaming(
  message: unknown,
  streamingAssistantId = "",
  isRunning = false,
): boolean {
  const status = (message as { status?: { type?: string } } | null)?.status;
  if (status?.type === "running") return true;
  if (status?.type === "complete" || status?.type === "incomplete") return false;
  // aui đôi khi không map status của ExternalStore vào useMessage; dùng id bypass làm fallback.
  if (!isRunning || !streamingAssistantId) return false;
  const id = `${(message as { id?: string } | null)?.id || ""}`;
  const storeId = `${(message as { metadata?: { custom?: { storeId?: string } } } | null)
    ?.metadata?.custom?.storeId || ""}`;
  return id === streamingAssistantId || storeId === streamingAssistantId;
}

function useViewportStickBottom(
  viewportRef: RefObject<HTMLElement | null>,
  suppressAutoScroll = false,
) {
  const suppressRef = useRef(suppressAutoScroll);
  suppressRef.current = suppressAutoScroll;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const stick = { current: true };
    let raf = 0;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stick.current = distance < 120;
    };
    const scrollBottom = () => {
      // Khi branch/đổi session remount, cấm ép scroll xuống đáy; nếu không cảm giác như "refresh rồi nhảy".
      if (suppressRef.current) return;
      if (el.dataset.suppressAutoscroll === "1") return;
      if (!stick.current) return;
      el.scrollTop = el.scrollHeight;
    };
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scrollBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const mo = new MutationObserver((records) => {
      const structural = records.some(
        (r) => r.type === "childList" && (r.addedNodes.length > 0 || r.removedNodes.length > 0),
      );
      if (structural) schedule();
    });
    mo.observe(el, { childList: true, subtree: true });
    // Chỉ bám đáy ở lần mount đầu và khi không suppress.
    if (!suppressAutoScroll) schedule();
    return () => {
      el.removeEventListener("scroll", onScroll);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [viewportRef, suppressAutoScroll]);
}

function ThinkingRow({ label }: { label: string }) {
  return (
    <div className="aui-thinking" role="status" aria-live="polite">
      <Loader2 className="aui-spin" size={14} strokeWidth={2.4} aria-hidden />
      <span>{label || "Đang suy nghĩ..."}</span>
    </div>
  );
}

function readMessageCustom(message: unknown): {
  citations: AiCitationLike[];
  progress: string;
  storeId: string;
  messageId: string;
} {
  const m = message as {
    id?: string;
    metadata?: { custom?: Record<string, unknown> };
  } | null;
  const custom = m?.metadata?.custom || {};
  const citations = Array.isArray(custom.citations)
    ? (custom.citations as AiCitationLike[])
    : [];
  return {
    citations,
    progress: `${custom.progress || ""}`,
    storeId: `${custom.storeId || ""}`,
    messageId: `${m?.id || ""}`,
  };
}

function MarkdownText() {
  const { text } = useMessagePartText();
  const message = useMessage();
  const {
    citationsByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    onJumpCitation,
  } = useContext(AskUiContext);
  const meta = readMessageCustom(message);
  const streaming = messageIsStreaming(message, streamingAssistantId, isRunning);
  // Ưu tiên metadata.custom (ổn định); fallback về store map.
  const citations = meta.citations.length
    ? meta.citations
    : (citationsByMessageId[meta.storeId] || citationsByMessageId[meta.messageId] || []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Streaming: ưu tiên contentByMessageId (store/bypass trực tiếp), tránh cache aui Parts gây "xong mới render".
  const storeText =
    contentByMessageId[meta.storeId]
    || contentByMessageId[meta.messageId]
    || "";
  // Khi streaming không trim phần đuôi để tránh nuốt nửa câu; hoàn tất rồi mới trim.
  const bodyText = streaming
    ? `${storeText || text || ""}`
    : `${storeText || text || ""}`.trim();
  // Khi branch remount, id đổi nhưng body giống nhau: dùng cache để tránh nhấp nháy pending.
  const [finalHtml, setFinalHtml] = useState<string | null>(() =>
    (streaming || !bodyText ? null : peekFinalAnswerHtmlCache(bodyText)),
  );
  const lastFinalKeyRef = useRef("");

  const citationByRef = useMemo(() => {
    const map = new Map<string, AiCitationLike>();
    for (const citation of citations) {
      if (isAgenticCitation(citation)) {
        map.set(`${citation.ref}`, citation);
      }
    }
    return map;
  }, [citations]);

  const citeKey = useMemo(
    () => citations.map((c) => `${c.ref}:${c.block_id}:${c.page_idx}`).join("|"),
    [citations],
  );

  // Streaming: đồng bộ HTML nhẹ, tuyệt đối không đi qua MathJax async (nếu không sẽ "viết xong mới hiện").
  const streamingHtml = useMemo(
    () => (streaming && bodyText ? renderStreamingPreviewHtml(bodyText) : ""),
    [streaming, bodyText],
  );

  useEffect(() => {
    if (streaming) {
      setFinalHtml(null);
      lastFinalKeyRef.current = "";
      return;
    }
    if (!bodyText) {
      setFinalHtml("");
      return;
    }
    const key = `${bodyText}\n@@${citeKey}`;
    if (lastFinalKeyRef.current === key) return;
    const cached = peekFinalAnswerHtmlCache(bodyText);
    if (cached != null) {
      lastFinalKeyRef.current = key;
      setFinalHtml(cached);
      return;
    }
    let cancelled = false;
    lastFinalKeyRef.current = key;
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
  }, [streaming, bodyText, citeKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || streaming || finalHtml == null || !finalHtml) return;

    // Thu hồi blob URL hydrate vòng trước trước khi ghi đè (re-render tạo blob mới lặp lại,
    // blob cũ sẽ rò tới khi đóng trang - audit P1-5).
    revokeHydratedImageUrls(root);
    root.innerHTML = finalHtml;
    neutralizeMarkdownAnchors(root, {
      onOpen: () => true,
    });
    injectCitationMarkers(root, citationByRef, onJumpCitation || null);
    if (root.querySelectorAll("img[src]").length) {
      void hydrateProtectedImages(root);
    }
    const bubble = root.closest(".aui-msg-bubble");
    if (bubble instanceof HTMLElement) {
      renderCitationFooter(bubble, citations, {
        onJump: (citation) => {
          if (shouldIgnoreReaderAiNavEvent(null)) return;
          onJumpCitation?.(citation);
        },
        answerText: bodyText,
        max: 5,
      });
    }
  }, [streaming, finalHtml, citationByRef, citations, onJumpCitation, bodyText]);

  // Khi unmount (đổi message/đóng cửa sổ nổi), thu hồi blob của bubble này.
  useEffect(() => () => {
    revokeHydratedImageUrls(rootRef.current);
  }, []);

  if (streaming) {
    if (!bodyText.trim()) return null;
    return (
      <div
        className="aui-md aui-md-streaming"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: streamingHtml }}
      />
    );
  }

  if (!bodyText) return null;

  if (finalHtml == null) {
    return (
      <div
        className="aui-md aui-md-pending"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderStreamingPreviewHtml(bodyText) }}
      />
    );
  }

  if (!finalHtml) return null;
  return <div ref={rootRef} className="aui-md aui-md-final" />;
}

const StableMarkdownText: TextMessagePartComponent = MarkdownText;

function messagePlainText(message: unknown): string {
  const content = (message as { content?: unknown } | null)?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
        return `${(part as { text?: string }).text || ""}`;
      }
      return "";
    })
    .join("")
    .trim();
}

/**
 * Bộ chuyển node sibling.
 * - path: nhiều đường hỏi tiếp dưới cùng một câu trả lời
 * - answer: nhiều bản retry câu trả lời cho cùng một câu hỏi
 */
function MessageBranchPicker({ kind }: { kind: "path" | "answer" }) {
  const label = kind === "path" ? "Nhánh" : "Câu trả lời";
  return (
    <BranchPickerPrimitive.Root
      className={`aui-branch-picker aui-branch-picker-${kind}`}
      hideWhenSingleBranch
      title={kind === "path" ? "Đổi đường hỏi tiếp tách ra từ câu trả lời này" : "Đổi phiên bản câu trả lời"}
    >
      <span className="aui-branch-kind" aria-hidden>
        {label}
      </span>
      <BranchPickerPrimitive.Previous asChild>
        <button
          type="button"
          className="aui-branch-btn"
          aria-label={kind === "path" ? "Nhánh trước" : "Câu trả lời trước"}
        >
          <ChevronLeft size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-count" aria-live="polite">
        <BranchPickerPrimitive.Number />
        <span className="aui-branch-sep">/</span>
        <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <button
          type="button"
          className="aui-branch-btn"
          aria-label={kind === "path" ? "Nhánh sau" : "Câu trả lời sau"}
        >
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
}

/**
 * Mở "cửa sổ hội thoại mới" từ câu trả lời assistant:
 * copy lịch sử root -> câu trả lời này sang conversation mới, không đụng conversation gốc
 * (giống ChatGPT Branch in new chat).
 */
function AssistantMessage() {
  const message = useMessage();
  const {
    progressByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    onBranchFromAnswer,
    branchBusy,
  } = useContext(AskUiContext);
  const streaming = messageIsStreaming(message, streamingAssistantId, isRunning);
  const meta = readMessageCustom(message);
  const progress = meta.progress
    || progressByMessageId[meta.storeId]
    || progressByMessageId[meta.messageId]
    || "";
  const storeBody =
    contentByMessageId[meta.storeId]
    || contentByMessageId[meta.messageId]
    || "";
  const hasBody = storeBody.trim().length > 0 || messagePlainText(message).length > 0;
  const assistantId = meta.storeId || meta.messageId || message.id;
  const [forking, setForking] = useState(false);

  const handleBranch = async (event: ReactMouseEvent | ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onBranchFromAnswer || !assistantId || branchBusy || forking) return;
    setForking(true);
    try {
      // Chờ click kết thúc hoàn toàn rồi mới bật overlay toàn màn; tuyệt đối không che nút ngay từ pointerdown.
      await new Promise<void>((r) => {
        window.setTimeout(r, 0);
      });
      armReaderAiClickShield(1200, { overlayDelayMs: 0 });
      lockReaderAiNavigation(1200);
      const ok = await onBranchFromAnswer(assistantId);
      if (!ok) {
        // Khi thất bại cũng giữ một chút thời gian phản hồi (sessionError nằm ở thanh hội thoại).
        armReaderAiClickShield(200, { overlayDelayMs: 0 });
      }
    } finally {
      setForking(false);
    }
  };

  return (
    <MessagePrimitive.Root className="aui-msg aui-msg-assistant">
      <div className="aui-msg-avatar" aria-hidden>
        <Sparkles size={14} strokeWidth={2.1} />
      </div>
      <div className="aui-msg-stack">
      {streaming && progress ? <ThinkingRow label={progress} /> : null}
      {streaming && !progress && !hasBody ? <ThinkingRow label="Đang suy nghĩ..." /> : null}
      {hasBody ? (
        <div className="aui-msg-bubble">
          <MessagePrimitive.Parts components={{ Text: StableMarkdownText }} />
        </div>
      ) : null}
      {!streaming ? (
        <div
          className="aui-msg-actions"
          data-reader-ai-actions=""
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Đổi nhiều phiên bản trả lời cho cùng câu hỏi (vẫn trong cửa sổ hiện tại; mở cửa sổ thật dùng "Mở hội thoại mới" bên dưới). */}
          <MessageBranchPicker kind="answer" />
          <button
            type="button"
            className="aui-action-btn aui-action-btn-branch"
            onPointerDown={(e) => {
              // Chỉ stopPropagation, không preventDefault; nếu không có thể mất click.
              e.stopPropagation();
            }}
            onClick={(e) => {
              void handleBranch(e);
            }}
            disabled={Boolean(branchBusy || forking || !onBranchFromAnswer)}
            aria-label="Mở hội thoại mới từ câu trả lời này"
            title="Copy ngữ cảnh tới câu trả lời này và mở một hội thoại mới để hỏi tiếp (hội thoại gốc không đổi, tránh nhiễu context)"
          >
            {forking ? (
              <Loader2 className="aui-spin" size={13} strokeWidth={2.4} aria-hidden />
            ) : (
              <GitBranch size={13} strokeWidth={2.4} aria-hidden />
            )}
            {forking ? "Đang tách nhánh..." : "Mở hội thoại mới"}
          </button>
          <ActionBarPrimitive.Root className="aui-action-bar" hideWhenRunning>
            <ActionBarPrimitive.Reload asChild>
              <button
                type="button"
                className="aui-action-btn"
                aria-label="Tạo lại câu trả lời"
                title="Tạo thêm một phiên bản trả lời cho cùng câu hỏi (vẫn trong cửa sổ hiện tại)"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <RefreshCw size={13} strokeWidth={2.4} aria-hidden />
                Thử lại
              </button>
            </ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        </div>
      ) : null}
      </div>
    </MessagePrimitive.Root>
  );
}

function UserMessageWithBranch() {
  return (
    <MessagePrimitive.Root className="aui-msg aui-msg-user">
      <div className="aui-msg-bubble">
        <MessagePrimitive.Parts
          components={{
            Text: () => {
              const { text } = useMessagePartText();
              return <div className="aui-md-plain">{text}</div>;
            },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function EmptyState() {
  const thread = useThreadRuntime();
  return (
    <div className="aui-empty">
      <div className="aui-empty-mascot" aria-hidden>
        <span className="aui-empty-mascot-face">
          <Sparkles size={22} strokeWidth={1.9} />
        </span>
      </div>
      <h2 className="aui-empty-title">Luôn sẵn sàng. Tôi có thể giúp gì?</h2>
      <p className="aui-empty-sub">Trả lời dựa trên toàn bộ tài liệu hiện tại · bấm citation để nhảy trang</p>
      <div className="aui-suggestions" role="group" aria-label="Câu hỏi gợi ý">
        {SUGGESTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.prompt}
              type="button"
              className="aui-suggestion"
              onClick={() => {
                void thread.append(item.prompt);
              }}
            >
              <Icon size={15} strokeWidth={2} aria-hidden className="aui-suggestion-icon" />
              <span className="aui-suggestion-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReaderAssistantThread({
  jobId = "",
  citationsByMessageId = {},
  progressByMessageId = {},
  contentByMessageId = {},
  streamingAssistantId = "",
  isRunning = false,
  onJumpCitation,
  onBranchFromAnswer,
  branchBusy = false,
}: ReaderAssistantThreadProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useViewportStickBottom(viewportRef, branchBusy);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (branchBusy) {
      el.dataset.suppressAutoscroll = "1";
    } else {
      delete el.dataset.suppressAutoscroll;
    }
  }, [branchBusy]);

  const ctx = useMemo<AskUiContextValue>(
    () => ({
      jobId,
      citationsByMessageId,
      progressByMessageId,
      contentByMessageId,
      streamingAssistantId,
      isRunning,
      onJumpCitation,
      onBranchFromAnswer,
      branchBusy,
    }),
    [
      jobId,
      citationsByMessageId,
      progressByMessageId,
      contentByMessageId,
      streamingAssistantId,
      isRunning,
      onJumpCitation,
      onBranchFromAnswer,
      branchBusy,
    ],
  );

  const messageComponents = useMemo(
    () => ({
      UserMessage: UserMessageWithBranch,
      AssistantMessage,
    }),
    [],
  );

  // Không có model key thì cấm nhập/gửi (khớp trang chủ: chỉ nhận Settings -> Credentials).
  const [credTick, setCredTick] = useState(0);
  useEffect(() => {
    const bump = () => setCredTick((n) => n + 1);
    window.addEventListener("focus", bump);
    window.addEventListener("storage", bump);
    document.addEventListener(CREDENTIALS_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("storage", bump);
      document.removeEventListener(CREDENTIALS_CHANGED_EVENT, bump);
    };
  }, []);
  void credTick;
  const missingLlmKey = !hasModelApiKey();

  return (
    <AskUiContext.Provider value={ctx}>
      <ThreadPrimitive.Root className={`aui-thread${missingLlmKey ? " is-llm-locked" : ""}`}>
        <ThreadPrimitive.Viewport
          ref={viewportRef}
          className="aui-viewport"
          data-reader-ai-viewport="true"
          turnAnchor="top"
          // Khi branch/đổi session, tắt autoScroll của thư viện để tránh cả cột nhảy xuống đáy như "refresh".
          autoScroll={!branchBusy}
          scrollToBottomOnRunStart={!branchBusy}
        >
          <ThreadPrimitive.Empty>
            <EmptyState />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages components={messageComponents} />

          <ThreadPrimitive.ScrollToBottom className="aui-scroll-bottom" asChild>
            <button type="button" className="aui-scroll-bottom-btn" aria-label="Cuộn tới mới nhất">
              <ArrowDown size={16} strokeWidth={2.25} />
            </button>
          </ThreadPrimitive.ScrollToBottom>
        </ThreadPrimitive.Viewport>

        {missingLlmKey ? (
          <div className="aui-composer aui-composer-locked" role="alert">
            <p className="aui-llm-lock-msg">{MISSING_MODEL_API_KEY_MESSAGE}</p>
            <p className="aui-hint">Vào trang chủ "Cài đặt -&gt; Cài đặt API" để nhập model key rồi đặt câu hỏi.</p>
          </div>
        ) : (
          <ComposerPrimitive.Root className="aui-composer" compact>
            {/* Thẻ input bo góc liền khối kiểu Notion: body + toolbar đáy. */}
            <div className="aui-composer-shell">
              <ComposerPrimitive.Input
                className="aui-input"
                rows={2}
                placeholder="Nhờ AI làm bất cứ việc gì..."
                submitOnEnter
              />
              <div className="aui-composer-toolbar">
                <span className="aui-composer-chip" title="Phạm vi truy xuất">
                  <BookOpen size={12} strokeWidth={2.2} aria-hidden />
                  Tài liệu hiện tại
                </span>
                {/* Dừng/gửi loại trừ nhau và dùng cùng vị trí: nếu hai nút cùng tồn tại, "Dừng" sẽ là nút chết 95% thời gian. */}
                <div className="aui-composer-actions">
                  <ThreadPrimitive.If running>
                    <ComposerPrimitive.Cancel asChild>
                      <button type="button" className="aui-send aui-send-stop" aria-label="Dừng tạo">
                        <Square size={12} strokeWidth={2.6} aria-hidden />
                      </button>
                    </ComposerPrimitive.Cancel>
                  </ThreadPrimitive.If>
                  <ThreadPrimitive.If running={false}>
                    <ComposerPrimitive.Send asChild>
                      <button type="button" className="aui-send" aria-label="Gửi">
                        <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
                      </button>
                    </ComposerPrimitive.Send>
                  </ThreadPrimitive.If>
                </div>
              </div>
            </div>
            <p className="aui-hint">Enter để gửi · Shift+Enter xuống dòng · bấm [n] trong câu trả lời để nhảy trang</p>
          </ComposerPrimitive.Root>
        )}
      </ThreadPrimitive.Root>
    </AskUiContext.Provider>
  );
}
