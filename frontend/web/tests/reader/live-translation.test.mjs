import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import {
  streamLiveTranslationEvents,
} from "../../../../frontend/packages/api/src/live-translation.ts";
import {
  EMPTY_LIVE_TRANSLATION_STATE,
  applyLiveTranslationSnapshot,
  decideLiveTranslationSnapshot,
  layoutPageMap,
} from "../../../../frontend/packages/reader/src/shared/data/live-translation-state.ts";
import {
  prepareLiveTranslationMathHtml,
  projectLiveTranslationItems,
  resolveLiveTranslationTextStyle,
} from "../../../../frontend/packages/reader/src/pdf/LiveTranslationOverlay.tsx";
import {
  shouldEnableLiveTranslation,
  shouldTrackLiveTranslation,
} from "../../../../frontend/packages/reader/src/hooks/use-reader-react-controller.ts";
import { useLiveTranslation } from "../../../../frontend/packages/reader/src/hooks/use-live-translation.ts";
import { liveTranslationStatusCopy } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderWorkspaceTabs.tsx";

const makeEvent = (overrides = {}) => ({
  event: "translation_units_committed",
  seq: 1,
  attempt: 1,
  generation: 2,
  page_idx: 0,
  page_hash: "hash-2",
  changed_item_ids: ["p001-b0001"],
  ...overrides,
});

const makeSnapshot = (overrides = {}) => ({
  attempt: 1,
  generation: 2,
  page_idx: 0,
  page_hash: "hash-2",
  items: [
    { item_id: "p001-b0001", translated_text: "第一段", status: "translated" },
    { item_id: "p001-b0002", translated_text: "第二段", status: "translated" },
  ],
  ...overrides,
});

test("live translation ignores duplicate SSE seq and does not replay animation", () => {
  const event = makeEvent();
  const first = applyLiveTranslationSnapshot(EMPTY_LIVE_TRANSLATION_STATE, event, makeSnapshot());
  const second = applyLiveTranslationSnapshot(first, event, makeSnapshot({
    items: [{ item_id: "p001-b0001", translated_text: "不应覆盖", status: "translated" }],
  }));
  assert.equal(second, first);
  assert.equal(second.pagesByPage.get(0).itemsById.get("p001-b0001").translated_text, "第一段");
  assert.equal(second.pagesByPage.get(0).changedAtSeqById.get("p001-b0001"), 1);
});

test("older generation cannot overwrite a newer authoritative page", () => {
  const newer = applyLiveTranslationSnapshot(
    EMPTY_LIVE_TRANSLATION_STATE,
    makeEvent({ seq: 5, generation: 5, page_hash: "hash-5" }),
    makeSnapshot({ generation: 5, page_hash: "hash-5" }),
  );
  const staleEvent = makeEvent({ seq: 6, generation: 4, page_hash: "hash-4" });
  const staleSnapshot = makeSnapshot({ generation: 4, page_hash: "hash-4" });
  assert.equal(decideLiveTranslationSnapshot(newer.pagesByPage.get(0), staleEvent, staleSnapshot), "ignore");
  const after = applyLiveTranslationSnapshot(newer, staleEvent, staleSnapshot);
  assert.equal(after.pagesByPage.get(0).generation, 5);
  assert.equal(after.lastSeq, 6);
});

test("same generation with a different hash is rejected for retry", () => {
  const event = makeEvent({ page_hash: "event-hash" });
  assert.equal(
    decideLiveTranslationSnapshot(undefined, event, makeSnapshot({ page_hash: "other-hash" })),
    "retry",
  );
});

test("repair updates only changed item animation identities", () => {
  const initial = applyLiveTranslationSnapshot(
    EMPTY_LIVE_TRANSLATION_STATE,
    makeEvent({ seq: 10, changed_item_ids: ["p001-b0001", "p001-b0002"] }),
    makeSnapshot(),
  );
  const repaired = applyLiveTranslationSnapshot(
    initial,
    makeEvent({ seq: 11, generation: 3, page_hash: "hash-3", changed_item_ids: ["p001-b0002"] }),
    makeSnapshot({
      generation: 3,
      page_hash: "hash-3",
      items: [
        { item_id: "p001-b0001", translated_text: "第一段", status: "translated" },
        { item_id: "p001-b0002", translated_text: "修订后的第二段", status: "repaired" },
      ],
    }),
  );
  const page = repaired.pagesByPage.get(0);
  assert.equal(page.changedAtSeqById.get("p001-b0001"), 10);
  assert.equal(page.changedAtSeqById.get("p001-b0002"), 11);
  const projected = projectLiveTranslationItems({
    page_idx: 0,
    width: 100,
    height: 100,
    blocks: [
      { item_id: "p001-b0001", bbox: [0, 0, 40, 20], source_text: "one", kind: "text" },
      { item_id: "p001-b0002", bbox: [0, 20, 40, 40], source_text: "two", kind: "text" },
    ],
  }, page, 100, 100);
  assert.equal(projected.find((item) => item.itemId === "p001-b0001").changedNow, false);
  assert.equal(projected.find((item) => item.itemId === "p001-b0002").changedNow, true);
});

