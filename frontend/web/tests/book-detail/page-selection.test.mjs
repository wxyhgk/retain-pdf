/** 混合页码解析：`1-5, 8, 12-14` 这种打印对话框式的写法。
 *
 * 规范化后的字符串会原样交给 `ocr.page_ranges`（MinerU 和 Rust 的 `parse_page_ranges`
 * 都认 `1-5,8,12-14`），页号数组交给 `translation.page_ranges`（1 起的文档页号，
 * `ocr_artifact_reuse.rs` 按它挑页）。两边格式对不上，就是翻错页。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  compactPageSpec,
  parsePageSelection,
} from "../../src/features/book-detail/domain/page-selection.ts";

const ok = (raw, count = 20) => {
  const result = parsePageSelection(raw, count);
  assert.ok(result.ok, `「${raw}」应当能解析，却报：${result.error}`);
  return result;
};
const bad = (raw, count = 20) => {
  const result = parsePageSelection(raw, count);
  assert.ok(!result.ok, `「${raw}」应当被拒绝，却解析成了 ${JSON.stringify(result.pages)}`);
  return result.error;
};

test("混合范围展开成去重、升序、1 起的页号", () => {
  assert.deepEqual(ok("1-5, 8, 12-14").pages, [1, 2, 3, 4, 5, 8, 12, 13, 14]);
});

test("规范化字符串可以原样交给 ocr.page_ranges", () => {
  // MinerU 和 Rust parse_page_ranges 认的就是这个格式：无空格、逗号分隔、连续段压成区间。
  assert.equal(ok("1-5, 8, 12-14").spec, "1-5,8,12-14");
});

test("乱序、重复、相邻的段会被合并", () => {
  // 用户手敲时很常见：「8, 1-3, 2-5」—— 不该因为写法乱就翻错或重复翻。
  const result = ok("8, 1-3, 2-5, 6");
  assert.deepEqual(result.pages, [1, 2, 3, 4, 5, 6, 8]);
  assert.equal(result.spec, "1-6,8", "相邻的 1-5 和 6 没有合并成 1-6");
});

test("输入法里容易敲出来的分隔符都认", () => {
  for (const raw of ["1-3，5", "1-3、5", "1-3; 5", "1~3,5", "1—3,5", "1–3,5", "1-3 5"]) {
    assert.deepEqual(ok(raw).pages, [1, 2, 3, 5], `「${raw}」没认出来`);
  }
});

test("单页和整本边界", () => {
  assert.deepEqual(ok("1").pages, [1]);
  assert.deepEqual(ok("20").pages, [20]);
  assert.deepEqual(ok("1-20").pages.length, 20);
});

test("倒序区间给出能照着改的提示", () => {
  const error = bad("5-3");
  assert.match(error, /颠倒/);
  assert.match(error, /3-5/, "提示里没给出正确的写法");
});

test("越界和 0 页都拒绝，并说清总页数", () => {
  assert.match(bad("0"), /20 页/);
  assert.match(bad("21"), /20 页/);
  assert.match(bad("18-25"), /20 页/);
  assert.match(bad("0-3"), /20 页/);
});

test("看不懂的写法不静默吞掉", () => {
  // 静默跳过一段等于「少翻了几页但没人知道」。
  for (const raw of ["abc", "3-", "-3", "3-5-7", "第3页"]) {
    assert.match(bad(raw), /看不懂|颠倒|范围|不存在/, `「${raw}」被静默接受了`);
  }
});

test("空输入和不知道总页数时都不放行", () => {
  assert.match(bad(""), /填写/);
  assert.match(bad("   "), /填写/);
  assert.match(bad("，，"), /填写/);
  assert.match(bad("1-3", 0), /几页/);
});

test("compactPageSpec 往返：解析后再压缩不丢页", () => {
  const pages = [1, 2, 3, 7, 9, 10, 11, 20];
  assert.equal(compactPageSpec(pages), "1-3,7,9-11,20");
  assert.deepEqual(ok(compactPageSpec(pages)).pages, pages);
});
