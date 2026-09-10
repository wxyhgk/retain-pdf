import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 消费者契约测试:frontend 对 /api/v1/ai/conversations 的消费必须与
// contracts/ai-conversations.v1.schema.json(单一真值)一致。
// 生产侧锁在 rust_api src/api_tests/conversations_contract.rs,
// ai_service 侧锁在 backend/ai/tests/test_conversations_contract.py。
// 改契约先改 schema,三端测试同步变绿才算完成。

const CONTRACT_PATH = join(
  process.cwd(),
  "..",
  "..",
  "contracts",
  "ai-conversations.v1.schema.json",
);
const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
const source = readFileSync(
  join(process.cwd(), "src/platform/api/legacy/conversations.ts"),
  "utf8",
);

function schemaProps(definition) {
  return new Set(Object.keys(contract.definitions[definition].properties));
}

function tsTypeFields(typeName) {
  const block = source.match(
    new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\};`),
  )?.[1];
  assert.ok(block, `未找到 type ${typeName}`);
  return new Set(
    [...block.matchAll(/^\s*([a-z_]+)\??:/gm)].map((m) => m[1]),
  );
}

test("响应类型:TS 字段集合与契约逐字段相等", () => {
  assert.deepEqual(tsTypeFields("ConversationRecord"), schemaProps("ConversationRecord"));
  assert.deepEqual(tsTypeFields("MessageRecord"), schemaProps("MessageRecord"));
});

test("请求路径:全部落在契约端点上", () => {
  const used = [...source.matchAll(/[`"'](ai\/conversations[^`"']*)[`"']/g)]
    .map((m) => m[1])
    // 归一化:模板插值 → :conversation_id,去掉查询串插值尾巴
    .map((p) =>
      p
        .replace(/\$\{encodeURIComponent\([^)]*\)\}/g, ":conversation_id")
        .replace(/\$\{[^}]*$/, ""),
    );
  assert.ok(used.length >= 4, "路径提取过少——扫描逻辑可能失效");

  const allowed = new Set(
    contract.endpoints.map((e) => e.path.replace(/^\/api\/v1\//, "")),
  );
  for (const path of used) {
    assert.ok(allowed.has(path), `契约外路径: ${path}`);
  }
  // 六个端点的三种路径形态都必须被前端使用
  for (const path of allowed) {
    assert.ok(used.includes(path), `契约端点未被前端使用: ${path}`);
  }
});

test("写入载荷:body 字段 ⊆ 契约输入字段", () => {
  const allowed = new Set([
    ...schemaProps("CreateConversationInput"),
    ...schemaProps("PatchConversationInput"),
    ...schemaProps("AppendMessageInput"),
    ...schemaProps("ForkConversationInput"),
    ...schemaProps("ForkMessageInput"),
  ]);
  const bodies = [...source.matchAll(/JSON\.stringify\(\{([\s\S]*?)\}\)/g)];
  const assigns = [...source.matchAll(/body\.([a-z_]+)\s*=/g)];
  const used = new Set(assigns.map((m) => m[1]));
  for (const [, blob] of bodies) {
    for (const [, key] of blob.matchAll(/([a-z_]+)\s*:/g)) {
      used.add(key);
    }
  }
  assert.ok(used.size > 0, "未提取到任何载荷字段——扫描逻辑可能失效");
  for (const key of used) {
    assert.ok(allowed.has(key), `写入了契约外字段: ${key}`);
  }
});

test("AppendMessageInput 必填字段前端始终提供", () => {
  const required = contract.definitions.AppendMessageInput.required;
  const appendBlock = source.match(
    /export async function appendConversationMessage[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(appendBlock, "未找到 appendConversationMessage");
  for (const key of required) {
    assert.ok(
      new RegExp(`${key}\\s*:`).test(appendBlock),
      `append 载荷缺契约必填字段 ${key}`,
    );
  }
});
