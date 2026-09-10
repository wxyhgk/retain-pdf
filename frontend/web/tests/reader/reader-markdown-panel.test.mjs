import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/reader.html?job_id=job-markdown",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "history",
  "location",
  "localStorage",
  "HTMLElement",
  "Element",
  "Event",
  "Node",
]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    writable: true,
    configurable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
const { createReaderDataPort } = await import(
  "../../../../frontend/packages/reader/src/shared/data/data-port.ts"
);
const {
  ReaderMarkdownPanel,
  buildMarkdownOutline,
  findMarkdownSearchTargets,
  isProtectedMarkdownAssetUrl,
  startMarkdownImageLoading,
} = await import(
  "../../../../frontend/packages/reader/src/components/react-pdf/ReaderMarkdownPanel.tsx"
);
const {
  resetMarkdownMathEngineLoader,
  setMarkdownMathEngineLoader,
} = await import("../../../../frontend/packages/reader/src/shared/content/markdown-math.ts");
const { retainPdfReaderAdapters } = await import(
  "../../src/app/reader/adapters/retainpdf.ts"
);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(10);
  }
  const status = dom.window.document.querySelector("#reader-markdown-panel .reader-notes-count")?.textContent;
  const markdown = dom.window.document.querySelector("#reader-markdown-content")?.textContent;
  const image = dom.window.document.querySelector("#reader-markdown-content img");
  assert.fail(`等待超时：${description}; status=${status}; markdown=${markdown}; image=${image?.outerHTML}`);
}

test("OCR-only legacy Markdown and its protected image render in the reader panel", async () => {
  assert.equal(typeof retainPdfReaderAdapters.parseMarkdownWithMath, "function");
  assert.equal(typeof retainPdfReaderAdapters.resolveMarkdownAssetUrl, "function");

  const calls = [];
  const dataPort = createReaderDataPort({
    loadMarkdownDocument: async (jobId) => {
      calls.push(`document:${jobId}`);
      return { ready: false, content: "" };
    },
    loadMarkdown: async (jobId) => {
      calls.push(`legacy:${jobId}`);
      return {
        ready: true,
        markdown: "# Visible OCR Markdown\n\n![OCR figure](images/page-1/figure.png)",
        images_base_url: "/api/v1/jobs/job-ocr/markdown/images/",
      };
    },
    fetchProtectedResource: async (url) => {
      calls.push(`image:${url}`);
      return {
        ok: true,
        blob: async () => new Blob(["ocr-image"], { type: "image/png" }),
      };
    },
  });
  setReaderAdapters({
    ...retainPdfReaderAdapters,
    defaultReaderDataPort: dataPort,
    fetchProtected: dataPort.fetchProtected,
  });

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(ReaderMarkdownPanel, {
    open: true,
    // document_id + active_job_id resolves to a real OCR job before this panel opens.
    jobId: "job-ocr",
    sourceOnly: false,
    layout: "docked",
    onClose: () => {},
  }));

  await waitFor(
    () => (
      dom.window.document.querySelector("#reader-markdown-content h1")?.textContent === "Visible OCR Markdown"
      && dom.window.document.querySelector("#reader-markdown-content img")?.src.startsWith("blob:")
      && dom.window.document.querySelector("#reader-markdown-panel .reader-notes-count")?.textContent === "已加载"
    ),
    "OCR Markdown 正文与受保护图片渲染完成",
  );
  const image = dom.window.document.querySelector("#reader-markdown-content img");
  assert.equal(
    image?.getAttribute("data-reader-md-src"),
    "/api/v1/jobs/job-ocr/markdown/images/page-1/figure.png",
  );
  assert.deepEqual(calls, [
    "document:job-ocr",
    "legacy:job-ocr",
    "image:/api/v1/jobs/job-ocr/markdown/images/page-1/figure.png",
  ]);
  assert.equal(
    dom.window.document.querySelector("#reader-markdown-panel .reader-notes-count")?.textContent,
    "已加载",
  );
  assert.ok(
    dom.window.document.querySelector("#reader-markdown-panel")?.classList.contains("reader-notes-panel--docked"),
  );
  assert.equal(
    dom.window.document.querySelector("#reader-markdown-panel .reader-notes-panel-drag"),
    null,
  );

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("Markdown body paints before a delayed MathJax engine finishes", async () => {
  setMarkdownMathEngineLoader(async () => {
    await wait(120);
    return {
      convert: (tex, display) => `<svg data-tex="${tex}" data-display="${display}"></svg>`,
    };
  });
  setReaderAdapters({
    ...retainPdfReaderAdapters,
    defaultReaderDataPort: {
      loadMarkdownPayload: async () => ({
        ready: true,
        markdown: "# Progressive\n\nFormula $x_i$ is visible.",
      }),
    },
  });

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(ReaderMarkdownPanel, {
    open: true,
    jobId: "job-progressive",
    sourceOnly: false,
    onClose: () => {},
  }));

  await waitFor(
    () => (
      dom.window.document.querySelector("#reader-markdown-content h1")?.textContent === "Progressive"
      && /正文已显示/.test(
        dom.window.document.querySelector("#reader-markdown-panel .reader-notes-count")?.textContent || "",
      )
    ),
    "MathJax 完成前先显示 Markdown 正文",
  );
  assert.match(
    dom.window.document.querySelector("#reader-markdown-panel .reader-notes-count")?.textContent || "",
    /正文已显示/,
  );
  assert.ok(dom.window.document.querySelector("#reader-markdown-content .reader-md-math-failed"));

  await waitFor(
    () => Boolean(dom.window.document.querySelector("#reader-markdown-content svg[data-tex='x_i']")),
    "后台完成 MathJax SVG 升级",
  );

  root.unmount();
  host.remove();
  resetMarkdownMathEngineLoader();
  setReaderAdapters(null);
});

