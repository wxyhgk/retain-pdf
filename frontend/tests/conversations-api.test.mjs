import test from "node:test";
import assert from "node:assert/strict";
import { messagesToBranchItems } from "../src/js/api/conversations.ts";

test("messagesToBranchItems xây dựng cây cha cho các nhánh anh em", () => {
  const items = messagesToBranchItems([
    {
      message_id: "u1",
      conversation_id: "c1",
      seq: 1,
      role: "user",
      content: "问",
      parent_id: "",
      created_at: "",
    },
    {
      message_id: "a1",
      conversation_id: "c1",
      seq: 2,
      role: "assistant",
      content: "答 A",
      parent_id: "u1",
      citations_json: '[{"ref":1,"block_id":"p001-b0001"}]',
      created_at: "",
    },
    {
      message_id: "a2",
      conversation_id: "c1",
      seq: 3,
      role: "assistant",
      content: "答 B",
      parent_id: "u1",
      created_at: "",
    },
  ]);
  assert.equal(items.length, 3);
  assert.equal(items[0].parentId, null);
  assert.equal(items[1].parentId, "u1");
  assert.equal(items[2].parentId, "u1");
  assert.equal(items[1].message.citations[0].block_id, "p001-b0001");
});