test("duplicate or grouped flushes update each page independently", () => {
  const page0 = applyLiveTranslationSnapshot(
    EMPTY_LIVE_TRANSLATION_STATE,
    makeEvent({ seq: 20, page_idx: 0, page_hash: "p0" }),
    makeSnapshot({ page_idx: 0, page_hash: "p0" }),
  );
  const page1 = applyLiveTranslationSnapshot(
    page0,
    makeEvent({ seq: 21, page_idx: 1, page_hash: "p1", changed_item_ids: ["p002-b0001"] }),
    makeSnapshot({
      page_idx: 1,
      page_hash: "p1",
      items: [{ item_id: "p002-b0001", translated_text: "跨页项目", status: "translated" }],
    }),
  );
  assert.equal(page1.pagesByPage.size, 2);
  assert.equal(page1.pagesByPage.get(0).pageHash, "p0");
  assert.equal(page1.pagesByPage.get(1).itemsById.get("p002-b0001").translated_text, "跨页项目");
});

test("authenticated fetch SSE parser handles split chunks and reconnect cursor", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    "id: 42\nevent: translation_units_",
    "committed\ndata: {\"event\":\"translation_units_committed\",\"seq\":42,\"attempt\":1,",
    "\"generation\":18,\"page_idx\":0,\"page_hash\":\"abc\",\"changed_item_ids\":[\"a\"]}\n\n",
  ];
  let requestedUrl = "";
  const fetchImpl = async (url, init) => {
    requestedUrl = String(url);
    assert.equal(init.headers.Accept, "text/event-stream");
    return new Response(new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }), { status: 200 });
  };
  const events = [];
  await streamLiveTranslationEvents("job-a", {
    afterSeq: 41,
    apiPrefix: "/api/v1",
    fetchImpl,
    onEvent: (event) => events.push(event),
  });
  assert.match(requestedUrl, /jobs\/job-a\/live-events\?after_seq=41$/);
  assert.deepEqual(events.map((event) => [event.seq, event.generation]), [[42, 18]]);
});

test("overlay projection remains accurate after zoom and is keyed by page coordinates", () => {
  const layout = {
    pages: [{
      page_idx: 0,
      width: 100,
      height: 200,
      blocks: [{ item_id: "p001-b0001", bbox: [10, 20, 60, 50], source_text: "source", kind: "text" }],
    }],
  };
  const layoutByPage = layoutPageMap(layout);
  const state = applyLiveTranslationSnapshot(EMPTY_LIVE_TRANSLATION_STATE, makeEvent(), makeSnapshot());
  const projected = projectLiveTranslationItems(layoutByPage.get(0), state.pagesByPage.get(0), 300, 600);
  assert.deepEqual(projected[0].rect, { left: 30, top: 60, width: 150, height: 90 });
});