test("only local Markdown API images use the protected credentialed fetch path", () => {
  assert.equal(
    isProtectedMarkdownAssetUrl(
      "http://127.0.0.1:41000/api/v1/jobs/job-1/markdown/images/page-1/a.png",
    ),
    true,
  );
  assert.equal(
    isProtectedMarkdownAssetUrl("/api/v1/jobs/job-1/markdown/images/page-1/a.png"),
    true,
  );
  assert.equal(isProtectedMarkdownAssetUrl("https://example.test/public.png"), false);
  assert.equal(
    isProtectedMarkdownAssetUrl("https://attacker.test/api/v1/jobs/job-1/markdown/images/a.png"),
    false,
  );
  assert.equal(isProtectedMarkdownAssetUrl("data:image/png;base64,AA=="), false);
});

test("Markdown outline assigns stable duplicate-safe heading anchors", () => {
  const article = dom.window.document.createElement("article");
  article.innerHTML = "<h1>结果与讨论</h1><h2>Energy Profile</h2><h2>Energy Profile</h2><h3></h3>";

  assert.deepEqual(buildMarkdownOutline(article), [
    { id: "reader-md-结果与讨论", level: 1, text: "结果与讨论" },
    { id: "reader-md-energy-profile", level: 2, text: "Energy Profile" },
    { id: "reader-md-energy-profile-2", level: 2, text: "Energy Profile" },
  ]);
  assert.deepEqual(
    [...article.querySelectorAll("h1, h2")].map((heading) => heading.id),
    ["reader-md-结果与讨论", "reader-md-energy-profile", "reader-md-energy-profile-2"],
  );
});

test("Markdown search marks leaf content blocks without duplicating parent matches", () => {
  const article = dom.window.document.createElement("article");
  article.innerHTML = `
    <h2>Experiment</h2>
    <blockquote><p>The catalyst is stable.</p></blockquote>
    <p>A second catalyst appears.</p>
  `;

  const matches = findMarkdownSearchTargets(article, "CATALYST");
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((element) => element.tagName), ["P", "P"]);
  assert.ok(matches.every((element) => element.classList.contains("reader-markdown-search-hit")));
  assert.equal(findMarkdownSearchTargets(article, "missing").length, 0);
  assert.equal(article.querySelectorAll(".reader-markdown-search-hit").length, 0);
});

test("protected Markdown images wait for the reader viewport before fetching", async () => {
  const previousObserver = globalThis.IntersectionObserver;
  let observerCallback = null;
  const observed = [];
  class FakeIntersectionObserver {
    constructor(callback, options) {
      observerCallback = callback;
      this.options = options;
    }
    observe(target) { observed.push(target); }
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = FakeIntersectionObserver;

  const root = dom.window.document.createElement("div");
  const image = dom.window.document.createElement("img");
  image.setAttribute(
    "data-reader-md-src",
    "/api/v1/jobs/job-1/markdown/images/page-1/figure.png",
  );
  root.appendChild(image);
  dom.window.document.body.appendChild(root);
  let fetchCount = 0;
  const cleanup = startMarkdownImageLoading([image], {
    root,
    fetchImage: async () => {
      fetchCount += 1;
      return { ok: true, blob: async () => new Blob(["png"]) };
    },
    onObjectUrl: () => {},
  });

  assert.equal(fetchCount, 0);
  assert.deepEqual(observed, [image]);
  assert.equal(image.getAttribute("src"), null);
  observerCallback([{ isIntersecting: true, target: image }]);
  await waitFor(() => fetchCount === 1 && Boolean(image.src), "图片进入阅读视口后才请求 blob");

  cleanup();
  root.remove();
  globalThis.IntersectionObserver = previousObserver;
});
