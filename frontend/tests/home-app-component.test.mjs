import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử cấp thành phần HomeApp (Phase 3a: app-shell / upload / workflow khung React ba miền).
// Xác minh: các id hợp đồng DOM tồn tại từng cái, chuỗi đặt lại idle vào store, hợp đồng APP_EVENTS mở/đóng hộp thoại workflow (rủi ro thiết kế 5), kênh setText hộp lỗi, ràng buộc phạm vi trang,
// hiển thị vùng trạng thái → đồng bộ chế độ hộp thoại, giao diện callback 3b được cố định.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (giới thiệu giai đoạn B) cần cancelAnimationFrame trong jsdom
// (dọn dẹp bộ đếm thời gian hoạt ảnh mount của TabsContent) và getComputedStyle (đọc Presence
// animation-name xác định hoạt ảnh thoát đã kết thúc) — window của jsdom có triển khai, chỉ là không
// được sao chép vào global trần như requestAnimationFrame, bổ sung ở đây.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

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
  assert.fail(`Chờ quá thời gian:${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  // Logic kích hoạt Trigger của Radix Tabs nằm trên onMouseDown (không phải onClick) —
  // LibraryTopTabs (cải tạo phân loại) là Radix Tabs đầu tiên trong tệp này, thêm mousedown để
  // mô phỏng nhấp gần với tương tác thực (giống như trong status-detail-dialog-component.test.mjs
  // có sẵn), không ảnh hưởng đến phần tử <button> thuần.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

// Đầu vào điều khiển: bỏ qua theo dõi value của React, dùng setter gốc ghi rồi bong bóng input
function typeInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function createServices() {
  return createHomeComposition({
    fetchGlossaries: async () => ({
      items: [{ glossary_id: "g-1", name: "bảng thuật ngữ A", entry_count: 3 }],
    }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
}

test("HomeApp: hợp đồng id, chuỗi idle, hợp đồng sự kiện hộp thoại workflow và tương tác", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const events = { open: 0, close: 0 };
  dom.window.document.addEventListener(APP_EVENTS.openTranslationWorkflow, () => { events.open += 1; });
  dom.window.document.addEventListener(APP_EVENTS.closeTranslationWorkflow, () => { events.close += 1; });

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp render khung đầu tiên");
  // Đăng ký useSyncExternalStore của React 18 nằm trong passive effect; DOM khung đầu
  // giữa lúc submit (waitFor ở trên đã thỏa) và đăng ký thực sự có hiệu lực có một nhịp chênh lệch thời gian — trong jsdom
  // không có act() tự động flush passive effects, ở đây nhường một macro task, đảm bảo
  // đăng ký của các store như dialog/statusArea đã được thiết lập, tránh tương tác đầu tiên bên dưới khi đăng ký chưa có hiệu lực
  // trước khi đăng ký có hiệu lực bị bỏ qua (biểu hiện là chờ mở hộp thoại workflow quá thời gian).
  await wait(0);

  // ---- Hợp đồng DOM: cấp cao + các khối gắn thường trực tồn tại từng cái ----
  // Lưu ý: 'translation-workflow-dialog' và toàn bộ họ job-form bên trong (job-form/
  // ocr_provider/.../status-section/job-status-card), 'app-update-dialog'/
  // 'app-update-status'/'app-update-check-btn', 'page-range-dialog' và bên trong nó
  // các id hợp đồng đều không nằm trong danh sách này — sau giai đoạn C (cải tiến shadcn) TranslationWorkflowDialog/
  // SettingsHubDialog/AppUpdateBanner/PageRangeDialog chuyển sang Radix Dialog, không
  // forceMount Content, các id này nằm dưới cây con Content của chúng, chỉ khi hộp thoại tương ứng được
  // mở ra thì mới tồn tại trong DOM (trước đây <dialog> gốc hoặc <div> tùy chỉnh là gắn thường trực,
  // chỉ chuyển trạng thái hiển thị). Sự tồn tại của chúng được chuyển xuống dưới, mở từng hộp thoại rồi mới khẳng định.
  const contractIds = [
    // app-shell
    "app-shell", "developer-btn", "open-output-btn",
    // khung thư viện (giữ chỗ 3b)
    "library-view", "recent-jobs-scroll-body", "recent-jobs-summary", "recent-jobs-empty",
    "library-grid", "recent-jobs-list", "load-more-jobs-btn", "open-query-btn", "library-search-input",
    "library-add-pdf-btn", "app-settings-btn",
  ];
  for (const id of contractIds) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }

  // ---- ba id hợp đồng app-update-*: 'app-update-btn' nằm trong SettingsHubDialog
  //      dưới Content (forceMount của TabsPrimitive.Content làm cho bảng tab 'Cập nhật' dù
  //      không hoạt động vẫn gắn thường trực, chỉ là hidden), mở hộp thoại cài đặt thì tồn tại;
  //      'app-update-dialog'/'app-update-status'/'app-update-check-btn' thì
  //      nội dung dialog chi tiết của AppUpdateBanner (sau giai đoạn C thay máu không
  //      forceMount), cần nhấn nút 'Kiểm tra cập nhật' một lần mới gắn. ----
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-update-btn"), "Sau khi mở hộp thoại cài đặt, app-update-btn được gắn");
  click(byId("app-update-btn"));
  await waitFor(() => byId("app-update-dialog"), "Sau khi nhấn kiểm tra cập nhật, app-update-dialog được gắn");
  for (const id of ["app-update-status", "app-update-check-btn"]) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }
  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-update-dialog") === null, "Đóng hộp thoại cài đặt");

  // ---- Mở: nút Thêm → dispatch openTranslationWorkflow → mở hộp thoại (lần đầu
  //      mở, đồng thời gắn các id hợp đồng họ job-form + job-status-card) ----
  assert.equal(byId("translation-workflow-dialog"), null, "Không gắn khi chưa mở");
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Mở hộp thoại workflow");
  let dialog = byId("translation-workflow-dialog");
  assert.equal(events.open, 1, "Mở phải qua APP_EVENTS.openTranslationWorkflow (phụ thuộc treo 3b)");
  assert.equal(dialog.dataset.open, "1");
  assert.equal(dialog.classList.contains("is-upload-mode"), true);
  assert.equal(byId("translation-workflow-title").textContent, "Thêm PDF");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), true);
  await waitFor(() => byId("library-add-pdf-btn").getAttribute("aria-expanded") === "true", "Kích hoạt đồng b�� aria của nút");
  assert.equal(byId("library-add-pdf-btn").dataset.workflowOpen, "1");

  // ---- job-form 家族 + status 区占位契约 id(挂在工作流对话框内部,只有打开
  //      过才存在于 DOM) ----
  const workflowContractIds = [
    "translation-workflow-close-btn", "job-warning",
    "job-form", "ocr_provider", "paddle_token", "api_key",
    "file", "upload-fill", "credential-gate", "credential-gate-title", "credential-gate-help", "credential-gate-action",
    "upload-glyph", "file-label", "upload-help", "upload-status", "upload-progress-panel", "upload-progress-text",
    "inline-page-range", "page-range-start", "page-range-end", "translation-budget-note",
    "upload-action-slot", "page-range-btn", "submit-btn", "error-box-inline",
    "status-section", "job-status-card",
  ];
  for (const id of workflowContractIds) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }

  // ---- 专业翻译对话框(PageRangeDialog,阶段 C 收官批换 Radix,不
  //      forceMount,只有点开过才挂载于 DOM):点击 #page-range-btn 打开,
  //      契约 id 逐一存在,关闭按钮点击后卸载。背板点击/Esc 的纯关闭语义
  //      统一(顺手修的真实 bug:原来背板点击会触发 applyPageRanges(),Esc
  //      走另一条只清 flag 的路径,两者不一致)靠 fresh Playwright 实测验证——
  //      jsdom 下 Radix DismissableLayer 的 outside-pointerdown 检测不可靠,
  //      同其余已迁移对话框的既有测试先例(credentials-dialog-component.test.mjs
  //      等同样只在这里测挂载/关闭按钮,不测背板/Esc)。 ----
  assert.equal(byId("page-range-dialog"), null, "Không gắn khi chưa mở");
  click(byId("page-range-btn"));
  await waitFor(() => byId("page-range-dialog") !== null, "Mở hộp thoại dịch nâng cao");
  for (const id of [
    "page-range-title", "page-range-limit-text", "job-glossary-id",
    "page-range-close-btn", "page-range-clear-btn", "page-range-apply-btn",
  ]) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }
  click(byId("page-range-close-btn"));
  await waitFor(() => byId("page-range-dialog") === null, "Gỡ hộp thoại sau khi nhấn nút đóng");

  // ---- idle 复位链:上传瓦片回到默认态,提交按钮置灰 ----
  assert.equal(byId("file-label").textContent, "Nhấp chọn tệp hoặc kéo vào đây");
  assert.equal(byId("upload-help").textContent, "Chọn PDF, có thể dịch trực tiếp hoặc chỉ lưu vào kệ sách.");
  assert.equal(byId("submit-btn").disabled, true);
  assert.equal(byId("submit-btn").textContent, "Dịch trực tiếp");
  assert.equal(byId("job-warning").classList.contains("hidden"), true);
  assert.equal(byId("status-section").classList.contains("hidden"), true);

  // ---- setText("error-box") 通道:inline-error-box 显隐(对话框仍处于打开
  //      状态,元素挂载中) ----
  services.bridge.setText("error-box", "Lỗi kênh tải lên");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === false, "Hiển thị hộp lỗi");
  assert.match(byId("error-box-inline").textContent, /上传通道异常/);
  services.bridge.setText("error-box", "-");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === true, "Ẩn hộp lỗi");

  // ---- Phạm vi trang: hiển thị sau khi trạng thái tải lên sẵn sàng, đầu vào vượt quá giới hạn bị ràng buộc (hộp thoại vẫn mở) ----
  services.ports.uploadStatePort.setUpload({ uploadId: "u-1", uploadedPageCount: 10 });
  services.features.uploadFeature.renderPageRangeSummary();
  await waitFor(() => byId("inline-page-range").classList.contains("hidden") === false, "Hiển thị phạm vi trang");
  typeInput(byId("page-range-start"), "99");
  await waitFor(() => byId("page-range-start").value === "10", "Trang bắt đầu bị giới hạn bởi tổng số trang");

  // ---- 状态区可见性 → 对话框模式同步(statusAreaVisibilityChanged 契约,
  //      对话框全程保持打开,不需要重新点击"添加") ----
  services.bridge.setWorkflowSections({ job_id: "job-1", status: "running" });
  await waitFor(() => byId("status-section").classList.contains("hidden") === false, "Hiển thị vùng trạng thái");
  await waitFor(() => dialog.classList.contains("is-status-mode"), "Hộp thoại chuyển sang chế độ trạng thái");
  assert.equal(byId("translation-workflow-title").textContent, "Tiến độ tác vụ");
  services.bridge.setWorkflowSections(null);
  await waitFor(() => byId("status-section").classList.contains("hidden") === true, "Ẩn vùng trạng thái");
  await waitFor(() => dialog.classList.contains("is-upload-mode"), "Hộp thoại quay lại chế độ tải lên");

  // ---- 状态模式下点 × = 一次点击直接关闭(不再是两段式:不 returnHome、不
  //      弹回上传表单;中止任务由 StatusCard 的"取消任务"按钮负责) ----
  services.bridge.setWorkflowSections({ job_id: "job-2", status: "running" });
  await waitFor(() => dialog.classList.contains("is-status-mode"), "Quay lại chế độ trạng thái");
  let returnHomeCount = 0;
  dom.window.document.addEventListener(APP_EVENTS.returnHome, () => { returnHomeCount += 1; });
  const closesBefore = events.close;
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Chế độ trạng thái nhấn × đóng hộp thoại trực tiếp");
  assert.equal(returnHomeCount, 0, "Đóng ở chế độ trạng thái không nên gọi returnHome nữa (hai bước đã bỏ)");
  assert.equal(events.close, closesBefore + 1, "Đóng ở chế độ trạng thái nên phát một sự kiện closeTranslationWorkflow");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), false);

  // ---- Escape 关闭路径(重新打开→Escape,验证 Escape 也一次到位、且经
  //      closeTranslationWorkflow 事件,3b 库刷新恢复依赖) ----
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Mở lại (chế độ tải lên)");
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Escape đóng hộp thoại");
  assert.equal(events.close, closesBefore + 2, "Escape đóng phải qua APP_EVENTS.closeTranslationWorkflow");

  // ---- 关闭按钮路径(重新打开后走关闭按钮;顺带验证 openUpload 的会话复位) ----
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Mở lại");
  // openUpload 会复位上传会话(uploadId 清空)
  assert.equal(services.ports.uploadStatePort.getSnapshot().uploadId, "");
  dialog = byId("translation-workflow-dialog");
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Nút đóng đóng hộp thoại");
  assert.equal(events.close, closesBefore + 3);

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp: phân cột thư viện/bộ sưu tập/yêu thích + hộp thoại quản lý phân loại", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root-categories";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp render khung đầu tiên");
  await wait(0);

  // ---- 分栏契约:四个 tab 都在,默认落在图书馆 ----
  assert.ok(byId("library-top-tab-library"), "Thiếu id hợp đồng：#library-top-tab-library");
  assert.ok(byId("library-top-tab-categories"), "Thiếu id hợp đồng：#library-top-tab-categories");
  assert.ok(byId("library-top-tab-favorites"), "Thiếu id hợp đồng：#library-top-tab-favorites");
  assert.ok(byId("library-top-tab-ask"), "Thiếu id hợp đồng：#library-top-tab-ask");
  assert.ok(byId("library-view"), "Mặc định nên ở chế độ xem thư viện");
  assert.equal(byId("categories-view"), null, "Mặc định không gắn kết chế độ xem bộ sưu tập");
  assert.equal(byId("favorites-view"), null, "Mặc định không gắn kết chế độ xem yêu thích");
  assert.equal(byId("home-ask-view"), null, "Mặc định không gắn kết chế độ xem hỏi đáp AI");
  assert.ok(byId("library-search-input"), "Hộp tìm kiếm nên hiển thị trong tab thư viện");

  // ---- 切到合集:图书馆网格卸载,合集视图挂载,搜索框隐藏 ----
  click(byId("library-top-tab-categories"));
  await waitFor(() => byId("categories-view") !== null, "Gắn kết chế độ xem bộ sưu tập");
  assert.equal(byId("library-view"), null, "Sau khi chuyển sang bộ sưu tập, chế độ xem thư viện nên được gỡ bỏ");
  assert.equal(byId("favorites-view"), null, "Tab bộ sưu tập không gắn chế độ xem yêu thích");
  assert.equal(byId("library-search-input"), null, "Hộp tìm kiếm nên ẩn trong tab bộ sưu tập");
  assert.ok(byId("categories-create-btn"), "Thiếu id hợp đồng：#categories-create-btn");

  // ---- 新建合集对话框:挂载/契约 id/关闭卸载 ----
  assert.equal(byId("collection-manage-dialog"), null, "Không gắn khi chưa mở");
  click(byId("categories-create-btn"));
  await waitFor(() => byId("collection-manage-dialog") !== null, "Mở hộp thoại quản lý bộ sưu tập");
  for (const id of ["collection-name-input", "collection-manage-close-btn", "collection-save-btn"]) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }
  assert.equal(byId("collection-delete-btn"), null, "Chế độ mới không nên có nút xóa");
  click(byId("collection-manage-close-btn"));
  await waitFor(() => byId("collection-manage-dialog") === null, "Gỡ hộp thoại sau khi nhấn nút đóng");

  // ---- 切到收藏:合集卸载,收藏视图挂载,搜索框仍隐藏 ----
  click(byId("library-top-tab-favorites"));
  await waitFor(() => byId("favorites-view") !== null, "Gắn chế độ xem yêu thích");
  assert.equal(byId("categories-view"), null, "Sau khi chuyển sang yêu thích, chế độ xem bộ sưu tập nên được gỡ bỏ");
  assert.equal(byId("library-view"), null, "Tab yêu thích nên gỡ chế độ xem thư viện");
  assert.equal(byId("library-search-input"), null, "Hộp tìm kiếm nên ẩn trong tab yêu thích");
  // 加载中 / 空态 / 列表 / 错误 四者之一
  await waitFor(
    () => byId("favorites-loading") || byId("favorites-empty") || byId("favorites-list") || byId("favorites-error"),
    "Chế độ xem yêu thích nên ở một trong các trạng thái loading/trống/danh sách/lỗi",
  );

  // ---- 切到 AI 问答:收藏卸载,AI 视图挂载 ----
  click(byId("library-top-tab-ask"));
  await waitFor(() => byId("home-ask-view") !== null, "Gắn chế độ xem hỏi đáp AI");
  assert.equal(byId("favorites-view"), null, "Tab AI nên gỡ chế độ xem yêu thích");
  assert.equal(byId("library-view"), null, "Tab AI nên gỡ chế độ xem thư viện");
  assert.equal(byId("library-search-input"), null, "Hộp tìm kiếm nên ẩn trong tab AI");

  // ---- 切回图书馆:收藏/AI 卸载,图书馆网格与搜索框恢复 ----
  click(byId("library-top-tab-library"));
  await waitFor(() => byId("library-view") !== null, "Quay lại thư viện");
  assert.equal(byId("categories-view"), null, "Sau khi quay lại thư viện, chế độ xem bộ sưu tập nên được gỡ bỏ");
  assert.equal(byId("favorites-view"), null, "Sau khi quay lại thư viện, chế độ xem yêu thích nên được gỡ bỏ");
  assert.equal(byId("home-ask-view"), null, "Sau khi quay lại thư viện, chế độ xem AI nên được gỡ bỏ");
  assert.ok(byId("library-search-input"), "Sau khi quay lại thư viện, hộp tìm kiếm nên được khôi phục");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp: chuyển nhanh mục tiêu chỉnh sửa trong hộp thoại quản lý phân loại không bị phản hồi muộn ghi đè (hồi quy)", async () => {
  // 回归覆盖:CollectionManageDialog 的 open-effect 曾经没有 cancelled 守卫——
  // 快速为 A 打开对话框、关闭、再为 B 打开,如果 A 的网络请求比 B 的晚
  // resolve(真实网络下完全可能发生的乱序),会把正在显示 B 的表单勾选状态
  // 覆盖回 A 的旧数据。用可控 resolve 顺序的假 controller 复现这个乱序。
  const host = dom.window.document.createElement("div");
  host.id = "home-root-race";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const memberResolvers = {};
  function deferredMemberIds(collectionId) {
    return new Promise((resolve) => {
      memberResolvers[collectionId] = resolve;
    });
  }
  services.collections.controller.listAllDocuments = () => Promise.resolve([
    { document_id: "doc-1", title: "Doc One" },
  ]);
  services.collections.controller.listCollectionDocumentIds = (collectionId) => deferredMemberIds(collectionId);

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp render khung đầu tiên");
  await wait(0);

  const dialogStore = services.collections.dialogStore;

  dialogStore.open({ collection_id: "col-a", name: "A" });
  await waitFor(() => byId("collection-manage-dialog") !== null, "Mở A");
  await wait(0);

  dialogStore.close();
  await wait(0);
  dialogStore.open({ collection_id: "col-b", name: "B" });
  await waitFor(() => byId("collection-name-input")?.value === "B", "Chuyển sang B");
  await wait(0);

  // 乱序 resolve:B(doc-1 不属于 B)先到,A(doc-1 属于 A)后到。
  memberResolvers["col-b"]([]);
  await wait(10);
  const checkboxAfterB = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
  assert.equal(checkboxAfterB.checked, false, "Trạng thái chọn sách của B nên là chưa chọn (doc-1 không thuộc B)");

  memberResolvers["col-a"](["doc-1"]);
  await wait(10);
  const checkboxAfterLateA = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
  assert.equal(checkboxAfterLateA.checked, false, "Phản hồi muộn của A không nên ghi đè trạng thái chọn của B trở lại chọn");
  assert.equal(byId("collection-name-input").value, "B", "Tiêu đề biểu mẫu vẫn nên là B, không bị phản hồi muộn của A kéo theo");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp：3b 回调桥接口定型(蓝图 §4)", () => {
  const services = createServices();
  // mountJobRuntimeFeature / status-detail / credentials 接线所需的回调名
  const bridgeContract = [
    "setText",
    "setWorkflowSections",
    "setLinearProgress",
    "updateActionButtons",
    "renderPageRangeSummary",
    "resetUploadProgress",
    "resetUploadedFile",
    "applyWorkflowMode",
    "updateJobWarning",
    "resetEventsList",
    "activateDetailTab",
    "setSubmitBusy",
    "submitForm",
  ];
  for (const name of bridgeContract) {
    assert.equal(typeof services.bridge[name], "function", `bridge.${name} 缺失`);
  }
  // 3b workflow-open-port 注入口
  assert.equal(typeof services.workflowDialog.isOpen, "function");
  assert.equal(services.workflowDialog.isOpen(), false);
  services.dispose();
});
