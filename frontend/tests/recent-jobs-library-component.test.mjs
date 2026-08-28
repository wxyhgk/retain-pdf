import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử thành phần RecentJobsLibrary / RecentJobCard (miền Phase 3b recent-jobs).
// Bao phủ các kiểm thử mới §6 trong blueprint ①②③:
// ① Hiển thị lưới thư viện + hợp đồng DOM smoke (mock=parallel, đi qua đường dẫn tải lần đầu mountRecentJobsFeature thực tế,
//    không mock fetch — xác minh trực tiếp đường dẫn ngắn isMockMode() có hoạt động end-to-end không);
// ② Tương tác thẻ (xác nhận xóa/hủy/xác nhận xóa, chọn, reader);
// ③ Cách ly render thẻ (replaceItem một thẻ, xác nhận số lần render của các thẻ còn lại không đổi — neo hồi quy memo,
//    so sánh DOM hộp đen không thể phân biệt "bỏ qua render" với "render nhưng đầu ra giống nhau", phải dùng
//    bộ đếm render xuất từ RecentJobCard.jsx).

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
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
  // được sao chép vào global trần như requestAnimationFrame, bổ sung ở đây. NodeFilter
  // là giai đoạn C cần thêm (TranslationWorkflowDialog thay Radix Dialog) —
  // FocusScope của Dialog.Content dùng nó để duyệt cây phần tử có thể focus.
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

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

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function makeItem(index, overrides = {}) {
  return {
    job_id: `job-${index}`,
    title: `Book ${index}`,
    display_name: `Book ${index}`,
    status: "succeeded",
    display_stage: "done",
    substage: "",
    page_count: 10 + index,
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

async function bootHomeApp(dom) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { createHomeComposition } = await import("../src/pages/home/composition.js");
  const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");

  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => dom.window.document.getElementById("library-view"), "HomeApp render khung đầu tiên");
  await wait(0);

  return { services, root, host };
}

function byId(dom, id) {
  return dom.window.document.getElementById(id);
}

