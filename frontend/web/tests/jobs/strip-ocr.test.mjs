import test from "node:test";
import assert from "node:assert/strict";

// stripOcrSuffix centralizes the historical mono-job "-ocr" heuristic.
// Naive `replace(/-ocr$/, "")` would mangle legitimate IDs like "report-ocr".
// Tests lock the current behaviour and document the edge case.

import { stripOcrSuffix } from "@retainpdf/api/utils/strip-ocr";
import { stripOcrSuffix as stripViaRuntime } from "@retainpdf/api/runtime";
import { stripOcrSuffix as stripViaIndex } from "@retainpdf/api";

test("stripOcrSuffix: re-exports are identical", () => {
  assert.equal(stripViaRuntime("abc-ocr"), "abc");
  assert.equal(stripViaIndex("abc-ocr"), "abc");
  assert.equal(stripViaRuntime, stripOcrSuffix);
  // stripViaIndex is same fn (re-export alias stripOcrSuffixRuntime is same)
});

test("stripOcrSuffix strips single trailing -ocr after trim", () => {
  assert.equal(stripOcrSuffix("job-123-ocr"), "job-123");
  assert.equal(stripOcrSuffix("job-123-ocr "), "job-123");
  assert.equal(stripOcrSuffix("  job-123-ocr  "), "job-123");
  assert.equal(stripOcrSuffix("abc-ocr"), "abc");
});

test("stripOcrSuffix leaves non-suffix -ocr intact", () => {
  assert.equal(stripOcrSuffix("my-ocr-report"), "my-ocr-report");
  assert.equal(stripOcrSuffix("ocr-job"), "ocr-job");
  assert.equal(stripOcrSuffix("job-ocr-middle"), "job-ocr-middle");
  assert.equal(stripOcrSuffix("job-123"), "job-123");
  assert.equal(stripOcrSuffix(""), "");
  assert.equal(stripOcrSuffix("   "), "");
});

test("stripOcrSuffix edge case: legitimate ID ending with -ocr (report-ocr)", () => {
  // This is the documented P3 risk: a real business ID like "report-ocr"
  // (not a mono-job variant) would still be stripped with current heuristic.
  // Test locks the current behaviour so the collision is visible until an
  // explicit parentJobId flag replaces the heuristic.
  assert.equal(stripOcrSuffix("report-ocr"), "report");
  // If backend ever provides explicit isOcrVariant, this test should be
  // updated to assert that "report-ocr" is preserved.
  assert.equal(stripOcrSuffix("invoice-ocr"), "invoice");
  assert.equal(stripOcrSuffix("-ocr"), "");
});

test("stripOcrSuffix only strips one trailing -ocr, not double", () => {
  // "job-ocr-ocr" → "job-ocr" (single strip)
  assert.equal(stripOcrSuffix("job-ocr-ocr"), "job-ocr");
  assert.equal(stripOcrSuffix("job-ocr-ocr-ocr"), "job-ocr-ocr");
});

test("stripOcrSuffix handles non-string gracefully", () => {
  // @ts-ignore
  assert.equal(stripOcrSuffix(null), "");
  // @ts-ignore
  assert.equal(stripOcrSuffix(undefined), "");
  // @ts-ignore
  assert.equal(stripOcrSuffix(123), "");
});

test("stripOcrSuffix is equivalent to legacy replace for known cases", () => {
  const cases = ["a-ocr", "b", "c-ocr ", " report-ocr", ""];
  for (const c of cases) {
    const legacy = `${c || ""}`.trim().replace(/-ocr$/, "");
    assert.equal(stripOcrSuffix(c), legacy, `mismatch for ${JSON.stringify(c)}`);
  }
});
