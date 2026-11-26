// 主对话（后端库是正本）和提问窗之间的转换，纯函数，测试在 frontend/web/tests/reader/reader-ask-conversation.test.mjs：
// - 书上的位置 → 结构化出处（追加消息的 selection、session/prompt 的 _meta.retainpdf.selection，同一个写法）；
// - 库里的消息 → 提问窗的 AskMessage（问题上面的小标签、副对话的结论卡片、压缩点）；
// - 答完的一轮 → 追加消息的请求（问和答一起，带幂等号、出处、记下的记忆）。
// 接口见 docs/api/16-AI/02-主对话和记忆.md。

import type { AskMemoryNotice, AskMessage, AskMessageContext, AskTurnRecord } from "@retainpdf/ask";
import type { AskCompactionPointView, AskConversationMessageInput, AskConversationMessageRecord, AskMemoryRecord, AskSelectionInput } from "@retainpdf/api/ai";

import type { ReaderAskAnchor } from "../contracts/ask.js";

/** 正在读的书：出处要带的编号。 */
export type AskBook = { documentId: string; jobId: string; versionId: string | null };

const TEXT_LIMIT = 50000;
const THOUGHT_LIMIT = 20000;

function clip(text: string | null | undefined, limit: number): string {
  const value = `${text || ""}`;
  return value.length > limit ? value.slice(0, limit) : value;
}

/** 书上的位置 → 结构化出处（只放有值的；块编号前端认出来的那一块）。 */
export function anchorSelection(anchor: ReaderAskAnchor, book: AskBook): AskSelectionInput {
  const selection: AskSelectionInput = { page: anchor.page, pane: anchor.pane, item_ids: anchor.itemId ? [anchor.itemId] : [] };
  if (book.documentId) selection.document_id = book.documentId;
  if (book.jobId) selection.job_id = book.jobId;
  if (book.versionId) selection.translation_version = book.versionId;
  if (anchor.selection) selection.selected_text = anchor.selection;
  if (anchor.section) selection.section = anchor.section;
  if (anchor.sourceText) selection.source_text = anchor.sourceText;
  if (anchor.translatedText) selection.translated_text = anchor.translatedText;
  return selection;
}

/** 库里的出处 → 书上的位置（重新回答、改一问时照用原来的出处；画书页上的「?」）。point 由宿主按块算。 */
export function selectionAnchor(selection: NonNullable<AskConversationMessageRecord["selection"]>, point: ReaderAskAnchor["point"] = null): ReaderAskAnchor {
  return {
    pane: selection.pane === "source" ? "source" : "translated",
    page: selection.page,
    itemId: selection.item_ids?.[0] ?? null,
    selection: selection.selected_text || "",
    sourceText: selection.source_text || "",
    translatedText: selection.translated_text || "",
    section: selection.section || "",
    point,
  };
}

/** 问题上面的小标签：「第 56 页 · 2.1 节」；别的书里问的写「别的书」，点了不跳。 */
export function selectionContext(selection: AskConversationMessageRecord["selection"], currentDocumentId: string): AskMessageContext | null {
  if (!selection?.page) return null;
  const elsewhere = Boolean(selection.document_id && currentDocumentId && selection.document_id !== currentDocumentId);
  const label = [elsewhere ? "别的书" : "", `第 ${selection.page} 页`, selection.section || ""].filter(Boolean).join(" · ");
  return { page: selection.page, label, data: selection };
}

/** 一条改过的问原来问的、原来答的（作废的那条问和紧跟它的回答）。 */
function rewroteFrom(records: readonly AskConversationMessageRecord[], editedFrom: string | null | undefined) {
  if (!editedFrom) return undefined;
  const at = records.findIndex((record) => record.message_id === editedFrom);
  if (at < 0) return undefined;
  const answer = records[at + 1]?.role === "assistant" ? plainSnippet(records[at + 1]!.text) : "";
  return { question: records[at]!.text, ...(answer ? { answer } : {}) };
}

/** 回答的开头一小段纯文字（去掉代码块、行间公式、Markdown 记号），给「改过」点开看。 */
export function plainSnippet(markdown: string, limit = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " … ")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const chars = [...text];
  return chars.length > limit ? `${chars.slice(0, limit).join("")}…` : text;
}

/**
 * 库里的消息 → 提问窗的消息。作废的（改过一问以后）不画，改后的问上面画「改过」；side_summary 画成结论卡片；
 * seq 正好是压缩点的那条后面画分隔线。
 */
