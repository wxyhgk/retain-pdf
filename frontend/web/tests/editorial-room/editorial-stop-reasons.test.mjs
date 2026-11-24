/** 编辑部停下原因的中文说法。取值以后端 translation-agent 的 stop_reason 为准（只加不改）。 */
import test from "node:test";
import assert from "node:assert/strict";

import { stopReasonText } from "../../src/features/editorial-room/domain/narration.ts";

test("模型不可用、地区不支持有自己的说法", () => {
  assert.match(stopReasonText("model_unavailable"), /模型不可用/);
  assert.match(stopReasonText("region_unsupported"), /不支持当前地区/);
});

test("不认识的原因照原样带出来", () => {
  assert.equal(stopReasonText("something_new"), "停下了（something_new）");
});
