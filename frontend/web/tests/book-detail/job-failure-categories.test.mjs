/** 卡片认得的分类，必须覆盖后端真正发得出来的那些。
 *
 * # 这条门禁替掉了一条假门禁
 *
 * 第一版写的是「五个分类各有说法」，而它循环的正是**作者自己实现了的那 5 个 key** ——
 * 于是它对「产生方还发得出另外 4 个」一无所知，永远绿。实测当时落兜底的有
 * auth / input / network / normalization / rate_limit 五个，其中 auth 的表现是：
 * API Key 错了，卡片说「可以先重试一次」，用户照着点必然再失败。
 *
 * 所以这一条反过来：**取值从产生方抽**，一个都不许掉进通用兜底。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { failureAdvice } from "../../src/features/book-detail/domain/job-failure-model.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const STRUCTURED = "../../../../backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py";

/** 从 `_failure_category_for` 的函数体里抽出它会返回的全部分类。 */
function producedCategories() {
  const source = read(STRUCTURED);
  const from = source.indexOf("def _failure_category_for");
  // 抽取失效时必须红，不能静默返回空集合然后恒真 —— 空集合上的「都覆盖了」是恒等式。
  assert.notEqual(from, -1, "_failure_category_for 改名或搬走了 —— 这条门禁失去了取值来源");
  const body = source.slice(from, source.indexOf("\ndef ", from + 1));
  const values = [...new Set([...body.matchAll(/return "([a-z_]+)"/g)].map((m) => m[1]))];
  assert.ok(values.length >= 8, `只抽到 ${values.length} 个分类，抽取逻辑失效了`);
  return values.sort();
}

test("后端发得出的每一个 failure_category 都有自己的说法", () => {
  const generic = failureAdvice(null);
  const unmapped = producedCategories().filter((category) => {
    const advice = failureAdvice({ category, stage: "ocr", retryable: true, summary: "" });
    return advice.title === generic.title && advice.action === generic.action;
  });
  assert.deepEqual(unmapped, [], `这些分类后端真的会发，卡片却只给通用废话：${unmapped.join(", ")}`);
});

test("重试解决不了的那几类，不能把用户往重试上引", () => {
  // 这几类重试一定还是同样的结果：Key 还是错的、余额还是不够、文件还是坏的、OCR 产物结构还是那样。
  for (const category of ["auth", "billing", "input", "normalization"]) {
    const advice = failureAdvice({ category, stage: "ocr", retryable: true, summary: "" });
    assert.equal(advice.retryLikelyHelps, false, `${category} 把用户往重试上引，而重试一定还会失败`);
  }
});

test("凭据被拒时说的是「去换 Key」，不是「再试一次」", () => {
  const advice = failureAdvice({ category: "auth", stage: "ocr", retryable: true, summary: "" });
  assert.match(advice.action, /Key/, "没告诉用户问题在凭据上");
  assert.match(advice.action, /重试解决不了/);
});

test("兜底仍然在 —— 产生方将来新增分类时界面不能空白", () => {
  const advice = failureAdvice({ category: "a_brand_new_category", stage: "ocr", retryable: true, summary: "" });
  assert.ok(advice.title && advice.action);
});
