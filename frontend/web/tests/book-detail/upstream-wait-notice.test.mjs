/** 「进度」页：在等服务商限流时状态行下面那句话（stage_snapshot.upstream_wait，2026-11-23 后端加的）。
 *  没有这句，用户只看到进度卡住、不知道在等谁。 */
import test from "node:test";
import assert from "node:assert/strict";
import { upstreamWaitNoticeOf } from "../../src/features/book-detail/ui/tabs/processing-summary-model.ts";

const now = Date.parse("2026-11-23T10:00:00Z");
const translationWith = (wait) => ({ isActive: true, item: { status: "running", stage_snapshot: { stage: "translating", upstream_wait: wait } } });

test("限流、繁忙、暂不可用各有说法，带上服务商名和剩几秒", () => {
  assert.equal(
    upstreamWaitNoticeOf(null, translationWith({ provider: "zhipu", http_status: 429, reason: "rate_limited", until: "2026-11-23T10:00:23Z" }), now),
    "服务商限流，等待中（智谱，约 23 秒后重试）",
  );
  assert.equal(upstreamWaitNoticeOf(null, translationWith({ provider: "anthropic", http_status: 529, reason: "overloaded" }), now), "服务商繁忙，等待中（Anthropic）");
  assert.equal(upstreamWaitNoticeOf(null, translationWith({ provider: "custom", http_status: 503, reason: "unavailable" }), now), "服务商暂不可用，等待中（自定义接口）");
  assert.equal(
    upstreamWaitNoticeOf(null, translationWith({ provider: "openai", http_status: 429, reason: "rate_limited", until: "2026-11-23T09:59:00Z" }), now),
    "服务商限流，等待中（OpenAI）",
    "等的时间过了不写负数",
  );
});

test("不在等、任务不在跑：空串", () => {
  assert.equal(upstreamWaitNoticeOf(null, translationWith(undefined), now), "");
  assert.equal(upstreamWaitNoticeOf(null, { isActive: false, item: { stage_snapshot: { upstream_wait: { provider: "zhipu", http_status: 429 } } } }, now), "");
});
