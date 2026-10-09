/** 书籍详情「进度」页签测试共用的夹具：空闲态的 OCR / 翻译 props，以及挂载页签的函数。
 *
 * processing-tab-coverage 与 processing-tab-failure-wiring 原来各抄一份。两边给
 * HomeShellProviders 的 services 不同（覆盖条那边会拉起嵌入状态卡，要 reader），所以
 * services 由调用方传入，不在这里统一。
 */
import { waitFor } from "../../helpers/async.mjs";
import { withHomeProviders } from "../../helpers/home-providers.mjs";

export const idleOcr = {
  job: null, pending: false, cancelling: false, error: "", rangeOn: false, startPage: "1", endPage: "",
  onRangeOnChange() {}, onStartPageChange() {}, onEndPageChange() {}, onOcr() {}, onCancel() {},
};

export const idleTranslation = {
  item: {}, status: { label: "尚未翻译", tone: "muted" }, isActive: false, canTranslate: true,
  rangeOn: false, startPage: "1", endPage: "",
  onRangeOnChange() {}, onStartPageChange() {}, onEndPageChange() {},
  onTranslate() {}, onRetryStage: async () => {},
};

/** 把 BookDetailProcessingTab 包在主页的 Provider 里挂进 dom，等进度卡出现。 */
export async function mountProcessingTab(dom, props, services) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { BookDetailProcessingTab } = await import(
    "../../../src/features/book-detail/ui/tabs/BookDetailProcessingTab.js"
  );
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(await withHomeProviders(React, services, React.createElement(BookDetailProcessingTab, props)));
  await waitFor(() => host.querySelector(".book-detail-processing-card"), "进度卡渲染");
  return { root, host };
}
