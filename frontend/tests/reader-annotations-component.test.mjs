import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Test cấp component React: hook esbuild của tests/helpers/jsx-loader.mjs tải trực tiếp .jsx.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (được đưa vào ở giai đoạn B) cần cancelAnimationFrame
// trong jsdom (dọn bộ hẹn giờ hoạt ảnh mount của TabsContent) và getComputedStyle
// (Presence đọc animation-name để biết hoạt ảnh rời đã kết thúc). window của
// jsdom có sẵn các hàm này nhưng chưa sao chép lên global, nên bổ sung tại đây.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { ANNOTATION_KIND_META } = await import("../src/js/reader/annotations/view-model.js");
const { mountReaderAnnotationsApp } = await import("../src/js/islands/reader-annotations/reader-annotations-app.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chờ bằng polling thay cho wait(50) cố định dễ hỏng: khi toàn bộ test chạy
// đồng thời, CPU có thể bận và React commit / loadAnnotations bất đồng bộ chưa
// hoàn tất trong số mili giây cố định (đã từng bị tải render tăng do thay đổi
// thẻ trang chủ làm quá tải). predicate trả về true thì đạt.
async function waitUntil(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`Hết thời gian chờ: ${description}`);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function makeAnnotations() {
  return [
    {
      favoriteId: "fav-1",
      pageIdx: 0,
      blockId: "b-1",
      kind: "sentence",
      quoteText: "第一条批注原文",
      translatedQuoteText: "",
      note: "已有的笔记",
      createdAt: "2026-07-01T10:00:00Z",
    },
    {
      favoriteId: "fav-2",
      pageIdx: 0,
      blockId: "b-2",
      kind: "data",
      quoteText: "第二条批注原文",
      translatedQuoteText: "第二条批注译文",
      note: "",
      createdAt: "2026-07-01T11:00:00Z",
    },
    {
      favoriteId: "fav-3",
      pageIdx: 2,
      blockId: "b-3",
      kind: "figure",
      quoteText: "第三条批注原文",
      translatedQuoteText: "",
      note: "",
      createdAt: "2026-07-02T09:00:00Z",
    },
  ];
}

test("Bảng chú thích: render nhóm, sửa ghi chú, xóa lạc quan và xuất Markdown", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  const deleteCalls = [];
  const saveCalls = [];
  const exportCalls = [];
  const jumpCalls = [];
  const ports = {
    subscribeOpen: (subscriber) => {
      subscriber(true);
      return () => {};
    },
    loadAnnotations: async () => makeAnnotations(),
    deleteAnnotation: async (favoriteId) => {
      deleteCalls.push(favoriteId);
      return true;
    },
    saveNote: async (annotation, note) => {
      saveCalls.push([annotation.favoriteId, note]);
      return { ...annotation, note };
    },
    jumpToAnchor: (anchor) => {
      jumpCalls.push(anchor);
    },
    exportMarkdown: async (text) => {
      exportCalls.push(text);
      return true;
    },
    documentTitle: () => "测试文档",
  };

  const app = mountReaderAnnotationsApp(host, ports);
  // Chờ loadAnnotations bất đồng bộ hoàn tất và cả ba thẻ được render (wait
  // cố định không đủ khi tải đầy).
  await waitUntil(() => host.querySelectorAll(".reader-annotations-item").length === 3, "render ba thẻ chú thích");

  // Render cơ bản: tiêu đề nhóm, thẻ, huy hiệu và ghi chú hiện có.
  assert.ok(host.querySelector(".reader-annotations-panel"), "Bảng đã được render");
  assert.equal(host.querySelector(".reader-annotations-count")?.textContent, "3 ghi chú");
  const groupTitles = [...host.querySelectorAll(".reader-annotations-group-title")];
  assert.equal(groupTitles.length, 2, "Hai tiêu đề nhóm");
  assert.deepEqual(groupTitles.map((node) => node.textContent), ["Trang 1", "Trang 3"]);
  const items = [...host.querySelectorAll(".reader-annotations-item")];
  assert.equal(items.length, 3, "Ba thẻ chú thích");
  assert.deepEqual(
    [...host.querySelectorAll(".reader-annotations-kind")].map((node) => node.textContent),
    [
      ANNOTATION_KIND_META.sentence.label,
      ANNOTATION_KIND_META.data.label,
      ANNOTATION_KIND_META.figure.label,
    ],
    "Nhãn huy hiệu kind đúng",
  );
  assert.ok(host.querySelector(".reader-annotations-kind.is-data"), "Huy hiệu có class is-{kind}");
  assert.equal(host.querySelector(".reader-annotations-note")?.textContent, "已有的笔记");
  assert.equal(host.querySelector(".reader-annotations-translated")?.textContent, "第二条批注译文");

  // Thêm ghi chú: textarea xuất hiện, nhập rồi lưu.
  const secondItem = host.querySelectorAll(".reader-annotations-item")[1];
  click(secondItem.querySelector(".reader-annotations-note-add"));
  await waitUntil(() => secondItem.querySelector(".reader-annotations-note-input"), "textarea xuất hiện ở trạng thái sửa");
  const textarea = secondItem.querySelector(".reader-annotations-note-input");
  assert.ok(textarea, "Textarea xuất hiện ở trạng thái sửa");
  const valueSetter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    "value",
  ).set;
  valueSetter.call(textarea, "新增的笔记");
  textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(30);
  click(secondItem.querySelector(".reader-annotations-note-save"));
  await waitUntil(() => saveCalls.length === 1, "saveNote được gọi");
  assert.deepEqual(saveCalls, [["fav-2", "新增的笔记"]], "saveNote được gọi");
  const noteTexts = [...host.querySelectorAll(".reader-annotations-note")].map((node) => node.textContent);
  assert.ok(noteTexts.includes("新增的笔记"), "Nhãn ghi chú đã cập nhật");

  // Xuất Markdown: có tiêu đề "# " và block trích dẫn "> ", nút tạm thời đổi
  // thành "Đã sao chép".
  click(host.querySelector(".reader-annotations-export"));
  // Chờ nút thực sự đổi (export bất đồng bộ hoàn tất + render lại), không đoán
  // số mili giây cố định.
  await waitUntil(() => host.querySelector(".reader-annotations-export")?.textContent === "Đã sao chép", "Nút chuyển thành đã sao chép");
  assert.equal(exportCalls.length, 1, "exportMarkdown được gọi một lần");
  assert.ok(exportCalls[0].includes("# "), "Markdown có tiêu đề");
  assert.ok(exportCalls[0].includes("> "), "Markdown có block trích dẫn");
  assert.equal(host.querySelector(".reader-annotations-export")?.textContent, "Đã sao chép");

  // Xóa: loại bỏ lạc quan và gọi deleteAnnotation.
  click(host.querySelector(".reader-annotations-item .reader-annotations-remove"));
  await waitUntil(() => host.querySelectorAll(".reader-annotations-item").length === 2, "Thẻ được loại bỏ lạc quan");
  assert.equal(host.querySelectorAll(".reader-annotations-item").length, 2, "Thẻ được loại bỏ lạc quan");
  assert.deepEqual(deleteCalls, ["fav-1"], "deleteAnnotation được gọi");

  // Định vị: truyền kết quả annotationAnchor.
  click(host.querySelector(".reader-annotations-item .reader-annotations-locate"));
  await waitUntil(() => jumpCalls.length === 1, "jumpToAnchor được gọi");
  assert.deepEqual(jumpCalls, [{ pageIdx: 0, blockId: "b-2" }]);

  app.unmount();
  host.remove();
});
