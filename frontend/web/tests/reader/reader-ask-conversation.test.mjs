// 阅读页提问的主对话（2026-11-26）：书上的位置 → 结构化出处、库里的消息 → 提问窗、答完一轮 → 追加请求、「深挖」认那条回答、书页上的「?」。
import test from "node:test";
import assert from "node:assert/strict";

import {
  anchorSelection,
  findForkSource,
  forkTitle,
  recordsToMessages,
  selectionContext,
  turnToAppend,
} from "../../../packages/reader/src/ask/conversation-messages.ts";
import { recordMark } from "../../../packages/reader/src/ask/use-ask-marks.ts";
import { toAskContext } from "../../../packages/reader/src/ask/ask-context.ts";

const ANCHOR = {
  pane: "translated",
  page: 56,
  itemId: "p056-b0003",
  selection: "选中的一句",
  sourceText: "original",
  translatedText: "",
  section: "2 方法",
  point: { x: 0.2, y: 0.3 },
};
const BOOK = { documentId: "doc-1", jobId: "job-1", versionId: null };

function record(seq, role, text, extra = {}) {
  return {
    message_id: `msg-${seq}`, conversation_id: "conv-1", seq, role, text, thought: null, usage: null, agent_id: "retainpdf",
    side_conversation_id: null, document_id: "doc-1", job_id: null, version_id: null, pane: null, page: null, selection: null,
    client_message_id: null, created_at: "2026-11-26T10:00:00Z", ...extra,
  };
}

test("书上的位置 → 结构化出处：只放有值的；块编号是认出的那一块；出处进这一问的 _meta", () => {
  const selection = anchorSelection(ANCHOR, BOOK);
  assert.deepEqual(selection, {
    page: 56, pane: "translated", item_ids: ["p056-b0003"], document_id: "doc-1", job_id: "job-1",
    selected_text: "选中的一句", section: "2 方法", source_text: "original",
  });
  assert.deepEqual(anchorSelection({ ...ANCHOR, itemId: null, selection: "", sourceText: "", section: "" }, { documentId: "", jobId: "j", versionId: "v-2" }), {
    page: 56, pane: "translated", item_ids: [], job_id: "j", translation_version: "v-2",
  });
  const context = toAskContext(ANCHOR, "job-1", "", selection);
  assert.deepEqual(context.meta, { retainpdf: { selection } });
  assert.match(context.preamble, /第 56 页/, "本机 agent 只认字：那段字照旧有");
});

test("库里的消息 → 提问窗：问题带问的是哪儿（别的书里问的写「别的书」）；副对话的结论画成卡片；压缩点那条做标记", () => {
  const messages = recordsToMessages([
    record(1, "user", "这句？", { selection: { page: 56, item_ids: [], section: "2 方法", document_id: "doc-1" } }),
    record(2, "assistant", "是这样。", { thought: "想", usage: { outputTokens: 3 } }),
    record(3, "user", "那本书呢", { selection: { page: 9, item_ids: [], document_id: "doc-2" } }),
    record(4, "side_summary", "结论：可以。", { side_conversation_id: "conv-side" }),
  ], [{ covers_to_seq: 2 }], "doc-1");
  assert.deepEqual(messages[0], { id: "msg-1", role: "user", text: "这句？", context: { page: 56, label: "第 56 页 · 2 方法", data: { page: 56, item_ids: [], section: "2 方法", document_id: "doc-1" } } });
  assert.deepEqual(messages[1], { id: "msg-2", role: "assistant", text: "是这样。", thought: "想", usage: { outputTokens: 3 }, marks: { compactedBefore: true } });
  assert.equal(messages[2].context.label, "别的书 · 第 9 页");
  assert.deepEqual(messages[3].marks, { sideSummary: { sideId: "conv-side" } });
  assert.match(messages[3].text, /^\*\*深挖的结论\*\*\n\n结论：可以。$/);
  assert.equal(selectionContext(null, "doc-1"), null);
});

test("答完一轮 → 追加：问和答一起，幂等号、出处、书、agent、记下的记忆；出处里的书为准（两个不一样后端回 400）", () => {
  const selection = anchorSelection(ANCHOR, BOOK);
  const turn = {
    question: { role: "user", text: "这句？" },
    answer: { role: "assistant", text: "是这样。", thought: "想一想", usage: { outputTokens: 3 } },
    context: { label: "第 56 页", meta: { retainpdf: { selection } } },
    agentId: "retainpdf",
    sessionId: "s",
    memoryIds: ["mem-1"],
  };
  const [question, answer] = turnToAppend(turn, "doc-other", "c-1");
  assert.deepEqual(question, { agent_id: "retainpdf", document_id: "doc-1", role: "user", text: "这句？", selection, client_message_id: "c-1-q" });
  assert.deepEqual(answer, { agent_id: "retainpdf", document_id: "doc-1", role: "assistant", text: "是这样。", thought: "想一想", usage: { outputTokens: 3 }, client_message_id: "c-1-a", memory_ids: ["mem-1"] });
  const [plain, reply] = turnToAppend({ ...turn, context: null, memoryIds: [], answer: { role: "assistant", text: "好", usage: { big: "x".repeat(5000) } } }, "doc-1", "c-2");
  assert.equal(plain.selection, null, "没带出处");
  assert.equal(plain.document_id, "doc-1", "属于正在读的书");
  assert.equal(reply.usage, null, "用量写成 JSON 超过 4096 字节就不带");
  assert.equal(reply.thought, null);
});

test("「深挖」点的那条回答：带编号用编号；刚答完没编号的按正文从后往前找；标题从第一句截", () => {
  const records = [record(1, "user", "Q"), record(2, "assistant", "答案一"), record(3, "user", "Q"), record(4, "assistant", "答案一")];
  assert.equal(findForkSource(records, { id: "msg-2", text: "答案一" }), "msg-2");
  assert.equal(findForkSource(records, { text: "答案一" }), "msg-4");
  assert.equal(findForkSource(records, { text: "没有" }), null);
  assert.equal(forkTitle("**哈密顿量**是总能量。后面还有"), "深挖：哈密顿量是总能量。");
  assert.equal(forkTitle("一".repeat(40)), `深挖：${"一".repeat(30)}…`);
});

test("书页上的「?」：主对话里这本书的问，按出处画在那一块的上沿；没页码的不画", () => {
  const pointOf = (itemId, pane, page) => (itemId === "p056-b0003" && pane === "source" && page === 56 ? { x: 0.1, y: 0.4 } : null);
  const mark = recordMark(record(1, "user", "这句什么意思？", { page: 56, pane: "source", selection: { page: 56, pane: "source", item_ids: ["p056-b0003"], selected_text: "选的" } }), 7, pointOf);
  assert.equal(mark.key, 7);
  assert.equal(mark.messageId, "msg-1");
  assert.deepEqual(mark.anchor, { pane: "source", page: 56, itemId: "p056-b0003", selection: "选的", sourceText: "", translatedText: "", section: "", point: { x: 0.1, y: 0.4 } });
  assert.equal(recordMark(record(2, "user", "没页码"), 8, pointOf), null);
  assert.equal(recordMark(record(3, "assistant", "答", { page: 3 }), 9, pointOf), null, "只画问");
});
