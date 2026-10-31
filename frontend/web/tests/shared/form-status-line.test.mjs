import test from "node:test";
import assert from "node:assert/strict";

import { statusToneOf } from "@retainpdf/ui";

test("statusToneOf：空态 hidden，无 tone 有文案判 pending", () => {
  assert.deepEqual(statusToneOf(null), { text: "", tone: "", pending: false });
  assert.deepEqual(statusToneOf({ message: "  " }), { text: "", tone: "", pending: false });
  assert.deepEqual(statusToneOf({ message: "已保存。", tone: "valid" }), {
    text: "已保存。",
    tone: "valid",
    pending: false,
  });
  assert.deepEqual(statusToneOf({ message: "失败", tone: "error" }), {
    text: "失败",
    tone: "error",
    pending: false,
  });
  assert.deepEqual(statusToneOf({ message: "正在保存..." }), {
    text: "正在保存...",
    tone: "",
    pending: true,
  });
});
