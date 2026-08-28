import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  injectCitationMarkers,
  buildMarkdownImageApiUrl,
  buildPagePreviewUrl,
  isAgenticCitation,
  pickCitationsForAnswer,
  resolveCitationPageIdx,
  resolveCitationPageNumber,
} from "../src/js/reader/ai/answer-enhance.ts";

test("injectCitationMarkers turns [n] into buttons", () => {
  const dom = new JSDOM('<!doctype html><div id="r"><p>Kết luận đúng [1] và mở rộng [2].</p></div>');
  const root = dom.window.document.getElementById("r");
  const map = new Map([
    ["1", { ref: 1, block_id: "b1", page_idx: 2, snippet: "a" }],
    ["2", { ref: 2, block_id: "b2", page_idx: 3, snippet: "b" }],
  ]);
  const jumps = [];
  injectCitationMarkers(root, map, (c) => jumps.push(c.ref), dom.window.document);
  const buttons = root.querySelectorAll("button.reader-ai-citation-ref");
  assert.equal(buttons.length, 2);
  buttons[0].click();
  assert.deepEqual(jumps, [1]);
});

test("buildMarkdownImageApiUrl strips images/ prefix", () => {
  const u = buildMarkdownImageApiUrl("job1", "images/page-1/imgs/a.png");
  assert.match(u, /markdown\/images\/page-1\/imgs\/a\.png/);
});

test("buildPagePreviewUrl is 1-based page", () => {
  const u = buildPagePreviewUrl("job1", 0);
  assert.match(u, /preview\/pages\/1\?/);
});

test("isAgenticCitation requires block_id", () => {
  assert.equal(isAgenticCitation({ ref: 1, page_idx: 0 }), false);
  assert.equal(isAgenticCitation({ ref: 1, block_id: "x", page_idx: 0 }), true);
});

test("resolveCitationPageIdx prefers page_idx and falls back to block_id", () => {
  assert.equal(resolveCitationPageIdx({ block_id: "b", page_idx: 8 }), 8);
  assert.equal(resolveCitationPageNumber({ block_id: "b", page_idx: 8 }), 9);
  assert.equal(resolveCitationPageIdx({ block_id: "p009-b0010" }), 8);
  assert.equal(resolveCitationPageNumber({ block_id: "p009-b0010" }), 9);
});

test("Trường page quy đổi theo cơ số 1 (khóa hồi quy B4 chênh lệch 1 trang)", () => {
  // Tất cả các nhà sản xuất page trong hệ thống (chat cũ / _public_anchor) đều là cơ số 1
  assert.equal(resolveCitationPageIdx({ page: 9 }), 8);
  assert.equal(resolveCitationPageNumber({ page: 9 }), 9);
  // page_idx (cơ số 0) ưu tiên hơn page
  assert.equal(resolveCitationPageIdx({ page_idx: 2, page: 9 }), 2);
  // page=0 không hợp lệ (cơ số 1 không có trang 0) → fallback block_id
  assert.equal(resolveCitationPageIdx({ page: 0, block_id: "p003-b0001" }), 2);
});

test("pickCitationsForAnswer keeps only refs used in answer", () => {
  const citations = [
    { ref: 1, block_id: "p002-b0001", page_idx: 1, snippet: "a" },
    { ref: 2, block_id: "p005-b0002", page_idx: 4, snippet: "b" },
    { ref: 3, block_id: "p008-b0003", page_idx: 7, snippet: "c" },
  ];
  const picked = pickCitationsForAnswer("Kết luận xem [2] và [2] một lần nữa, cũng như bóng ma [9]", citations);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].ref, 2);
  assert.equal(picked[0].page_idx, 4);
});

test("pickCitationsForAnswer falls back to few unique pages when no markers", () => {
  const citations = [
    { ref: 1, block_id: "p002-b0001", page_idx: 1, snippet: "a" },
    { ref: 2, block_id: "p002-b0002", page_idx: 1, snippet: "b" },
    { ref: 3, block_id: "p008-b0003", page_idx: 7, snippet: "c" },
    { ref: 4, block_id: "p009-b0003", page_idx: 8, snippet: "d" },
    { ref: 5, block_id: "p010-b0003", page_idx: 9, snippet: "e" },
  ];
  const picked = pickCitationsForAnswer("Câu trả lời dài không có chỉ mục", citations, { max: 5 });
  assert.equal(picked.length, 3);
  assert.equal(picked[0].page_idx, 1);
  assert.equal(picked[1].page_idx, 7);
});
