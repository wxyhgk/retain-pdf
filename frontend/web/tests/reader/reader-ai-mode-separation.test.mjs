import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const assistantDir = new URL(
  "../../../../frontend/packages/reader/src/components/react-pdf/assistant/",
  import.meta.url,
);
const read = (name) => readFile(new URL(name, assistantDir), "utf8");

test("facade composes typed hooks instead of owning sessions or streams", async () => {
  const source = await read("use-reader-ask-runtime.ts");
  assert.match(source, /useReaderConversation\(/);
  assert.match(source, /useReaderReadingRequest\(/);
  assert.match(source, /useReaderAgentOperations\(/);
  assert.match(source, /useReaderChat\(/);
  assert.doesNotMatch(source, /listConversations\(|getConversation\(|forkConversationFromPath\(/);
  assert.doesNotMatch(source, /setItems\(|setHeadId\(|setChatMessages/);
  // The single sanctioned chat-store write lives behind the named
  // replaceVisible command; no raw setter is passed into either hook.
  assert.match(source, /replaceVisible: \(messages\) => chatOwner\.setMessages\(\[...messages\]\)/);
  assert.doesNotMatch(source, /REQUEST_SNAPSHOT_PREFIX/);
  assert.match(source, /from "\.\/reader-request-snapshots\.js"/);
});

test("conversation shell owns no streaming and no operations", async () => {
  const source = await read("use-reader-conversation.ts");
  assert.match(source, /ReaderConversationTreePort/);
  assert.match(source, /ReaderConversationStreamPort/);
  assert.match(source, /sessionCommands/);
  assert.doesNotMatch(source, /retainpdf-chat-transport|use-reader-chat|sendMessage|regenerate/);
  assert.doesNotMatch(source, /use-reader-agent-operations|cancelAgentOperation|runAgentOperation/);
});

test("reading request hook drives typed ports without operation imports", async () => {
  const source = await read("use-reader-reading-request.ts");
  assert.match(source, /ReaderConversationTreePort/);
  assert.match(source, /ReaderReadingChatPort/);
  assert.match(source, /buildReaderRequestSnapshot\(/);
  assert.match(source, /saveReaderRequestSnapshot\(/);
  assert.doesNotMatch(source, /use-reader-agent-operations|document-operations/);
  assert.doesNotMatch(source, /listConversations|getConversation|forkConversation/);
});

test("reading and operations views are explicit and share primitives", async () => {
  const [surface, reading, operations, thread] = await Promise.all([
    read("ReaderAssistantSurface.tsx"),
    read("ReaderReadingView.tsx"),
    read("ReaderOperationsView.tsx"),
    read("ReaderAssistantThread.tsx"),
  ]);
  assert.match(surface, /ReaderReadingView/);
  assert.match(surface, /ReaderOperationsView/);
  assert.match(surface, /assistantMode === "operations"/);
  assert.match(reading, /reader-assistant-primitives\.js/);
  assert.match(operations, /reader-assistant-primitives\.js/);
  // Mode copy lives in the explicit views, not the shell or runtime adapter.
  assert.match(reading, /一起读懂这篇文档/);
  assert.match(operations, /想怎样处理 PDF？/);
  assert.doesNotMatch(surface, /一起读懂这篇文档|想怎样处理 PDF？/);
  assert.doesNotMatch(thread, /一起读懂这篇文档|想怎样处理 PDF？/);
  // Selection quotes stay in reading; the operations composer is document-only.
  assert.match(reading, /SelectionBanner|selectionContext/);
  assert.match(operations, /selectionContext=\{null\}/);
  // The operation panel only mounts in the operations view path.
  assert.match(operations, /agentOperationPanel/);
  assert.doesNotMatch(reading, /agentOperationPanel|ReaderAgentOperationPanel/);
});

test("default mode is reading and operations mode is always explicit", async () => {
  const [facade, snapshots] = await Promise.all([
    read("use-reader-ask-runtime.ts"),
    read("reader-request-snapshots.ts"),
  ]);
  assert.match(facade, /useState<ReaderAssistantMode>\("reading"\)/);
  assert.match(facade, /setAssistantMode\("reading"\)/);
  assert.match(snapshots, /if \(assistantMode === "operations"\) \{[\s\S]*?scope: "document", context: null/);
});
