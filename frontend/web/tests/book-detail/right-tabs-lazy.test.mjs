// 书籍详情页签：概览 / 进度 / 文件 / 质量 / 历史 / 用量；后三个第一次点开才挂内容，没给内容的不出现。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom as makeDomWith } from "../helpers/dom.mjs";

test("新页签点开才挂载，之后保留；没给内容的页签不出现", async () => {
  const dom = makeDomWith("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "Element", "SVGElement", "Event", "MouseEvent", "PointerEvent", "KeyboardEvent", "FocusEvent", "Node", "MutationObserver"],
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { BookDetailRightTabs } = await import("../../src/features/book-detail/ui/tabs/BookDetailRightTabs.jsx");
  let qualityMounts = 0;
  function Quality() {
    React.useEffect(() => { qualityMounts += 1; }, []);
    return React.createElement("p", { id: "quality-body" }, "质量");
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(BookDetailRightTabs, {
    open: true,
    overviewTab: React.createElement("p", null, "概览"),
    processingTab: React.createElement("p", null, "进度"),
    artifactsTab: React.createElement("p", null, "文件"),
    qualityTab: React.createElement(Quality),
    historyTab: React.createElement("p", { id: "history-body" }, "历史"),
    usageTab: null,
  }));
  const doc = dom.window.document;
  await waitFor(() => doc.getElementById("book-detail-tab-overview"), "页签栏");
  const ids = [...doc.querySelectorAll(".book-detail-right-tab")].map((tab) => tab.id.replace("book-detail-tab-", ""));
  assert.deepEqual(ids, ["overview", "processing", "artifacts", "quality", "history"], "没给用量内容就不出现「用量」");
  assert.equal(doc.getElementById("quality-body"), null, "没点开前不挂载");
  assert.equal(qualityMounts, 0);

  const trigger = doc.getElementById("book-detail-tab-quality");
  clickWithMouseDown(dom, trigger);
  await waitFor(() => doc.getElementById("quality-body"), "点开后挂载");
  clickWithMouseDown(dom, doc.getElementById("book-detail-tab-overview"));
  await waitFor(() => doc.getElementById("book-detail-tab-overview").getAttribute("data-state") === "active", "回到概览");
  assert.ok(doc.getElementById("quality-body"), "切走后保留");
  assert.equal(qualityMounts, 1, "不重复挂载");
  root.unmount();
});
