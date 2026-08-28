import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBlockKey } from "../src/js/reader/region-interactions.js";

test("normalizeBlockKey chuẩn hóa hai định dạng thêm số 0 về cùng một khóa", () => {
  // itemId của regions (3 chữ số) và block_id của server (4 chữ số) phải bằng nhau
  assert.equal(normalizeBlockKey("p001-b002"), "p1-b2");
  assert.equal(normalizeBlockKey("p001-b0002"), "p1-b2");
  assert.equal(normalizeBlockKey("p012-b0034"), "p12-b34");
  assert.equal(normalizeBlockKey("P001-B0002"), "p1-b2");
});

test("normalizeBlockKey trả về nguyên bản ID không chuẩn", () => {
  assert.equal(normalizeBlockKey("__cg__:cg-001"), "__cg__:cg-001");
  assert.equal(normalizeBlockKey(""), "");
  assert.equal(normalizeBlockKey(null), "");
});
