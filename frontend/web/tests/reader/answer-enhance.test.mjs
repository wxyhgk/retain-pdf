import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  injectCitationMarkers,
  buildMarkdownImageApiUrl,
  buildPagePreviewUrl,
  decorateCitationMarkdown,
  findCitationForAnswerImage,
  isAgenticCitation,
  normalizeAiCitations,
  hydrateProtectedImages,
  mountAnswerHtml,
  pickCitationsForAnswer,
  resolveCitationPageIdx,
  resolveCitationPageNumber,
  resolveAnswerImageUrl,
} from "../../../../frontend/packages/reader/src/shared/ai/answer-enhance.ts";
import { pageNumberFromUrlAnchor } from "../../../../frontend/packages/reader/src/hooks/use-url-anchor-jump.ts";
import {
  findReaderRegion,
  normalizeReaderMetadata,
  normalizeReaderRegions,
  projectReaderRegion,
  resolveReaderRegionHighlight,
} from "../../../../frontend/packages/reader/src/shared/data/reader-regions.ts";

test("AI citation marker carries block_id through page resolution and bbox highlight", () => {
  const dom = new JSDOM('<!doctype html><div id="r"><p>OCR 结论成立 [1]。</p></div>');
  const root = dom.window.document.getElementById("r");
  const citation = {
    ref: 1,
    block_id: "p003-b0004",
    // Deliberately stale: block_id geometry must remain authoritative.
    page_idx: 0,
    snippet: "OCR source evidence",
  };
  const map = new Map([["1", citation]]);
  const regions = normalizeReaderRegions({ items: [{
    item_id: "p003-b004",
    source: {
      page: 3,
      bbox: [60, 120, 300, 180],
      unit: "pdf_point",
      origin: "top_left",
    },
    translated: {
      page: 3,
      bbox: [60, 120, 300, 180],
      unit: "pdf_point",
      origin: "top_left",
    },
    status: "source_only",
  }] });
  const metadata = normalizeReaderMetadata({
    source: { pages: [{ page: 3, width: 600, height: 800 }] },
    translated: null,
  });
  const jumps = [];
  injectCitationMarkers(root, map, (clicked) => {
    const region = findReaderRegion(regions, clicked.block_id);
    const page = pageNumberFromUrlAnchor(
      { pageIdx: clicked.page_idx ?? null, blockId: clicked.block_id || "" },
      () => region?.source.page ?? null,
    );
    const highlight = resolveReaderRegionHighlight(region, metadata, "source");
    jumps.push({
      blockId: clicked.block_id,
      page,
      rect: projectReaderRegion(highlight, 300, 400),
    });
  }, dom.window.document);
  const buttons = root.querySelectorAll("button.reader-ai-citation-ref");
  assert.equal(buttons.length, 1);
  buttons[0].click();
  assert.deepEqual(jumps, [{
    blockId: "p003-b0004",
    page: 3,
    rect: { left: 30, top: 60, width: 120, height: 30 },
  }]);
});

test("citation markdown decoration is streaming-safe and leaves code and links intact", () => {
  const refs = new Map([["5", { ref: 5, block_id: "p003-b0004" }]]);
  assert.equal(
    decorateCitationMarkdown(
      "正文 [5]，`代码 [5]`，已有 [5](https://example.com)。\n```txt\n[5]\n```",
      refs,
    ),
    "正文 [5](#retainpdf-citation-5)，`代码 [5]`，已有 [5](https://example.com)。\n```txt\n[5]\n```",
  );
});

test("buildMarkdownImageApiUrl strips images/ prefix", () => {
  const u = buildMarkdownImageApiUrl("job1", "images/page-1/imgs/a.png");
  assert.match(u, /markdown\/images\/page-1\/imgs\/a\.png/);
});

test("answer images are canonicalized once and locked to the current job", () => {
  assert.equal(
    buildMarkdownImageApiUrl("job 1", "images/page-3/imgs/chart%20a.png"),
    "/api/v1/jobs/job%201/markdown/images/page-3/imgs/chart%20a.png",
  );
  assert.equal(
    resolveAnswerImageUrl(
      "/api/v1/jobs/job%201/markdown/images/page-3/imgs/chart%20a.png",
      "job 1",
    ),
    "/api/v1/jobs/job%201/markdown/images/page-3/imgs/chart%20a.png",
  );
  assert.equal(resolveAnswerImageUrl("https://tracker.invalid/pixel.png", "job 1"), "");
  assert.equal(
    resolveAnswerImageUrl("/api/v1/jobs/other/markdown/images/page-3/a.png", "job 1"),
    "",
  );
  assert.equal(buildMarkdownImageApiUrl("job 1", "images/../secret.png"), "");
});

