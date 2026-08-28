import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử thành phần artifact-downloads (hộp thoại blueprint §7). Miền này trước đây bị bỏ qua qua nhiều lượt agent —
// 7 id tải xuống trong ResultActions.jsx/StatusDetailDialog.jsx chỉ hiển thị <a href target="_blank"> trần,
// composition.js chưa từng mount mountArtifactDownloadsFeature, dẫn đến nhấp là chuyển hướng trình duyệt thuần (không có X-API-Key,
// backend thường trả 401) chứ không phải tải fetchProtected. Tệp này bao phủ hai kiểm thử chấp nhận mới:
// ① Nhấp vào 7 id mỗi id kích hoạt tải xuống đúng (mock fetchProtected, không phải điều hướng trần);
// ② Văn bản trạng thái busy không bị ghi đè bởi render lại thành phần cha (cơ chế cốt lõi giải pháp 2 §7.5).
//
// Mẫu makeDom/waitFor/bootHomeApp sao chép tiền lệ status-card-component.test.mjs.

function makeDom(search) {
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
  // Radix Presence/Tabs(được đưa vào ở giai đoạn B) trong jsdom cần cancelAnimationFrame
  // (TabsContent dùng để dọn bộ đếm thời gian mount) và getComputedStyle(Presence đọc
  // animation-name để kiểm tra hoạt ảnh thoát đã kết thúc)——jsdom có triển khai, nhưng không
  // được sao chép sang global trần như requestAnimationFrame, bổ sung ở đây. NodeFilter
  // là yêu cầu mới của giai đoạn C(TranslationWorkflowDialog/StatusDetailDialog đổi sang Radix Dialog)
  // để Dialog.Content dùng FocusScope duyệt cây phần tử có thể tập trung.
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
  assert.fail(`Hết thời gian chờ: ${description}`);
}

function click(dom, element) {
  // Radix Tabs đặt logic kích hoạt Trigger trên onMouseDown(chứ không phải onClick)——giai đoạn B
  // sau khi migrate StatusDetailDialog sang Radix Tabs, chỉ dispatch "click" sẽ không kích hoạt tab
  // chuyển. Trình duyệt thực tế vốn có đủ chuỗi mousedown→mouseup→click, nên bổ sung
  // mousedown để mô phỏng click gần thực tế hơn, chứ không nới lỏng bất kỳ assertion nào.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function byId(dom, id) {
  return dom.window.document.getElementById(id);
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
  await waitFor(() => byId(dom, "library-add-pdf-btn"), "HomeApp render khung đầu tiên");
  // Giai đoạn C(cải tiến shadcn): TranslationWorkflowDialog đổi sang Radix Dialog nên không còn
  // forceMount Content——nút tải xuống của job-status-card/ResultActions nằm trong
  // hộp thoại này, chỉ khi hộp thoại mở ra mới mount(cùng tiền lệ với CredentialsDialog đợt 1
  // của giai đoạn C).
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "job-status-card"), "Sau khi mở hộp thoại workflow, job-status-card được mount");
  await wait(0);

  return { services, root, host };
}

// jsdom chưa triển khai URL.createObjectURL/revokeObjectURL(downloads.js#downloadBlob
// dùng để gửi Blob cho trình duyệt lưu)——thay bằng stub có thể ghi lại lời gọi, lấy
  // glossaries-dialog-component.test.mjs kiểm thử 「Xuất CSV」 làm tiền lệ.
function stubObjectUrl() {
  const previousURL = globalThis.URL;
  const calls = [];
  globalThis.URL = class extends previousURL {
    static createObjectURL(blob) {
      calls.push(blob);
      return `blob:mock-${calls.length}`;
    }

    static revokeObjectURL() {}
  };
  return {
    calls,
    restore() {
      globalThis.URL = previousURL;
    },
  };
}