test("live overlay is non-interactive and can be assigned to the dedicated live pane", async () => {
  const [css, pageSlot, pane] = await Promise.all([
    readFile(new URL("../../../../frontend/packages/reader/styles/live-translation.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/pdf/PdfDocumentPane.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.reader-live-translation-overlay\s*\{[\s\S]*pointer-events:\s*none/);
  assert.match(pageSlot, /active && showLiveTranslation/);
  assert.match(pageSlot, /showLiveTranslation = pane === "source"/);
  assert.match(pane, /liveTranslation\?\.layoutByPage\.get\(pageNumber - 1\)/);
  assert.match(pane, /const isWindowed = windowedSet\.has\(pageNumber\)/);
});

test("live typography converts Typst point sizes and leading into viewport CSS", () => {
  const style = resolveLiveTranslationTextStyle({
    kind: "paragraph",
    rect: { left: 0, top: 0, width: 240, height: 80 },
    sourceText: "two lines\nof source",
    typography: {
      font_family: "Source Han Serif SC",
      font_size_pt: 9.82,
      leading_em: 0.56,
      font_weight: 500,
      text_align: "justify",
      padding_left_pt: 2,
      fit_min_font_size_pt: 7,
    },
  }, 2);
  assert.equal(style.fontFamily, "Source Han Serif SC");
  assert.equal(style.fontSizePx, 19.64);
  assert.equal(style.minFontSizePx, 14);
  assert.equal(style.lineHeight, 1.56);
  assert.equal(style.fontWeight, 500);
  assert.deepEqual(style.padding, [0, 0, 0, 4]);
  assert.equal(style.exact, true);
});

test("live formula HTML escapes prose before asynchronously materializing MathJax", async () => {
  const prepared = prepareLiveTranslationMathHtml('<img src=x onerror=alert(1)> and $\\lambda\\nu=c$');
  assert.equal(prepared.hasMath, true);
  assert.match(prepared.fallbackHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(prepared.fallbackHtml, /<img/);
  const rich = await prepared.richHtml;
  assert.match(rich, /reader-md-math/);
  assert.match(rich, /<svg/);
});

test("live formula overlay owns math layout styles without intercepting PDF input", async () => {
  const css = await readFile(
    new URL("../../../../frontend/packages/reader/styles/live-translation.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.reader-live-translation-content \.reader-md-math-inline/);
  assert.match(css, /\.reader-live-translation-content \.reader-md-math svg/);
  assert.match(css, /\.reader-live-translation-overlay\s*\{[\s\S]*pointer-events:\s*none/);
});

test("live translation stays available during retranslation even when an older translated PDF exists", () => {
  assert.equal(shouldEnableLiveTranslation({
    jobId: "job-retranslate",
    sourceUrl: "/source.pdf",
    translatedUrl: "/old-translation.pdf",
    jobStatus: "running",
    workflow: "translate",
  }), true);
  assert.equal(shouldEnableLiveTranslation({
    jobId: "job-finished",
    sourceUrl: "/source.pdf",
    translatedUrl: "/final-translation.pdf",
    jobStatus: "succeeded",
    workflow: "book",
  }), false);
  assert.equal(shouldEnableLiveTranslation({
    jobId: "job-switching-to-final",
    sourceUrl: "/source.pdf",
    translatedUrl: "",
    jobStatus: "succeeded",
    workflow: "book",
  }), true, "committed live pages stay visible until the final artifact URL arrives");
  assert.equal(shouldEnableLiveTranslation({
    jobId: "job-failed-retranslation",
    sourceUrl: "/source.pdf",
    translatedUrl: "/older-translation.pdf",
    jobStatus: "failed",
    workflow: "translate",
  }), true, "failed attempts keep live snapshots instead of falling back to an older PDF");
  assert.equal(shouldEnableLiveTranslation({
    jobId: "job-ocr",
    sourceUrl: "/source.pdf",
    translatedUrl: "",
    jobStatus: "running",
    workflow: "ocr",
  }), false);
  assert.equal(shouldTrackLiveTranslation({
    jobId: "job-finished",
    sourceUrl: "/source.pdf",
    workflow: "book",
  }), true, "the hook keeps observing session terminal state after the temporary UI is replaced");
});

test("live translation consumes session terminal status without polling the job", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/reader.html?job_id=job-session",
    pretendToBeVisual: true,
  });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  const requestedUrls = [];
  const enc = new TextEncoder();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async (url, init = {}) => {
    requestedUrls.push(String(url));
    if (String(url).includes("/live-translation/layout")) {
      return new Response(JSON.stringify({ code: 0, message: "ok", data: { pages: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).includes("/live-events")) {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(": connected\n\n"));
          init.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
        },
      }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const root = createRoot(document.getElementById("root"));
  let latest = null;
  function Harness({ jobStatus }) {
    latest = useLiveTranslation({
      jobId: "job-session",
      jobStatus,
      enabled: true,
    });
    return null;
  }

  try {
    await act(async () => {
      root.render(createElement(Harness, { jobStatus: "running" }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    assert.ok(requestedUrls.some((url) => url.includes("/live-events")));

    await act(async () => root.render(createElement(Harness, { jobStatus: "succeeded" })));
    assert.equal(latest.connection, "terminal");

    await act(async () => root.render(createElement(Harness, { jobStatus: "succeeded" })));
    assert.equal(latest.connection, "terminal", "terminal rerenders must remain stable");
    assert.equal(requestedUrls.some((url) => /\/jobs\/job-session(?:\?|$)/.test(url)), false,
      "the live hook must not independently fetch job payloads");
  } finally {
    await act(async () => root.unmount());
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.fetch = previous.fetch;
    if (previous.IS_REACT_ACT_ENVIRONMENT === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    else globalThis.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
});

test("reader exposes a discoverable live-translation toggle with transport status", async () => {
  const source = await readFile(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderWorkspaceTabs.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /reader-live-translation-toggle/);
  assert.match(source, /aria-pressed=\{liveTranslation\.visible\}/);
  assert.equal(liveTranslationStatusCopy({
    ...EMPTY_LIVE_TRANSLATION_STATE,
    connection: "live",
    pagesByPage: new Map([[0, {}]]),
  }), "实时译文 · 1 页");
  assert.equal(liveTranslationStatusCopy({
    ...EMPTY_LIVE_TRANSLATION_STATE,
    connection: "unavailable",
    error: "后端没有提交页面快照",
  }), "实时译文 · 不可用");
});