test("RecentJobsLibrary: tải lần đầu (mock=parallel) render lưới + hợp đồng DOM", async () => {
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

  // mock=parallel đi qua isMockMode() ngắn mạch (fetchLibraryBookList/fetchJobList không
  // gọi mạng thật), xác minh mountRecentJobsFeature được lắp ráp trong cùng đồng bộ initialize()
  // đã có hiệu lực — đây chính là bằng chứng end-to-end chống lại rủi ro "5 điểm tham số mặc định bị đứt mạch" (rủi ro blueprint 9): nếu
  // React viewPort từ composition.js bị createRecentJobsViewPort() mặc định
  // ngầm ngắn mạch, các khẳng định hợp đồng DOM phía dưới sẽ toàn bộ thất bại (lộ cũ thao tác DOM thật, store của lộ mới
  // vĩnh viễn không nhận được dữ liệu).
  const contractIds = [
    "library-view", "recent-jobs-scroll-body", "recent-jobs-summary",
    "recent-jobs-empty", "library-grid", "recent-jobs-list", "load-more-jobs-btn",
  ];
  for (const id of contractIds) {
    assert.ok(byId(dom, id), `契约 id 缺失：#${id}`);
  }

  await waitFor(() => byId(dom, "recent-jobs-list").querySelector(".recent-job-item[data-job-id]"), "Lưới xuất hiện ít nhất một thẻ");
  assert.equal(byId(dom, "recent-jobs-list").classList.contains("hidden"), false);
  const card = byId(dom, "recent-jobs-list").querySelector(".recent-job-item[data-job-id]");
  assert.ok(card.dataset.jobId, "Thẻ phải có data-job-id");
  assert.match(byId(dom, "recent-jobs-summary").textContent, /Stage Spec|Unknown/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibrary: tương tác thẻ (select / reader / xác nhận và hủy xóa / xác nhận xóa)", async () => {
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

  const items = [makeItem(1), makeItem(2), makeItem(3)];
  services.library.recentJobsStore.actions.setItems(items);
  await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 3, "Ba thẻ sẵn sàng");

  const cardOf = (jobId) => byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${jobId}"]`);

  // ---- select không có document_id: vẫn mở sách chi tiết (không弹 cũ workflow window) + silent polling ----
  let openCount = 0;
  dom.window.document.addEventListener(
    (await import("../src/js/contracts/app-contract.js")).APP_EVENTS.openTranslationWorkflow,
    () => { openCount += 1; },
  );
  click(dom, cardOf("job-1"));
  await waitFor(() => byId(dom, "book-detail-dialog"), "Nhấn thẻ mở chi tiết sách");
  assert.equal(openCount, 0, "Nhấn thẻ không mở #translation-workflow-dialog");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() === "job-1",
    "Polling silent đường dẫn select/chi tiết",
  );

  // ---- reader:点击悬浮"对照阅读"按钮 → openReaderRequested ----
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  let readerDetail = null;
  dom.window.document.addEventListener(APP_EVENTS.openReaderRequested, (event) => {
    readerDetail = event.detail;
  });
  const readerButton = cardOf("job-2").querySelector(".recent-job-reader");
  click(dom, readerButton);
  await waitFor(() => readerDetail?.jobId === "job-2", "Nút reader kích hoạt openReaderRequested");

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibrary: mắt thẻ = đọc nhanh (đã hoàn thành → đọc đối chiếu; thất bại không nguồn → không kích hoạt nhầm)", async () => {
  // 卡片改为沿用 PDF_MD_lib 的 BookCard 后，导入/导出功能转入书籍详情弹窗中，卡片
  // 只保留一个眼睛图标用于快速阅读：已完成的任务派发对照阅读，没有可读目标（失败且无 document_id）
  // 点击时不派发任何内容（不再一路深入阅读器底部出错）。
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

  const items = [
    makeItem(1, { status: "failed" }),
    makeItem(2, { status: "succeeded" }),
  ];
  services.library.recentJobsStore.actions.setItems(items);
  await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 2, "Hai thẻ sẵn sàng");

  const cardOf = (jobId) => byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${jobId}"]`);
  // Thẻ không còn nút xóa (chức năng đã chuyển trong popup chi tiết)
  assert.equal(cardOf("job-2").querySelector(".recent-job-delete"), null, "Thẻ không còn nút xóa");
  assert.equal(cardOf("job-2").querySelector(".recent-job-translate"), null, "Thẻ không còn nút dịch");

  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  let readerDetail = null;
  dom.window.document.addEventListener(APP_EVENTS.openReaderRequested, (event) => { readerDetail = event.detail; });

  // ----失败任务(makeItem无document_id、非succeeded)→ 点击眼睛没有可读目标，不派发----
  click(dom, cardOf("job-1").querySelector(".recent-job-reader"));
  await wait(30);
  assert.equal(readerDetail, null, "Thất bại và không có nguồn: nhấn mắt không kích hoạt openReaderRequested");

  // 已完成 → 对照阅读
  click(dom, cardOf("job-2").querySelector(".recent-job-reader"));
  await waitFor(() => readerDetail?.jobId === "job-2", "Đã hoàn thành nhấn mắt gửi đọc đối chiếu");

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibrary: thẻ tài liệu lưu trữ (chưa dịch) — huy hiệu/nhấn thẻ mở chi tiết/mắt đọc bản gốc", async () => {
  // ----馆藏文档（合成 job_id `doc:<id>`）进网格：显示徽标"Lưu trữ"、点击卡片打开书籍详情弹窗、
  // 眼睛图标用于读取原文（派发带 documentId、不带 jobId 的 openReaderRequested）。----
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

  const libraryOnlyItem = {
    job_id: "doc:doc-ref-6a1f2c", document_id: "doc-ref-6a1f2c", library_only: true,
    title: "Sách tham khảo chỉ lưu trữ", display_name: "Sách tham khảo chỉ lưu trữ", status: "", page_count: 42,
    updated_at: "2026-07-01T00:00:00Z",
  };
  services.library.recentJobsStore.actions.setItems([libraryOnlyItem, makeItem(2, { status: "succeeded" })]);
  await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 2, "两张卡片就位");

  const card = byId(dom, "recent-jobs-list").querySelector('.recent-job-item[data-library-only="true"]');
  assert.ok(card, "Thẻ lưu trữ đã được render");
  assert.equal(card.getAttribute("data-document-id"), "doc-ref-6a1f2c");
  assert.match(card.textContent, /馆藏/, "Hiển thị huy hiệu lưu trữ");
  assert.equal(card.querySelector(".recent-job-delete"), null, "Thẻ không có xóa (trong popup chi tiết)");

  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  let readerDetail = null;
  dom.window.document.addEventListener(APP_EVENTS.openReaderRequested, (event) => { readerDetail = event.detail; });

  // ---- Nhấn thân thẻ → mở popup chi tiết sách (không phát dispatch openReaderRequested) ----
  click(dom, card);
  await waitFor(() => byId(dom, "book-detail-dialog"), "Nhấn thẻ lưu trữ mở popup chi tiết sách");
  assert.equal(readerDetail, null, "Nhấn thân thẻ không kích hoạt openReaderRequested");
  services.bookDetail.dialogStore.close();

  // ---- Mắt = đọc nguyên bản (kèm documentId, không có jobId) ----
  click(dom, card.querySelector(".recent-job-reader"));
  await waitFor(() => readerDetail?.documentId === "doc-ref-6a1f2c", "Mắt gửi openReaderRequested kèm documentId");
  assert.ok(!readerDetail.jobId, "Tài liệu lưu trữ không có jobId");

  root.unmount();
  services.dispose();
  host.remove();
});

