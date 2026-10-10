// token 数的显示：万 / 亿，悬停精确值。
import test from "node:test";
import assert from "node:assert/strict";
import {
  cacheHitRate,
  formatPercent,
  formatTokenCount,
  formatTokenCountExact,
} from "../../src/platform/utils/token-count.js";

test("不足 1 万显示原数（千分位）", () => {
  assert.equal(formatTokenCount(0), "0");
  assert.equal(formatTokenCount(8532), "8,532");
  assert.equal(formatTokenCount(9999), "9,999");
});

test("1 万到 1 亿保留一位小数加「万」", () => {
  assert.equal(formatTokenCount(10_000), "1.0 万");
  assert.equal(formatTokenCount(223_456), "22.3 万");
  assert.equal(formatTokenCount(5_470_000), "547.0 万");
  assert.equal(formatTokenCount(1_296_000), "129.6 万");
});

test("1 亿以上保留两位小数加「亿」；四舍五入到 10000.0 万时进位成亿", () => {
  assert.equal(formatTokenCount(123_456_789), "1.23 亿");
  assert.equal(formatTokenCount(99_999_999), "1.00 亿");
  assert.equal(formatTokenCount(99_940_000), "9994.0 万");
});

test("坏值按 0；精确值千分位", () => {
  assert.equal(formatTokenCount(undefined), "0");
  assert.equal(formatTokenCount(-5), "0");
  assert.equal(formatTokenCount("abc"), "0");
  assert.equal(formatTokenCountExact(5_470_123), "5,470,123");
});

test("命中率：服务商没报缓存（分母 0）是 null，不是 0%", () => {
  assert.equal(cacheHitRate({ cache_hit_tokens: 0, cache_reported_input_tokens: 0 }), null);
  assert.equal(cacheHitRate({ cache_hit_tokens: 417_000, cache_reported_input_tokens: 1_000_000 }), 0.417);
  assert.equal(formatPercent(0.417), "42%");
  assert.equal(formatPercent(0.034), "3.4%");
  assert.equal(formatPercent(0), "0%");
});
