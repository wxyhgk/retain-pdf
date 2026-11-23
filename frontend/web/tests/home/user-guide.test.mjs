/** 软件里的使用说明书（features/user-guide，页面在 frontend/web/guide/*.md）。
 *
 * 1. 纯函数：目录、锚点、链接、图片地址。
 * 2. 拿真的说明书逐页画一遍：每个页内链接指到的页存在、锚点在那一页里真有这个标题、每张图片文件存在。
 *    说明书改了标题而别处的 [x](页.md#旧标题) 没跟着改，这里会红。
 * 3. 弹窗：用假的 fetch 喂真文件，点目录翻页、点正文里的链接翻页并停在锚点。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom } from "../helpers/dom.mjs";
import {
  GUIDE_HOME,
  headingSlug,
  parseGuideIndex,
  resolveGuideAsset,
  resolveGuideLink,
} from "../../src/features/user-guide/index.js";
import { renderGuidePage } from "../../src/features/user-guide/domain/render.js";

const GUIDE = join(dirname(fileURLToPath(import.meta.url)), "../../guide");
const pages = readdirSync(GUIDE).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3));
const read = (page) => readFileSync(join(GUIDE, `${page}.md`), "utf8");

test("锚点和 GitHub 一样：小写、去标点、空格换连字符", () => {
  assert.equal(headingSlug("Docker 网页版"), "docker-网页版");
  assert.equal(headingSlug("设置 → 更新"), "设置--更新");
  assert.equal(headingSlug("翻译中看实时译文"), "翻译中看实时译文");
  assert.equal(headingSlug("Linux"), "linux");
});

test("链接：页.md#锚点 在说明书里翻页，#锚点 是本页，其余当外部", () => {
  assert.deepEqual(resolveGuideLink("book-detail.md#重新翻译", "ingest"), { page: "book-detail", anchor: "重新翻译" });
  assert.deepEqual(resolveGuideLink("book-detail.md#%E9%87%8D%E6%96%B0%E7%BF%BB%E8%AF%91", "ingest"), { page: "book-detail", anchor: "重新翻译" });
  assert.deepEqual(resolveGuideLink("./reader.md", "ingest"), { page: "reader", anchor: "" });
  assert.deepEqual(resolveGuideLink("#模型", "credentials"), { page: "credentials", anchor: "模型" });
  assert.equal(resolveGuideLink("https://github.com/wxyhgk/retain-pdf/releases", "install"), null);
  assert.equal(resolveGuideLink("../../ops/x.md", "install"), null);
  assert.equal(resolveGuideAsset("images/library/library.jpg", "http://127.0.0.1:40001/guide/"), "http://127.0.0.1:40001/guide/images/library/library.jpg");
  assert.equal(resolveGuideAsset("https://example.com/a.png", "/guide/"), "https://example.com/a.png");
});

test("目录就是 README 里「按功能查」那张表，每页都在", () => {
  const index = parseGuideIndex(read(GUIDE_HOME));
  assert.ok(index.length >= 16, `目录只有 ${index.length} 项`);
  assert.deepEqual(index.map((item) => item.page).sort(), pages.filter((page) => page !== GUIDE_HOME).sort());
  assert.equal(index.find((item) => item.page === "lan-share")?.title, "局域网共享");
});

test("真的说明书：每个页内链接、锚点、图片都对得上", () => {
  const dom = makeDom("");
  const document = dom.window.document;
  const headingIds = new Map();
  const rendered = new Map();
  for (const page of pages) {
    const holder = document.createElement("div");
    holder.innerHTML = renderGuidePage(read(page), page, "http://127.0.0.1/guide/");
    rendered.set(page, holder);
    headingIds.set(page, new Set([...holder.querySelectorAll("h1, h2, h3, h4")].map((node) => node.id)));
  }
  const broken = [];
  for (const [page, holder] of rendered) {
    for (const link of holder.querySelectorAll("a[data-guide-page]")) {
      const target = link.getAttribute("data-guide-page");
      const anchor = link.getAttribute("data-guide-anchor");
      if (!pages.includes(target)) broken.push(`${page}.md → ${target}.md 不存在`);
      else if (anchor && !headingIds.get(target).has(anchor)) broken.push(`${page}.md → ${target}.md#${anchor} 没有这个标题`);
    }
    for (const image of holder.querySelectorAll("img")) {
      const file = image.getAttribute("src").replace("http://127.0.0.1/guide/", "");
      if (!existsSync(join(GUIDE, file))) broken.push(`${page}.md 的图片 ${file} 不存在`);
    }
    for (const link of holder.querySelectorAll("a:not([data-guide-page])")) {
      assert.equal(link.getAttribute("target"), "_blank", `${page}.md 的外部链接 ${link.getAttribute("href")} 应该新窗口打开`);
    }
  }
  assert.deepEqual(broken, []);
  dom.window.close();
});

test("弹窗：点目录翻页，点正文里的链接翻到那一页的那个标题", async () => {
  const dom = makeDom("", { url: "http://127.0.0.1:40001/index.html", keys: ["window", "document", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "MutationObserver"] });
  const requested = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = new URL(`${url}`).pathname;
    requested.push(path);
    const page = decodeURIComponent(path.replace(/^\/guide\//, "").replace(/\.md$/, ""));
    if (!pages.includes(page)) return new Response("not found", { status: 404 });
    return new Response(read(page), { status: 200 });
  };
  try {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { UserGuideHost, openUserGuide } = await import("../../src/features/user-guide/index.js");
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    root.render(React.createElement(UserGuideHost));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(dom.window.document.getElementById("user-guide-dialog"), null, "没打开前不挂弹窗");

    openUserGuide("credentials");
    const article = () => dom.window.document.querySelector(".user-guide-article");
    await waitFor(() => article()?.textContent.includes("填 OCR 和翻译的 Key"), "打开到接口设置那一页");
    assert.equal(article().getAttribute("data-guide-current"), "credentials");
    await waitFor(() => dom.window.document.querySelector('[data-guide-nav="lan-share"]'), "目录从 README 的表读出来");
    assert.ok(requested.includes("/guide/credentials.md"));

    click(dom, dom.window.document.querySelector('[data-guide-nav="lan-share"]'));
    await waitFor(() => article()?.getAttribute("data-guide-current") === "lan-share" && article().textContent.includes("重置访问码"), "点目录翻到局域网共享");

    click(dom, dom.window.document.querySelector('[data-guide-nav="ingest"]'));
    await waitFor(() => article()?.querySelector('a[data-guide-page="book-detail"][data-guide-anchor="翻译存档的书"]'), "添加 PDF 页里有指到书的详情的链接");
    click(dom, article().querySelector('a[data-guide-page="book-detail"][data-guide-anchor="翻译存档的书"]'));
    await waitFor(() => article()?.getAttribute("data-guide-current") === "book-detail" && article().querySelector('[id="翻译存档的书"]'), "点正文里的链接翻到书的详情");
    const image = article().querySelector("img");
    assert.equal(image.getAttribute("src"), "http://127.0.0.1:40001/guide/images/book-detail/book-detail.jpg");

    root.unmount();
  } finally {
    globalThis.fetch = realFetch;
    dom.window.close();
  }
});