export function recordsToMessages(
  records: readonly AskConversationMessageRecord[],
  compactions: readonly Pick<AskCompactionPointView, "covers_to_seq">[] = [],
  currentDocumentId = "",
): AskMessage[] {
  const cut = new Set(compactions.map((point) => point.covers_to_seq));
  return records.filter((record) => !record.superseded_at).map((record) => {
    const compacted = cut.has(record.seq) ? { compactedBefore: true } : {};
    if (record.role === "user") {
      const rewrote = rewroteFrom(records, record.edited_from);
      return {
        id: record.message_id, role: "user", text: record.text, context: selectionContext(record.selection, currentDocumentId),
        ...(rewrote ? { marks: { rewrote } } : {}),
      };
    }
    if (record.role === "side_summary") {
      return {
        id: record.message_id,
        role: "assistant",
        text: `**深挖的结论**\n\n${record.text}`,
        marks: { sideSummary: { sideId: record.side_conversation_id }, ...compacted },
      };
    }
    return {
      id: record.message_id,
      role: "assistant",
      text: record.text,
      thought: record.thought,
      usage: (record.usage as Record<string, unknown> | null) ?? null,
      ...(compacted.compactedBefore ? { marks: compacted } : {}),
    };
  });
}

/** 答完的一轮 → 追加消息的请求。clientId 是这一轮的幂等号前缀（网络重试不会追加两次）；editedFrom 是改的那条问（库里的编号）。 */
export function turnToAppend(turn: AskTurnRecord, documentId: string, clientId: string, editedFrom?: string | null): AskConversationMessageInput[] {
  const selection = (turn.context?.meta as { retainpdf?: { selection?: AskSelectionInput } } | undefined)?.retainpdf?.selection ?? null;
  // 两处都给又不一样后端回 400：出处里有书就以出处为准。
  const book = selection?.document_id || documentId || null;
  const common = { agent_id: turn.agentId || null, document_id: book };
  const usage = turn.answer.usage && JSON.stringify(turn.answer.usage).length <= 4096 ? turn.answer.usage : null;
  return [
    { ...common, role: "user", text: clip(turn.question.text, TEXT_LIMIT), selection, client_message_id: `${clientId}-q`, ...(editedFrom ? { edited_from: editedFrom } : {}) },
    {
      ...common,
      role: "assistant",
      text: clip(turn.answer.text, TEXT_LIMIT),
      thought: turn.answer.thought ? clip(turn.answer.thought, THOUGHT_LIMIT) : null,
      usage,
      client_message_id: `${clientId}-a`,
      memory_ids: turn.memoryIds.slice(0, 10) as AskConversationMessageInput["memory_ids"],
    },
  ];
}

/**
 * agent 不在工具卡片的 _meta 里报记忆（RetainPDF + pi、以后经 retainpdf mcp 的本机 agent）：一轮答完按对话和开始时间查到的，
 * 去掉已经画过的、不是 agent 记的，换成「已记住」。查询的起点往前让 2 秒（后端的时间到秒、两边钟可能差一点）。
 */
export function memoriesSince(startedAt: number): string {
  return new Date(startedAt - 2000).toISOString().replace(/\.\d+Z$/, "Z");
}

export function laterMemories(records: readonly AskMemoryRecord[], known: ReadonlySet<string>): AskMemoryNotice[] {
  return records
    .filter((memory) => memory.origin === "agent" && memory.status === "active" && !known.has(memory.memory_id))
    .map((memory) => ({ id: memory.memory_id, scope: memory.scope, text: memory.text, category: memory.category, documentId: memory.document_id, created: true }));
}

/** 「深挖」点的那条回答在库里是哪条：窗口里带着编号就用它；刚答完还没编号的，按正文从后往前找。 */
export function findForkSource(records: readonly AskConversationMessageRecord[], message: { id?: string; text: string }): string | null {
  if (message.id && records.some((record) => record.message_id === message.id)) return message.id;
  const text = message.text.trim();
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    if (record.role === "assistant" && record.text.trim() === text) return record.message_id;
  }
  return null;
}

/** 副对话的标题：从那条回答的第一句截。 */
export function forkTitle(text: string): string {
  const first = text.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(/(?<=[。！？.!?])/)[0] || "";
  const short = [...first].slice(0, 30).join("");
  return `深挖：${short}${[...first].length > 30 ? "…" : ""}`;
}
