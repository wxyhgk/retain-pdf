// 主页 AI 消息列表：轻量 markdown 预览 + 引用跳阅读器

import { useEffect, useRef } from "react";
import { BookOpen, FlaskConical, ListTree, Loader2, Sparkles } from "lucide-react";
import { AiMarkdownAnswer, type AiCitationLike } from "@retainpdf/reader/ai";
import { buildReaderUrl } from "@/platform/navigation/pages.js";
import { navigateToReader } from "@/features/reader/domain.js";
import type { HomeAskCitation, HomeAskMessage } from "../domain/types.js";
import { AgentOperationCard } from "./operations/AgentOperationCard.js";
import type {
  AgentOperationAction,
  AgentOperationEntry,
  AgentOperationPerformOptions,
  AgentOperationView,
  AgentConfirmationMode,
} from "../domain/operations/types.js";

export const HOME_ASK_SUGGESTIONS: Array<{
  prompt: string;
  label: string;
  icon: typeof BookOpen;
}> = [
  {
    prompt: "最近入库的文献里，有哪些值得优先阅读的主题？",
    label: "浏览馆藏主题",
    icon: BookOpen,
  },
  {
    prompt: "帮我对比不同文献对同一问题的主要结论。",
    label: "跨文献对比结论",
    icon: ListTree,
  },
  {
    prompt: "有哪些常用的方法或实验设计？",
    label: "梳理方法模型",
    icon: FlaskConical,
  },
  {
    prompt: "用几句话总结图书馆里一篇核心论文。",
    label: "快速总结一篇",
    icon: Sparkles,
  },
];

function openCitation(citation: HomeAskCitation) {
  const jobId = `${citation.job_id || ""}`.trim();
  if (!jobId) return;
  const rawPageIdx = citation.page_idx;
  const pageIdx = rawPageIdx !== null && rawPageIdx !== undefined && `${rawPageIdx}`.trim() !== "" && Number.isFinite(Number(rawPageIdx))
    ? Math.max(0, Math.floor(Number(citation.page_idx)))
    : undefined;
  const blockId = `${citation.block_id || ""}`.trim();
  const url = buildReaderUrl(jobId, { page: pageIdx ?? null, blockId });
  if (!url) return;
  navigateToReader(url);
}

function AssistantBody({
  message,
}: {
  message: HomeAskMessage;
}) {
  const streaming = message.status === "streaming";
  const bodyText = `${message.content || ""}`;
  const citations = (message.citations || []) as AiCitationLike[];
  return (
    <AiMarkdownAnswer
      content={bodyText}
      streaming={streaming}
      citations={citations}
      className="home-ask-md"
      streamingClassName="home-ask-md-streaming"
      pendingClassName="home-ask-md-pending"
      finalClassName="home-ask-md-final"
      onJumpCitation={(citation) => openCitation(citation as HomeAskCitation)}
    />
  );
}

export type HomeAskThreadProps = {
  messages: HomeAskMessage[];
  isRunning?: boolean;
  operationsByRequestMessage?: Record<string, AgentOperationEntry[]>;
  loadCandidate?: (operation: AgentOperationView) => Promise<Blob>;
  confirmationMode?: AgentConfirmationMode;
  onOperationAction?: (
    action: AgentOperationAction,
    operation: AgentOperationView,
    options?: AgentOperationPerformOptions,
  ) => void | Promise<void>;
};

export function HomeAskThread({
  messages,
  isRunning = false,
  operationsByRequestMessage = {},
  loadCandidate = async () => new Blob(),
  confirmationMode = "explicit",
  onOperationAction = () => {},
}: HomeAskThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const empty = messages.length === 0;
  const operationEntries = (() => {
    const seen = new Set<string>();
    const entries: AgentOperationEntry[] = [];
    for (const group of Object.values(operationsByRequestMessage)) {
      for (const entry of group) {
        const operationId = `${entry.remote.operation_id || ""}`.trim();
        if (!operationId || seen.has(operationId)) continue;
        seen.add(operationId);
        entries.push(entry);
      }
    }
    return entries;
  })();
  const operationRenderKey = operationEntries
    .map((entry) => [
      entry.remote.operation_id,
      entry.remote.status,
      entry.remote.current_attempt,
      entry.remote.latest_event_seq || 0,
      entry.pendingAction || "",
    ].join(":"))
    .join("|");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isRunning, operationRenderKey]);

  // 空态由 HomeAskView 的 hero 区渲染（Notion：问候 + 居中输入 + 建议）
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
                <span>思考中…</span>
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
      {operationEntries.map((entry) => (
        <div key={entry.remote.operation_id} className="home-ask-msg home-ask-msg-operation">
          <AgentOperationCard
            entry={entry}
            loadCandidate={loadCandidate}
            confirmationMode={confirmationMode}
            onAction={onOperationAction}
          />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
