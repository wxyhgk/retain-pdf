import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTranslationBudgetState,
} from "../../src/features/ingest/domain/workflow/budget.js";

test("translation budget blocks DeepSeek submission when estimated cost exceeds balance", () => {
  const budget = resolveTranslationBudgetState({
    pageRanges: "",
    uploadedPageCount: 533,
    balanceCny: 1,
    balanceChecked: true,
    needsTranslation: true,
  });

  assert.equal(budget.visible, true);
  assert.equal(budget.blocking, true);
  assert.equal(budget.pageCount, 533);
  assert.equal(budget.estimatedCost.toFixed(2), "8.79");
  assert.equal(budget.message, "预计 ¥8.79 · 533 页 · 余额 ¥1.00");
  assert.equal(budget.topUpUrl, "https://platform.deepseek.com/top_up");
});
