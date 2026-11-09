// 「常用下载」的 Markdown zip：原文 / 译文 / 双语三份 md + images/（浏览器里打，2026-11-09 用户定前端自己做）。
// 拼法和 Markdown 面板同一组块（buildReaderMdBlocks），数据形状照 reader-markdown-blocks.test.mjs 的真实 regions 造。
import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { buildReaderMarkdownExport } from "../../../../frontend/packages/reader/src/shared/content/markdown-export.ts";

function item(id, page, order, subType, source, extra = {}) {
  const box = (text) => ({ page, bbox: [10, 10 + order * 20, 200, 28 + order * 20], unit: "pdf_point", origin: "top_left", text });
  return {
    item_id: id,
    source: box(source),
    translated: box(extra.translated ?? null),
    markdown: extra.translated ?? source,
    region_type: extra.region_type ?? "text",
    status: extra.translated ? "translated" : "source_only",
    asset_ids: [],
    asset_urls: extra.asset_urls ?? [],
    reading_order: order,
    sub_type: subType,
    ...(extra.heading_level ? { heading_level: extra.heading_level } : {}),
    ...(extra.group ? { continuation_group_id: extra.group } : {}),
  };
}

const IMAGE = "/api/v1/jobs/j/files/output/ocr/images/page-2/a.jpg";
const PAYLOAD = {
  items: [
    item("p001-b000", 1, 0, "title", "Smart Machine Learning", { translated: "智能机器学习", heading_level: 1 }),
    item("p001-b001", 1, 1, "heading", "Introduction", { translated: "引言", heading_level: 2 }),
    item("p001-b002", 1, 2, "body", "Solving the SE is hard,", { translated: "求解薛定谔方程很难，而且这进一步加剧了维度灾难。", group: "cg-1" }),
    item("p001-b003", 1, 3, "page_number", "1"),
    item("p002-b000", 2, 0, "body", "further compounding the curse.", { translated: "求解薛定谔方程很难，而且这进一步加剧了维度灾难。", group: "cg-1" }),
    item("p002-b001", 2, 1, "display_formula", "$$ H = T + V $$", { region_type: "formula" }),
    item("p002-b002", 2, 2, "formula_number", "(1)"),
    item("p002-b003", 2, 3, "image_body", "", { region_type: "image", asset_urls: [IMAGE] }),
    item("p002-b004", 2, 4, "figure_caption", "Fig. 1 Schematic.", { translated: "图 1 示意图。" }),
    item("p002-b005", 2, 5, "reference_entry", "[1] A. Author, J. Chem. 2020."),
  ],
};

test("三份 md：原文、译文（跨页一段只出一次整段译文、没译文的放原文）、双语（原文下面紧跟译文，公式和图只出一次）", () => {
  const md = buildReaderMarkdownExport(PAYLOAD);
  assert.ok(md);
  assert.equal(md.hasTranslation, true);
  assert.equal(md.source, [
    "# Smart Machine Learning",
    "## Introduction",
    "Solving the SE is hard, further compounding the curse.",
    "$$ H = T + V \\tag{1}$$",
    "![](images/page-2/a.jpg)",
    "Fig. 1 Schematic.",
    "[1] A. Author, J. Chem. 2020.",
  ].join("\n\n") + "\n", "页码不进；公式编号写成 \\tag；图用相对路径");
  assert.equal(md.translated, [
    "# 智能机器学习",
    "## 引言",
    "求解薛定谔方程很难，而且这进一步加剧了维度灾难。",
    "$$ H = T + V \\tag{1}$$",
    "![](images/page-2/a.jpg)",
    "图 1 示意图。",
    "[1] A. Author, J. Chem. 2020.",
  ].join("\n\n") + "\n");
  assert.equal(md.bilingual, [
    "# Smart Machine Learning\n\n# 智能机器学习",
    "## Introduction\n\n## 引言",
    "Solving the SE is hard, further compounding the curse.\n\n求解薛定谔方程很难，而且这进一步加剧了维度灾难。",
    "$$ H = T + V \\tag{1}$$",
    "![](images/page-2/a.jpg)",
    "Fig. 1 Schematic.\n\n图 1 示意图。",
    "[1] A. Author, J. Chem. 2020.",
  ].join("\n\n") + "\n");
  assert.deepEqual(md.assets, [{ url: IMAGE, path: "images/page-2/a.jpg" }]);
});

test("老任务没有阅读顺序：拼不出块，返回 null（宿主退回 ocr.zip）；重名的图加序号", () => {
  assert.equal(buildReaderMarkdownExport({ items: PAYLOAD.items.map(({ reading_order, ...rest }) => rest) }), null);
  const twins = buildReaderMarkdownExport({
    items: [
      item("p1", 1, 0, "image_body", "", { region_type: "image", asset_urls: ["/x/a/fig.png"] }),
      item("p2", 1, 1, "image_body", "", { region_type: "image", asset_urls: ["/y/b/fig.png"] }),
    ],
  });
  assert.deepEqual(twins.assets.map((asset) => asset.path), ["images/fig.png", "images/fig-2.png"]);
  assert.equal(twins.hasTranslation, false);
});

test("打包：zip 里是 书名.en.md / .zh.md / .bilingual.md 和 images/，图片取不到不让整个下载失败；书名进文件名先去掉不认的字符", async () => {
  const { buildMarkdownBundle, markdownBundleBaseName } = await import("../../src/features/book-detail/domain/markdown-bundle.ts");
  assert.equal(markdownBundleBaseName('A/B: "C" <D>', "job"), "A B C D");
  assert.equal(markdownBundleBaseName("   ", "job-1"), "job-1");
  assert.equal([...markdownBundleBaseName("长".repeat(200), "x")].length, 80);

  const previousFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = `${input?.url ?? input}`;
    requested.push(url);
    if (url.includes("/reader/regions")) {
      return new Response(JSON.stringify({ code: 0, data: PAYLOAD }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("page-2/a.jpg")) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    return new Response("missing", { status: 404 });
  };
  try {
    const bundle = await buildMarkdownBundle({ jobId: "j", title: "Quantum: Book" });
    assert.equal(bundle.filename, "Quantum Book-markdown.zip");
    const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
    assert.deepEqual(Object.keys(files).sort(), ["Quantum Book.bilingual.md", "Quantum Book.en.md", "Quantum Book.zh.md", "images/page-2/a.jpg"].sort());
    assert.match(strFromU8(files["Quantum Book.zh.md"]), /^# 智能机器学习/);
    assert.deepEqual([...files["images/page-2/a.jpg"]], [1, 2, 3]);
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.ok(requested.some((url) => url.includes("/jobs/j/reader/regions")), "从 reader/regions 拼");
});
