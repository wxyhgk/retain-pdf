import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử thành phần GlossariesDialog (nhóm hộp thoại Phase 3, Blueprint §3).
// Kiểm tra: id hợp đồng, tải danh sách/chọn/tạo bản nháp mới, dự phòng tên khi lưu và
// xác thực "dịch cố định/ưu tiên thiếu bản dịch", phân tích nhập CSV, xuất CSV, xác nhận
// gọi lại refreshWorkflowGlossaries (miền workflow mock), sự kiện APP_EVENTS.refreshGlossaries kích hoạt làm mới.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (Giai đoạn B giới thiệu) trong jsdom cần cancelAnimationFrame
// (TabsContent dọn dẹp bộ đếm thời gian hoạt ảnh khi mount) và getComputedStyle (Presence đọc
// animation-name để xác định hoạt ảnh thoát đã kết thúc chưa) — có trên window của jsdom, chỉ là chưa
// được sao chép lên global trần giống requestAnimationFrame, ở đây bổ sung luôn.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

// HomeApp.jsx render <download-toast></download-toast> làm placeholder (Blueprint §7
// miền artifact-downloads, không trong phạm vi agent này), lớp phần tử tùy chỉnh thực tế
// (src/js/components/feedback/download-toast.js) thuộc thế giới cũ js/components/**,
// architecture-boundaries cấm src/pages/** import — thành phần chưa được
// đăng ký trong thế giới React. Ở đây đăng ký một stub tối thiểu (chỉ 2 phương thức công khai setState/hide,
// khớp với hợp đồng công khai của thực tế), cô lập kiểm thử miền này (CSV xuất), không có nghĩa là đã giải quyết
// khoảng trống kết nối miền artifact-downloads (xem phần phát hiện ở cuối tệp kiểm thử).
if (!dom.window.customElements.get("download-toast")) {
  dom.window.customElements.define("download-toast", class extends dom.window.HTMLElement {
    setState() {}
    hide() {}
  });
}

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../src/pages/home/composition.js");
const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");
const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`Chờ quá thời gian: ${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(element, value) {
  const proto = element.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function selectOption(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function mockGlossaryApi(overrides = {}) {
  const calls = {
    fetchGlossaries: [],
    fetchGlossary: [],
    createGlossary: [],
    updateGlossary: [],
    deleteGlossary: [],
    exportGlossaryCsv: [],
    parseGlossaryCsv: [],
    refreshWorkflowGlossaries: [],
  };
  const state = {
    items: [{ glossary_id: "g-1", name: "Thuật ngữ hóa học lượng tử", entry_count: 2 }],
    detail: {
      glossary_id: "g-1",
      name: "Thuật ngữ hóa học lượng tử",
      entries: [
        { source: "Hartree-Fock", target: "", level: "preserve", match_mode: "case_insensitive", context: "", note: "Giữ tiếng Anh" },
        { source: "density functional theory", target: "Lý thuyết phiếm hàm mật độ", level: "canonical", match_mode: "case_insensitive", context: "", note: "" },
      ],
    },
  };
  const api = {
    fetchGlossaries: async () => {
      calls.fetchGlossaries.push(true);
      return { items: state.items };
    },
    fetchGlossary: async (glossaryId) => {
      calls.fetchGlossary.push(glossaryId);
      return state.detail;
    },
    createGlossary: async (_apiPrefix, payload) => {
      calls.createGlossary.push(payload);
      const glossary_id = "g-new";
      state.items = [...state.items, { glossary_id, name: payload.name, entry_count: payload.entries.length }];
      return { glossary_id, ...payload };
    },
    updateGlossary: async (_apiPrefix, glossaryId, payload) => {
      calls.updateGlossary.push({ glossaryId, payload });
      return { glossary_id: glossaryId, ...payload };
    },
    deleteGlossary: async (_apiPrefix, glossaryId) => {
      calls.deleteGlossary.push(glossaryId);
      state.items = state.items.filter((item) => item.glossary_id !== glossaryId);
      return { glossary_id: glossaryId, deleted: true };
    },
    exportGlossaryCsv: async (_apiPrefix, glossaryId) => {
      calls.exportGlossaryCsv.push(glossaryId);
      return {
        headers: { get: (name) => (name === "content-disposition" ? `attachment; filename="${glossaryId}.csv"` : null) },
        body: undefined,
        blob: async () => ({ size: 42, kind: "csv-blob" }),
      };
    },
    parseGlossaryCsv: async (_apiPrefix, csvText) => {
      calls.parseGlossaryCsv.push(csvText);
      return {
        entry_count: 1,
        entries: [{ source: "parsed-term", target: "解析术语", level: "canonical", match_mode: "case_insensitive", context: "", note: "" }],
      };
    },
    refreshWorkflowGlossaries: async (options) => {
      calls.refreshWorkflowGlossaries.push(options);
    },
    ...overrides,
  };
  return { api, calls, state };
}

function createServices({ glossaryOverrides = {} } = {}) {
  const { api, calls, state } = mockGlossaryApi(glossaryOverrides);
  const services = createHomeComposition({
    fetchGlossaries: api.fetchGlossaries,
    fetchGlossary: api.fetchGlossary,
    createGlossary: api.createGlossary,
    updateGlossary: api.updateGlossary,
    deleteGlossary: api.deleteGlossary,
    exportGlossaryCsv: api.exportGlossaryCsv,
    parseGlossaryCsv: api.parseGlossaryCsv,
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  // refreshWorkflowGlossaries là callback ngược của miền workflow, bên trong composition.js kết nối đến
  // features.workflowFeature.loadGlossaryOptions — ở đây thay thế trực tiếp hàm này, kiểm tra
  // GlossariesDialog sau khi lưu/xóa có thực sự gọi nó (điểm phụ thuộc của ma trận phụ thuộc Blueprint §3/§8).
  services.features.workflowFeature.loadGlossaryOptions = api.refreshWorkflowGlossaries;
  return { services, calls, state };
}

async function mountHome(services) {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);
  services.initialize();
  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "Khung chuyển đầu tiên của HomeApp");
  await wait(0);
  return { host, root };
}

// 3a workflow miền khởi động cũng gọi fetchGlossaries (điền danh sách thả thuật ngữ, composition.js
// dùng chung điểm tiêm) — kiểm tra loại "mở hộp thoại kích hoạt tải danh sách một lần" miền này không thể dùng giá trị tuyệt đối
// 1, phải đợi lần tải ban đầu của workflow ổn định, ghi lại baseline, sau đó kiểm tra dùng giá trị tương đối baseline +1,
// tránh tình trạng đua thời gian giữa hai cuộc gọi dẫn đến kết quả kiểm tra sai fail/pass.
async function settle(services, calls) {
  const { host, root } = await mountHome(services);
  await waitFor(() => calls.fetchGlossaries.length >= 1, "Tải thuật ngữ ban đầu ổn định khi khởi động miền workflow");
  await wait(30);
  return { host, root, glossariesBaseline: calls.fetchGlossaries.length };
}

async function openGlossariesDialog() {
  // Giai đoạn C (cải tạo shadcn): SettingsHubDialog/GlossariesDialog đổi sang Radix Dialog
  // sau đó không forceMount Content, ở trạng thái đóng toàn bộ nội dung không được mount (không còn
  // thuộc tính boolean .open của <dialog> gốc), ở đây đổi sang "có mount hay không" để xác định trạng thái mở.
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "Hộp thoại cài đặt mở");
  click(dom.window.document.querySelector('[data-settings-tab="glossary"]'));
  await wait(0);
  click(byId("glossary-btn"));
  await waitFor(() => byId("glossary-manager-dialog") !== null, "Hộp thoại thuật ngữ mở");
}

test("GlossariesDialog: Hợp đồng id, mở ra làm mới danh sách ngay, trạng thái chọn, điền lại trình soạn thảo (mục preserve bản dịch để trống)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();

  for (const id of [
    "glossary-close-btn", "glossary-new-btn", "glossary-list", "glossary-list-empty",
    "glossary-name", "glossary-add-row-btn", "glossary-import-btn", "glossary-export-btn",
    "glossary-delete-btn", "glossary-entries", "glossary-entries-empty", "glossary-import-panel",
    "glossary-csv-text", "glossary-import-apply-btn", "glossary-import-cancel-btn",
    "glossary-status", "glossary-save-btn",
  ]) {
    assert.ok(byId(id), `Thiếu id hợp đồng: #${id}`);
  }

  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Mở hộp thoại kích hoạt tải danh sách một lần");
  await waitFor(() => byId("glossary-name").value === "Thuật ngữ hóa học lượng tử", "Tự động chọn mục đầu và điền lại trình soạn thảo");
  assert.equal(calls.fetchGlossary.length, 1, "Tự động chọn kích hoạt tải chi tiết một lần");

  const listButtons = byId("glossary-list").querySelectorAll("button");
  assert.equal(listButtons.length, 1);
  assert.equal(listButtons[0].classList.contains("is-active"), true, "Trạng thái tự động chọn mục đầu");

  // ô nhập bản dịch của mục preserve (Hartree-Fock) phải giữ trạng thái "để trống" hiển thị (không phải tự động điền lại
  // source), ngữ nghĩa điền lại chỉ xảy ra ở giai đoạn đọc khi lưu — xem chú thích đầu glossaries-store.js
  // readEditorPayloadFromDraft, sao chép từ src/js/features/glossaries/view.js:165.
  const sourceInputs = byId("glossary-entries").querySelectorAll(".glossary-entry-source");
  const targetInputs = byId("glossary-entries").querySelectorAll(".glossary-entry-target");
  assert.equal(sourceInputs[0].value, "Hartree-Fock");
  assert.equal(targetInputs[0].value, "", "mục preserve bản dịch hiển thị để trống, không điền lại source trước");
  assert.equal(targetInputs[1].value, "Lý thuyết phiếm hàm mật độ");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: Tạo bản nháp mới + preserve lưu lúc dùng source điền lại bản dịch trống (ngữ nghĩa rủi ro 1)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Mở hộp thoại kích hoạt tải danh sách một lần");

  click(byId("glossary-new-btn"));
  await waitFor(() => byId("glossary-name").value === "Bảng thuật ngữ chưa đặt tên", "Tạo bản nháp mới điền lại tên mặc định");

  const sourceInput = byId("glossary-entries").querySelector(".glossary-entry-source");
  assert.ok(sourceInput, "Tạo bản nháp mới tự động thêm một dòng mục trống");
  typeInput(sourceInput, "Hartree-Fock");
  // level mặc định đã là preserve, không cần chuyển select。

  click(byId("glossary-save-btn"));
  await waitFor(() => calls.createGlossary.length === 1, "Lưu kích hoạt createGlossary");
  assert.deepEqual(calls.createGlossary[0].entries, [{
    source: "Hartree-Fock",
    target: "Hartree-Fock",
    level: "preserve",
    match_mode: "case_insensitive",
    context: "",
    note: "",
  }], "khi mục preserve bản dịch để trống, lưu lúc dùng source điền lại (sao chép từ view.js:165)");

  await waitFor(() => calls.refreshWorkflowGlossaries.length === 1, "Sau khi lưu callback làm mới miền workflow");
  assert.equal(calls.refreshWorkflowGlossaries[0].force, true);

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: Mục không phải preserve thiếu bản dịch lúc lưu bị chặn (kiểm tra)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Mở hộp thoại kích hoạt tải danh sách một lần");

  click(byId("glossary-new-btn"));
  await waitFor(() => byId("glossary-name").value === "Bảng thuật ngữ chưa đặt tên", "Tạo bản nháp mới");

  const sourceInput = byId("glossary-entries").querySelector(".glossary-entry-source");
  const levelSelect = byId("glossary-entries").querySelector(".glossary-entry-level");
  typeInput(sourceInput, "density functional theory");
  selectOption(levelSelect, "canonical");
  // Bản dịch (target) giữ để trống。

  click(byId("glossary-save-btn"));
  await waitFor(() => byId("glossary-status").textContent === "Dịch cố định/ưu tiên cần điền bản dịch.", "Hiển thị kiểm tra chặn");
  assert.equal(byId("glossary-status").classList.contains("is-error"), true);
  assert.equal(calls.createGlossary.length, 0, "Kiểm tra không qua không nên gọi giao diện lưu");

  const targetInput = byId("glossary-entries").querySelector(".glossary-entry-target");
  typeInput(targetInput, "Lý thuyết phiếm hàm mật độ");
  click(byId("glossary-save-btn"));
  await waitFor(() => calls.createGlossary.length === 1, "Bổ sung bản dịch sau khi lưu thành công");
  assert.equal(calls.createGlossary[0].entries[0].target, "Lý thuyết phiếm hàm mật độ");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: Phân tích CSV nhập để thay thế mục bản nháp", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Mở hộp thoại kích hoạt tải danh sách một lần");
  await waitFor(() => byId("glossary-name").value === "Thuật ngữ hóa học lượng tử", "Tự động chọn mục đầu");

  click(byId("glossary-import-btn"));
  await waitFor(() => byId("glossary-import-panel").classList.contains("hidden") === false, "Bảng nhập mở");

  typeInput(byId("glossary-csv-text"), "parsed-term,解析术语,canonical,case_insensitive,");
  click(byId("glossary-import-apply-btn"));

  await waitFor(() => calls.parseGlossaryCsv.length === 1, "Kích hoạt phân tích CSV");
  await waitFor(() => byId("glossary-import-panel").classList.contains("hidden") === true, "Bảng nhập thu gọn sau khi phân tích thành công");
  await waitFor(() => byId("glossary-entries").querySelectorAll(".glossary-entry-row").length === 1, "Mục được thay thế bằng kết quả phân tích");
  assert.equal(byId("glossary-entries").querySelector(".glossary-entry-source").value, "parsed-term");
  assert.equal(byId("glossary-csv-text").value, "", "Xóa trống hộp văn bản CSV sau khi phân tích thành công");
  assert.match(byId("glossary-status").textContent, /Đã phân tích 1 mục/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: Gọi exportGlossaryCsv khi CSV xuất và hiển thị thành công", async () => {
  const previousURL = globalThis.URL;
  globalThis.URL = class extends previousURL {
    static createObjectURL() { return "blob:mock-glossary-export"; }
    static revokeObjectURL() {}
  };

  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Mở hộp thoại kích hoạt tải danh sách một lần");
  await waitFor(() => byId("glossary-name").value === "Thuật ngữ hóa học lượng tử", "Tự động chọn mục đầu");

  click(byId("glossary-export-btn"));
  await waitFor(() => calls.exportGlossaryCsv.length === 1, "Kích hoạt yêu cầu xuất");
  assert.equal(calls.exportGlossaryCsv[0], "g-1");
  await waitFor(() => /^已导出 g-1\.csv。$/.test(byId("glossary-status").textContent), "Hiển thị xuất thành công");
  assert.equal(byId("glossary-status").classList.contains("is-valid"), true);

  root.unmount();
  services.dispose();
  host.remove();
  globalThis.URL = previousURL;
});

test("GlossariesDialog: APP_EVENTS.refreshGlossaries kích hoạt tải lại danh sách", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Mở hộp thoại kích hoạt tải danh sách một lần");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.refreshGlossaries));
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 2, "refreshGlossaries sự kiện kích hoạt tải lại");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: Xóa thuật ngữ hiện tại gọi callback làm mới miền workflow", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Mở hộp thoại kích hoạt tải danh sách một lần");
  await waitFor(() => byId("glossary-name").value === "Thuật ngữ hóa học lượng tử", "Tự động chọn mục đầu");

  click(byId("glossary-delete-btn"));
  await waitFor(() => calls.deleteGlossary.length === 1, "Kích hoạt yêu cầu xóa");
  assert.equal(calls.deleteGlossary[0], "g-1");
  await waitFor(() => calls.refreshWorkflowGlossaries.some((options) => options.selectedId === ""), "Xóa sau callback làm mới miền workflow (selectedId xóa trống)");

  root.unmount();
  services.dispose();
  host.remove();
});
