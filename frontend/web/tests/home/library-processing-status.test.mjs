import test from "node:test";
import assert from "node:assert/strict";

// 回归：刷新后书架卡片对列表投影原生状态词（无 display_stage、无 progress）
// 必须照样转圈。断点见 library-card-badge.ts 白名单。
const { isLibraryCardProcessing, libraryCardBadge } = await import(
  "../../src/features/library/domain/card/library-card-badge.js"
);

const runningVariants = [
  { status: "queued", stage: null },
  { status: "running", stage: null },
  { status: "pending", stage: null },
  // 列表投影原生词（live.rs 只带 stage，无 display_stage，progress 常空）
  { status: "processing", stage: "processing" },
  { status: "validating", stage: "validating" },
  { status: "", stage: "translate" },
  { status: "succeeded", stage: "ocr" }, // 重试脏态：终态词 + 回退 stage，仍转
];

for (const item of runningVariants) {
  test(`processing overlay shows for ${JSON.stringify(item)}`, () => {
    assert.equal(isLibraryCardProcessing(item), true);
    assert.equal(libraryCardBadge(item), null);
  });
}

const doneVariants = [
  { status: "succeeded", stage: "done" },
  { status: "failed", stage: "translate" },
  { status: "canceled", stage: "render" },
];

for (const item of doneVariants) {
  test(`processing overlay hidden for ${JSON.stringify(item)}`, () => {
    assert.equal(isLibraryCardProcessing(item), false);
  });
}
