// 阅读页标出改过的块：data/revisions 按阅读页块编号分组 → 编号到次数的表。
import test from "node:test";
import assert from "node:assert/strict";
import { parseRevisedBlocks } from "../../../packages/reader/src/hooks/use-reader-revised-blocks.ts";

test("分组结果（带不带信封都认）转成「块编号 → 改过几次」，空值和 0 次丢掉", () => {
  const groups = [{ value: "p021-b0005", count: 2 }, { value: "p003-b0001", count: 1 }, { value: "", count: 3 }, { value: "p009-b0001", count: 0 }];
  const fromEnvelope = parseRevisedBlocks({ code: 0, data: { dataset: "revisions", groups } });
  assert.deepEqual([...fromEnvelope], [["p021-b0005", 2], ["p003-b0001", 1]]);
  assert.deepEqual([...parseRevisedBlocks({ groups })], [...fromEnvelope]);
  assert.equal(parseRevisedBlocks(null).size, 0);
  assert.equal(parseRevisedBlocks({ data: { available: false } }).size, 0);
});