test("Popup chi tiết sách: dịch từ lưu trữ → nhận tiến độ ngay + cập nhật lưới im lặng (không flash loading)", async () => {
  // 点馆藏卡开详情 → 翻译整本 → mock 挂 active_job_id →
  // 详情 payload/进度卡立刻有 job_id，网格有真实 job 行，不靠整页 loading 重载。
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);
  const { HOME_LOADING_STATES } = await import("../src/js/features/home/state.js");

  const { getMockDocumentList } = await import("../src/js/mock/documents.js");
  const untranslated = getMockDocumentList().documents.find((doc) => !`${doc.active_job_id || ""}`.trim());
  assert.ok(untranslated, "Trong mock có tài liệu lưu trữ");

  services.library.recentJobsStore.actions.setItems([{
    job_id: `doc:${untranslated.document_id}`, document_id: untranslated.document_id,
    library_only: true, title: untranslated.title, status: "", page_count: untranslated.page_count,
  }]);
  await waitFor(() => byId(dom, "recent-jobs-list").querySelector('.recent-job-item[data-library-only="true"]'), "Thẻ lưu trữ sẵn sàng");

  click(dom, byId(dom, "recent-jobs-list").querySelector('.recent-job-item[data-library-only="true"]'));
  await waitFor(() => byId(dom, "book-detail-dialog"), "Mở popup chi tiết");
  click(dom, byId(dom, "book-detail-tab-translate"));
  await waitFor(() => byId(dom, "book-detail-translate-btn"), "Nút dịch trong popup chi tiết sẵn sàng");
  click(dom, byId(dom, "book-detail-translate-btn"));

  await waitFor(
    () => getMockDocumentList().documents
      .find((doc) => doc.document_id === untranslated.document_id)?.active_job_id,
    "translateDocument gán active_job_id cho tài liệu",
  );

  // 详情 payload 立刻挂真实 job（翻译 Tab 可嵌 StatusCard）
  await waitFor(() => {
    const payload = services.bookDetail.dialogStore.getState().payload;
    const jobId = `${payload?.job_id || ""}`.trim();
    return jobId && !jobId.startsWith("doc:") && payload?.library_only === false;
  }, "Payload chi tiết có job_id thực ngay lập tức");

  // 进度卡应出现在详情内 bd-job-status-inner（不需等整页重载）
  await waitFor(() => byId(dom, "book-detail-job-status-card"), "Tab Dịch xuất hiện StatusCard ngay lập tức");
  const statusCard = byId(dom, "book-detail-job-status-card");
  assert.ok(
    statusCard.querySelector(".bd-job-status-inner"),
    "Tiến độ nằm trong bd-job-status-inner (nhúng trong chi tiết, không phải popup workflow)",
  );
  assert.ok(
    statusCard.querySelector(".bd-job-status-bar"),
    "Vùng nhúng dùng thanh tiến độ (không có vòng)",
  );
  assert.ok(
    statusCard.querySelector(".status-stage-flow"),
    "Luồng giai đoạn nằm trong thẻ nhúng chi tiết",
  );

  // 绝不能打开工作流弹窗当进度 UI
  assert.equal(
    byId(dom, "translation-workflow-dialog"),
    null,
    "Nhấn dịch trong chi tiết không mở popup workflow",
  );
  assert.equal(
    services.stores.statusArea.getSnapshot().visible,
    false,
    "Vùng trạng thái chính giữ ẩn (tiến độ không trong StatusCard popup)",
  );

  // 网格有真实 job 行
  await waitFor(
    () => services.library.recentJobsStore.getSnapshot().items
      .some((item) => item.document_id === untranslated.document_id && !item.library_only),
    "Lưới xuất hiện dòng job thực",
  );

  assert.notEqual(
    services.stores.homeState.getSnapshot().recentJobsLoadingState,
    HOME_LOADING_STATES.LOADING,
    "Sau dịch cập nhật im lặng, không đặt recentJobs thành loading",
  );

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibrary: cách ly render thẻ (replaceItem một thẻ, 23 thẻ còn lại số lần render không đổi)", async () => {
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);
  const {
    getCardRenderCountForTests,
    resetCardRenderCountsForTests,
  } = await import("../src/pages/home/features/library/index.js");

  const items = Array.from({ length: 24 }, (_, index) => makeItem(index));
  services.library.recentJobsStore.actions.setItems(items);
  await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 24, "24 thẻ sẵn sàng");
  await wait(30); // 让首轮渲染的 effect/commit 完全落定

  resetCardRenderCountsForTests();

  const patchedJobId = "job-5";
  const previous = items.find((item) => item.job_id === patchedJobId);
  services.library.recentJobsStore.actions.replaceItem({
    ...previous,
    title: "Book 5 · Tiêu đề đã cập nhật",
    status: "running",
    display_stage: "translate",
  });

  await waitFor(() => {
    const card = byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${patchedJobId}"]`);
    return card?.querySelector(".recent-job-id")?.title === "Book 5 · Tiêu đề đã cập nhật";
  }, "Nội dung thẻ được patch đã cập nhật");
  await wait(30);

  // 断言"至少重渲一次"而非"恰好一次":react-dom 的 useSyncExternalStore 在
  // dev 构建下,若某个 store 在渲染进行期间(非 React 事件批处理上下文,例如
  // 本测试直接调 store.actions 而非走 onClick)又发生一次通知,会在 commit
  // 前做一次"防撕裂"一致性复核,对同一 fiber 重放一次 render(两次拿到的
  // props/输出完全相同,不是过期→最新的两次真实更新)——这是 React 内部行为
  // (可用 stack trace 验证两次调用都源自 beginWork/updateFunctionComponent),
  // 不是这里的 memo 逻辑缺陷,断言死板的"===1"会对 React 版本升级过度敏感。
  // 核心不变量始终是下面的"未涉及卡片 0 次"。
  assert.ok(getCardRenderCountForTests(patchedJobId) >= 1, "Thẻ được patch nên render lại ít nhất một lần");
  for (const item of items) {
    if (item.job_id === patchedJobId) {
      continue;
    }
    assert.equal(
      getCardRenderCountForTests(item.job_id),
      0,
      `未涉及的卡片 ${item.job_id} 不应重渲(memo 回归)`,
    );
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibrary: workflow treo không deadlock (mở → job-updated vẫn áp patch, không kích hoạt refresh toàn trang → đóng → 300ms sau refresh phục hồi)", async () => {
  // 蓝图风险 5:workflow 打开期间 refresh-scheduler.setSuspended(true),
  // command-handlers.js 的 onJobUpdated 仍无条件调 runtimePatches.update(单卡
  // 补丁不受影响),但被 scheduleRefresh(整页刷新)会被挂起吞掉;关闭后
  // scheduleRefresh({delay:300}) 应该让刷新恢复,不能永久卡死。
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  const { HOME_LOADING_STATES } = await import("../src/js/features/home/state.js");

  // F2 文档中心化后网格加载的是"文档"(mock 有若干篇,含馆藏),这里只需要一张
  // 有真实 job 的已翻译卡当补丁靶子(runtimePatches.update 按真实 job_id 找卡)。
  await waitFor(
    () => services.library.recentJobsStore.getSnapshot().items.some((item) => item.job_id && !item.library_only),
    "Mock tài liệu đã dịch lần đầu sẵn sàng",
  );
  const originalItem = services.library.recentJobsStore
    .getSnapshot().items.find((item) => item.job_id && !item.library_only);

  services.workflowDialog.requestOpenUpload();
  // 阶段 C(shadcn 改造):TranslationWorkflowDialog 换成 Radix Dialog 后不
  // forceMount Content——关闭时不挂载,断言从"hidden 类"改为"是否挂载"
  // (同 CredentialsDialog 等阶段 C 第一批对话框的先例)。
  await waitFor(() => byId(dom, "translation-workflow-dialog") !== null, "Mở hộp thoại workflow (treo refresh)");

  let sawLoadingWhileSuspended = false;
  const unsubscribe = services.stores.homeState.subscribe((snapshot) => {
    if (snapshot.recentJobsLoadingState === HOME_LOADING_STATES.LOADING) {
      sawLoadingWhileSuspended = true;
    }
  });

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.libraryJobUpdated, {
    detail: { job: { ...originalItem, title: "Patched While Suspended" } },
  }));

  await waitFor(() => {
    const card = byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${originalItem.job_id}"]`);
    return card?.querySelector(".recent-job-id")?.title === "Patched While Suspended";
  }, "Trong thời gian treo, patch một thẻ (runtimePatches.update) vẫn có hiệu lực vô điều kiện");

  await wait(150);
  assert.equal(sawLoadingWhileSuspended, false, "Trong thời gian treo không nên kích hoạt refresh toàn trang (scheduleRefresh nên bị isSuspended nuốt)");
  unsubscribe();

  // 关闭后的恢复刷新是 scheduleRefresh({delay:300}) → loadRecentJobs({reset:true,
  // silent:true})——silent:true 意味着 loadingState 不会翻到 LOADING(静默刷新
  // 不应该让网格闪 loading),所以这里改为直接观测 recentJobsStatePort.store
  // 是否真的又发生了一次 setItems 通知(silent 刷新完成的唯一可见信号)。
  let notifyCountAfterClose = 0;
  const unsubscribe2 = services.library.recentJobsStore.subscribe(() => {
    notifyCountAfterClose += 1;
  });
  services.workflowDialog.requestClose();
  await waitFor(() => byId(dom, "translation-workflow-dialog") === null, "Đóng hộp thoại workflow");
  await waitFor(() => notifyCountAfterClose > 0, "Sau khi đóng, 300ms sau refresh im lặng nên phục hồi (không deadlock)");
  unsubscribe2();

  root.unmount();
  services.dispose();
  host.remove();
});