test("answer images resolve an exact structured citation and support legacy page fallback", () => {
  const exact = {
    ref: 4,
    block_id: "p003-b0007",
    page_idx: 2,
    image_urls: ["/api/v1/jobs/job-1/markdown/images/page-3/imgs/chart.png"],
  };
  const samePageText = { ref: 5, block_id: "p003-b0008", page_idx: 2 };
  assert.equal(
    findCitationForAnswerImage("images/page-3/imgs/chart.png", [samePageText, exact], "job-1"),
    exact,
  );
  assert.equal(
    findCitationForAnswerImage("images/page-3/imgs/legacy.png", [samePageText], "job-1"),
    samePageText,
  );
  assert.equal(
    findCitationForAnswerImage("https://tracker.invalid/chart.png", [exact], "job-1"),
    null,
  );
});

test("answer HTML never mounts a raw image URL and hydrates accepted assets through protected fetch", async () => {
  const dom = new JSDOM("<!doctype html><body><div id='root'></div></body>", {
    url: "http://localhost/reader.html",
  });
  const root = dom.window.document.getElementById("root");
  const count = mountAnswerHtml(
    root,
    [
      '<p><img src="images/page-3/imgs/chart a.png" alt="chart"></p>',
      '<img src="https://tracker.invalid/pixel.png" alt="tracker">',
    ].join(""),
    { jobId: "job-1", documentRef: dom.window.document },
  );
  assert.equal(count, 1);
  const image = root.querySelector("img");
  assert.equal(image.hasAttribute("src"), false);
  assert.equal(
    image.getAttribute("data-ai-src"),
    "/api/v1/jobs/job-1/markdown/images/page-3/imgs/chart%20a.png",
  );
  assert.match(root.textContent, /图片不可用：tracker/);

  const calls = [];
  await hydrateProtectedImages(root, {
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
    },
  });
  assert.deepEqual(calls, [
    "/api/v1/jobs/job-1/markdown/images/page-3/imgs/chart%20a.png",
  ]);
  assert.match(image.getAttribute("src") || "", /^blob:/);
  dom.window.close();
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

test("assistant citation normalization preserves block anchor and converts legacy page to page_idx", () => {
  assert.deepEqual(normalizeAiCitations([{
    ref: "1",
    block_id: "  p009-b0010  ",
    page: 9,
    job_id: " job-ocr ",
    snippet: " evidence ",
  }]), [{
    ref: "1",
    block_id: "p009-b0010",
    page: 9,
    page_idx: 8,
    job_id: "job-ocr",
    document_id: "",
    snippet: "evidence",
  }]);
});

test("page 字段按 1 基换算(审计 B4 差一页回归锁)", () => {
  // 系统内所有 page 生产方(旧 chat 链路/_public_anchor)都是 1 基
  assert.equal(resolveCitationPageIdx({ page: 9 }), 8);
  assert.equal(resolveCitationPageNumber({ page: 9 }), 9);
  // page_idx(0 基)优先于 page
  assert.equal(resolveCitationPageIdx({ page_idx: 2, page: 9 }), 2);
  // page=0 非法(1 基不存在第 0 页) → 回退 block_id
  assert.equal(resolveCitationPageIdx({ page: 0, block_id: "p003-b0001" }), 2);
});

test("pickCitationsForAnswer keeps only refs used in answer", () => {
  const citations = [
    { ref: 1, block_id: "p002-b0001", page_idx: 1, snippet: "a" },
    { ref: 2, block_id: "p005-b0002", page_idx: 4, snippet: "b" },
    { ref: 3, block_id: "p008-b0003", page_idx: 7, snippet: "c" },
  ];
  const picked = pickCitationsForAnswer("结论见 [2] 与 [2] 再次，以及幽灵 [9]", citations);
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
  const picked = pickCitationsForAnswer("没有角标的长回答", citations, { max: 5 });
  assert.equal(picked.length, 3);
  assert.equal(picked[0].page_idx, 1);
  assert.equal(picked[1].page_idx, 7);
});
