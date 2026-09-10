import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("hiding Reader AI aborts its active model stream", async () => {
  const source = await readFile(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/use-reader-chat.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /if \(!options\.enabled\) void chat\.stop\(\)/);
  assert.match(source, /useEffect\(\(\) => \(\) => \{[\s\S]*?void chat\.stop\(\)/);
  assert.doesNotMatch(source, /cancelAgentOperation|\.cancel\(/);
});

test("frozen retry lives in the reading request hook, not the facade", async () => {
  const source = await readFile(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/use-reader-reading-request.ts", import.meta.url),
    "utf8",
  );
  const retryBlock = source.slice(
    source.indexOf("const retryAnswer"),
    source.indexOf("const cancelAnswer"),
  );

  assert.match(retryBlock, /loadRetryRequestSnapshot\(\{[\s\S]*?scopeKey,[\s\S]*?jobId,[\s\S]*?assistantMessageId,[\s\S]*?\}\)/);
  assert.match(retryBlock, /assistantMode: snapshot\.assistantMode/);
  assert.match(retryBlock, /scope: snapshot\.scope/);
  assert.match(retryBlock, /context: snapshot\.context/);
  assert.doesNotMatch(retryBlock, /assistantMode:\s*assistantMode/);
});

test("stopping generation marks the tree cancelled without touching operations", async () => {
  const source = await readFile(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/use-reader-reading-request.ts", import.meta.url),
    "utf8",
  );
  const cancelBlock = source.slice(source.indexOf("const cancelAnswer"));
  assert.match(cancelBlock, /stopStream/);
  assert.match(cancelBlock, /markRunningCancelled/);
  assert.doesNotMatch(cancelBlock, /cancelAgentOperation|commitAgentOperation|runAgentOperation/);
});

test("session hydration guards live in the conversation shell", async () => {
  const source = await readFile(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/use-reader-conversation.ts", import.meta.url),
    "utf8",
  );
  const switchBlock = source.slice(
    source.indexOf("const switchSession"),
    source.indexOf("const branchFromAnswer"),
  );

  const suspendIndex = switchBlock.indexOf("persistReadyRef.current = false");
  const selectIndex = switchBlock.indexOf("setActiveConversationId(id)");
  assert.ok(
    suspendIndex >= 0 && selectIndex >= 0 && suspendIndex < selectIndex,
    "切换目标会话前应暂停空树持久化",
  );
  assert.match(switchBlock, /loadThreadBranchSnapshot\([\s\S]*?documentId:[\s\S]*?,\s*id,\s*\)/);
  assert.match(source, /generation === sessionListGenerationRef\.current/);
  assert.match(source, /doc === `\$\{documentIdRef\.current \|\| ""\}`\.trim\(\)/);
  assert.match(source, /expectedSwitchToken === undefined \|\| expectedSwitchToken === switchTokenRef\.current/);
});

test("answer completion refreshes sessions from the facade, reset on job switch", async () => {
  const source = await readFile(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/assistant/use-reader-ask-runtime.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /useEffect\(\(\) => \{\s*prevRunning\.current = false;\s*\}, \[jobId\]\)/);
  assert.match(source, /sessionCommands\.refreshSessions\(\)/);
  assert.match(source, /sessionCommands\.adoptRemoteConversationId\(\)/);
});
