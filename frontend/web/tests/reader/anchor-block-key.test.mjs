import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBlockKey } from "../../src/features/reader/domain.js";

test("normalizeBlockKey 对两套补零格式归一到同一键", () => {
  // regions itemId(3 位) 与服务端 block_id(4 位) 必须相等
  assert.equal(normalizeBlockKey("p001-b002"), "p1-b2");
  assert.equal(normalizeBlockKey("p001-b0002"), "p1-b2");
  assert.equal(normalizeBlockKey("p012-b0034"), "p12-b34");
  assert.equal(normalizeBlockKey("P001-B0002"), "p1-b2");
});

test("normalizeBlockKey 非标准 ID 原样返回", () => {
  assert.equal(normalizeBlockKey("__cg__:cg-001"), "__cg__:cg-001");
  assert.equal(normalizeBlockKey(""), "");
  assert.equal(normalizeBlockKey(null), "");
});