test("artifact-downloads: polling thực tế (mock=done) điều khiển 3 nút tải xuống ResultActions sẵn sàng và có thể nhấp", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "đang chuẩn bị", "Dữ liệu tác vụ thực tế đến");

  const markdownBtn = byId(dom, "status-markdown-bundle-btn");
  const sourcePdfBtn = byId(dom, "source-pdf-btn");
  const pdfBtn = byId(dom, "pdf-btn");

  for (const [label, el] of [["status-markdown-bundle-btn", markdownBtn], ["source-pdf-btn", sourcePdfBtn], ["pdf-btn", pdfBtn]]) {
    assert.ok(el, `${label} phải tồn tại`);
    assert.equal(el.getAttribute("aria-disabled"), "false", `${label} phải ở trạng thái có thể nhấp`);
    assert.match(el.dataset.url || "", /^mock:\/\//, `${label} có data-url trỏ đến tài nguyên được bảo vệ phía sau(không phải rỗng hoặc '#')`);
    assert.equal(el.classList.contains("disabled"), false, `${label} không được có lớp disabled`);
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads: 3 nút tải xuống được bảo vệ của ResultActions kích hoạt flow fetchProtected khi nhấp(không phải điều hướng trần)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
    await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "đang chuẩn bị", "Dữ liệu tác vụ thực tế đến");
    await waitFor(() => byId(dom, "pdf-btn").getAttribute("aria-disabled") === "false", "Nút tải xuống PDF sẵn sàng");

    const startHref = dom.window.location.href;
    const cases = [
      // status-markdown-bundle-btn không có preferSuggestedName, tên file đến từ
      // fileNameFromDisposition fallback `${jobId}-markdown.zip`(mock response thiếu
      // content-disposition header).
      ["status-markdown-bundle-btn", /-markdown\.zip$/],
      // source-pdf-btn/pdf-btn đều dùng preferSuggestedName, tên file đến từ
      // resolveSourcePdfDownloadName/resolveTranslatedPdfDownloadName——chỉ cần kiểm tra
      // hậu tố .pdf, không phụ thuộc mock job có thể suy ra tên gốc hay không.
      ["source-pdf-btn", /\.pdf$/],
      ["pdf-btn", /\.pdf$/],
    ];

    for (const [id, expectedNamePattern] of cases) {
      const before = urlStub.calls.length;
      const link = byId(dom, id);
      assert.equal(link.getAttribute("aria-disabled"), "false", `${id} phải có thể nhấp trước khi click`);
      click(dom, link);
  // Ở thời điểm click, preventDefault phải được gọi đồng bộ, không xảy ra điều hướng trang thực tế(document click delegated
  // ở đầu handleProtectedArtifactClick đã gọi event.preventDefault()).
      assert.equal(dom.window.location.href, startHref, `${id} nhấp không được điều hướng trang`);
      await waitFor(() => urlStub.calls.length > before, `${id} nhấp phải đi qua fetchProtected→saveResponseDownload để kích hoạt một lần downloadBlob`);
      const blob = urlStub.calls[urlStub.calls.length - 1];
      assert.ok(blob.size > 0, `${id} blob tải xuống phải có byte thực tế(chứng minh đi qua mock fetch thật, không phải placeholder rỗng)`);
  // download-toast(DownloadToastHost.jsx) phải phản ánh đúng tên file——chứng minh đi
  // qua đường xử lý thực tế của downloads.js, chứ không phải dữ liệu giả ngẫu nhiên.
      await waitFor(
        () => expectedNamePattern.test(byId(dom, "download-toast-title")?.textContent || ""),
        `${id} sau khi tải xuống xong, tiêu đề toast phải chứa tên file mong đợi`,
      );
      // Sau khi tải xuống xong, trạng thái busy phải được xóa và nút lại có thể nhấp(branch finally của controller.js).
      await waitFor(() => byId(dom, id).getAttribute("aria-disabled") === "false", `${id} sau khi tải xuống xong phải trở lại trạng thái có thể nhấp`);
    }
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads: markdown-bundle-btn trong panel tổng quan StatusDetailDialog cũng tham gia flow tải xuống", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
    await waitFor(() => byId(dom, "status-detail-btn"), "Nút chi tiết thẻ trạng thái sẵn sàng");
    click(dom, byId(dom, "status-detail-btn"));
    // Giai đoạn C(cải tiến shadcn): StatusDetailDialog đổi sang Radix Dialog nên không còn
  // forceMount Content——assertion đổi từ kiểm tra thuộc tính "open" sang kiểm tra "có mount hay không"。
  await waitFor(() => byId(dom, "status-detail-dialog") !== null, "Mở hộp thoại chi tiết");

    await waitFor(() => byId(dom, "markdown-bundle-btn")?.getAttribute("aria-disabled") === "false", "Nút tải xuống bảng tổng quan sẵn sàng (đọc statusCardStore)");
    const link = byId(dom, "markdown-bundle-btn");
    assert.match(link.dataset.url || "", /^mock:\/\/bundle\.zip/);

    const before = urlStub.calls.length;
    click(dom, link);
    await waitFor(() => urlStub.calls.length > before, "Nhấn nút tải xuống bảng tổng quan kích hoạt downloadBlob");
    await waitFor(() => byId(dom, "markdown-bundle-btn").getAttribute("aria-disabled") === "false", "Sau khi tải xuống hoàn tất, khôi phục trạng thái có thể nhấp");
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads: delegated click ở cấp document bao phủ đủ 7 contract id(3 id không có UI consumer hiện tại)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");
  const { DOWNLOAD_ACTION_IDS } = await import("../src/js/contracts/download-action-contract.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
    await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "đang chuẩn bị", "Dữ liệu tác vụ thực tế đến");

    // download-btn/markdown-btn/markdown-raw-btn hiện không có React component nào render
    // (recent-jobs bên thầu định nghĩa là danh sách dead code bên ngoài), nhưng controller.js
    // delegated click ở cấp document chỉ match theo id, không phụ thuộc ai render button——dùng
    // synthetic node để kiểm tra 3 id này cũng được bắt đúng, chứng minh 7 contract id đều hoạt động,
    // không chỉ 4 id đã render.
    const syntheticIds = [
      DOWNLOAD_ACTION_IDS.BUNDLE,
      DOWNLOAD_ACTION_IDS.MARKDOWN_JSON,
      DOWNLOAD_ACTION_IDS.MARKDOWN_RAW,
    ];
    const urlByAction = {
      [DOWNLOAD_ACTION_IDS.BUNDLE]: "mock://bundle.zip",
      [DOWNLOAD_ACTION_IDS.MARKDOWN_JSON]: "mock://markdown.json",
      [DOWNLOAD_ACTION_IDS.MARKDOWN_RAW]: "mock://markdown.raw",
    };
    for (const id of syntheticIds) {
      const link = dom.window.document.createElement("a");
      link.id = id;
      link.href = urlByAction[id];
      link.dataset.url = urlByAction[id];
      dom.window.document.body.appendChild(link);

      const before = urlStub.calls.length;
      click(dom, link);
      await waitFor(() => urlStub.calls.length > before, `Synthetic node #${id} click phải khớp cùng document delegated click handler`);
      link.remove();
    }
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads: nội dung trạng thái busy không bị ghi đè bởi render lại thành phần cha(§7.5 giải pháp 2)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "đang chuẩn bị", "Dữ liệu tác vụ thực tế đến");
  await waitFor(() => byId(dom, "pdf-btn").getAttribute("aria-disabled") === "false", "Nút tải xuống PDF đã sẵn sàng");

  const { DOWNLOAD_ACTION_IDS } = await import("../src/js/contracts/download-action-contract.js");
  const actionId = DOWNLOAD_ACTION_IDS.PDF; // "pdf-btn"

  // Mô phỏng controller.js gọi viewPort.setLinkBusy(link, true, "37%") giữa chừng tải xuống
  // ——không sửa DOM trực tiếp, chỉ ghi busy store。
  services.artifactDownloads.busyStore.setBusy(actionId, true, "37%");
  await waitFor(() => byId(dom, actionId).querySelector("span").textContent === "37%", "Văn bản trạng thái busy có hiệu lực ngay");
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "true", "Đang tải xuống nên được coi là không thể nhấp lại");

  // Tạo một lần render lại thành phần cha không liên quan(StatusCard)——lấy
  // status-card-component.test.mjs「thông báo store không liên quan không nên đặt lại lựa chọn thủ công」làm tiền lệ,
  // ở đây kiểm tra nội dung busy khi tải xuống không bị render lại đánh về nhãn gốc(giải pháp 2 phải chịu được).
  for (let i = 0; i < 5; i += 1) {
    services.statusCard.store.actions.setCancelDisabled(i % 2 === 0);
  }
  await wait(30);
  assert.equal(
    byId(dom, actionId).querySelector("span").textContent,
    "37%",
    "Sau khi component cha (StatusCard) render lại do thay đổi store không liên quan, văn bản trong khi tải xuống nên giữ nguyên (không bị đặt lại thành 'Tải PDF')",
  );
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "true");

  // Kết thúc tải xuống(branch finally của controller.js gọi setLinkBusy(link, false))——nội dung phải
  // khôi phục nhãn gốc và cho phép nhấp lại.
  services.artifactDownloads.busyStore.setBusy(actionId, false);
  await waitFor(() => byId(dom, actionId).querySelector("span").textContent === "Tải PDF", "Sau khi busy kết thúc, văn bản khôi phục");
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "false");

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads: busy text của nút tải xuống trong panel tổng quan StatusDetailDialog cũng không bị render lại đánh bay khi chuyển tab", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => byId(dom, "status-detail-btn"), "Nút chi tiết thẻ trạng thái sẵn sàng");
  click(dom, byId(dom, "status-detail-btn"));
  // Giai đoạn C(cải tiến shadcn): StatusDetailDialog đổi sang Radix Dialog nên không còn
  // forceMount Content——assertion đổi từ kiểm tra thuộc tính "open" sang kiểm tra "đã mount"。
  await waitFor(() => byId(dom, "status-detail-dialog") !== null, "Mở hộp thoại chi tiết");
  await waitFor(() => byId(dom, "markdown-bundle-btn")?.getAttribute("aria-disabled") === "false", "Nút tải xuống bảng tổng quan đã sẵn sàng");

  services.artifactDownloads.busyStore.setBusy("markdown-bundle-btn", true, "đang tải xuống...");
  await waitFor(() => byId(dom, "markdown-bundle-btn").textContent === "đang tải xuống...", "Nội dung busy đã có hiệu lực");

  // Chuyển tab rồi quay lại(overview vẫn mount không unmount, nhưng kích hoạt render lại
  // toàn bộ StatusDetailDialog)——nội dung busy phải giữ nguyên。
  click(dom, byId(dom, "detail-tab-events"));
  await waitFor(() => byId(dom, "detail-panel-events").hidden === false, "Chuyển sang tab sự kiện");
  click(dom, byId(dom, "detail-tab-overview"));
  await waitFor(() => byId(dom, "detail-panel-overview").hidden === false, "Quay lại tab tổng quan");
  assert.equal(byId(dom, "markdown-bundle-btn").textContent, "đang tải xuống...", "Chuyển tab không nên đặt lại văn bản đang tải xuống");

  services.artifactDownloads.busyStore.setBusy("markdown-bundle-btn", false);
  await waitFor(() => byId(dom, "markdown-bundle-btn").textContent === "Tải Markdown ZIP", "Sau khi busy kết thúc, văn bản khôi phục");

  root.unmount();
  services.dispose();
  host.remove();
});
