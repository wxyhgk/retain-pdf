import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử thành phần AppUpdateBanner (nhóm hộp thoại Phase 3, Blueprint §5).
// Kiểm tra: id hợp đồng, hai đường dẫn cache khởi động trúng/không trúng, ba trạng thái kiểm tra thủ công
// loading/thành công/thất bại, xác nhận hiển thị formatReleaseNotes, nút tab "Cập nhật" của SettingsHubDialog
// + hộp thoại chi tiết gắn kết, AppShellHeader không còn template cũ.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (giới thiệu ở Phase B) trong jsdom cần cancelAnimationFrame
// (dọn dẹp bộ đếm thời gian mount của TabsContent) và getComputedStyle (Presence đọc
// animation-name để xác định hoạt ảnh thoát đã kết thúc chưa) — window của jsdom có triển khai, nhưng không
// được sao chép sang global trần như requestAnimationFrame, bổ sung ở đây.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../src/pages/home/composition.js");
const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function memoryCachePort(initial = { info: null, fresh: false }) {
  let value = initial;
  return {
    read: () => value,
    write: (info) => { value = { info, fresh: true }; },
  };
}

async function mountHome(services) {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);
  services.initialize();
  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp render khung đầu tiên");
  await wait(0);
  return { host, root };
}

// Phase C (cải tạo shadcn): SettingsHubDialog/hộp thoại chi tiết AppUpdateBanner chuyển sang
// Radix Dialog, không forceMount Content, toàn bộ nội dung không gắn kết khi đóng (không còn
// thuộc tính boolean .open của <dialog> gốc), bên dưới dùng "đã gắn kết hay chưa" để xác định trạng thái mở.
async function openUpdateTab() {
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "Mở hộp thoại cài đặt");
  click(dom.window.document.querySelector('[data-settings-tab="update"]'));
  await wait(0);
}

async function openUpdateDialog() {
  await openUpdateTab();
  click(byId("app-update-btn"));
  await waitFor(() => byId("app-update-dialog") !== null, "Mở hộp thoại chi tiết cập nhật");
}

test("AppUpdateBanner: id hợp đồng, AppShellHeader không còn template trùng lặp", async () => {
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: false,
  });
  const { host, root } = await mountHome(services);

// "app-update-dialog"/"app-update-status"/"app-update-check-btn" nằm trong
// hộp thoại chi tiết của AppUpdateBanner (Radix Dialog do useAppUpdateDialogOpen cục bộ điều khiển,
// Phase C không forceMount), chỉ tồn tại trong DOM sau khi nhấn nút "Kiểm tra cập nhật"
// — dùng openUpdateDialog() thay vì openUpdateTab(), kích hoạt lớp này mới đáp ứng tiền đề
// xác nhận "các id hợp đồng tồn tại từng cái một".
  await openUpdateDialog();
  for (const id of ["app-update-btn", "app-update-dialog", "app-update-status", "app-update-check-btn"]) {
    assert.ok(byId(id), `Thiếu id hợp đồng: #${id}`);
  }
  // Tính duy nhất: sau khi dọn khung cũ AppShellHeader, chỉ nên có một #app-update-dialog
  // (Blueprint §5: id trùng lặp vi phạm đường cơ sở thị giác/cổng).
  assert.equal(dom.window.document.querySelectorAll("#app-update-dialog").length, 1);
  assert.equal(dom.window.document.querySelectorAll("#app-update-btn").length, 1);

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner: composition mặc định tắt tự động kiểm tra (cách ly kiểm thử, không kết nối mạng thật)", async () => {
  let fetchCalled = false;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    // Không truyền appUpdateAutoCheckEnabled — xác nhận giá trị mặc định là an toàn (false).
    fetchLatestRelease: async () => {
      fetchCalled = true;
      return { tag_name: "v99.0.0" };
    },
    appUpdateCachePort: memoryCachePort({ info: null, fresh: false }),
  });
  const { host, root } = await mountHome(services);
  await openUpdateTab();

  await wait(1400);
  assert.equal(fetchCalled, false, "Mặc định (không bật rõ ràng) không được gửi yêu cầu kiểm tra nền");
  assert.equal(byId("app-update-btn").dataset.updateState, "idle");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner: cache khởi động trúng (fresh) hiển thị trực tiếp, không gửi yêu cầu mạng", async () => {
  let fetchCalled = false;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    fetchLatestRelease: async () => {
      fetchCalled = true;
      return { tag_name: "v99.0.0" };
    },
    appUpdateCachePort: memoryCachePort({
      fresh: true,
      info: {
        checkedAt: Date.now(),
        currentVersion: "1.0.0",
        latestVersion: "9.9.9",
        hasUpdate: true,
        title: "RetainPDF 9.9.9",
        body: "## Phiên bản mới\n- Sửa lỗi đã biết",
        htmlUrl: "https://example.com/releases/9.9.9",
      },
    }),
  });
  const { host, root } = await mountHome(services);
  await openUpdateTab();

  await waitFor(() => byId("app-update-btn").dataset.updateState === "available", "Cache trúng hiển thị trực tiếp trạng thái available");
  assert.equal(byId("app-update-btn").classList.contains("has-update"), true);

  click(byId("app-update-btn"));
  await waitFor(() => byId("app-update-dialog") !== null, "Mở hộp thoại chi tiết");
  assert.match(byId("app-update-dialog").querySelector("h2").textContent, /RetainPDF 9\.9\.9/);
  assert.equal(byId("app-update-dialog").querySelector("p").textContent, "Hiện tại 1.0.0 · Mới nhất 9.9.9");
  assert.equal(byId("app-update-dialog").querySelector(".app-update-link").classList.contains("hidden"), false);

  await wait(1400);
  assert.equal(fetchCalled, false, "Bỏ qua yêu cầu kiểm tra nền khi cache còn mới");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner: cache khởi động không trúng, tự kiểm tra nền sau 1200ms và lưu vào store", async () => {
  const cachePort = memoryCachePort({ info: null, fresh: false });
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    fetchLatestRelease: async () => ({ tag_name: "v0.0.1", name: "RetainPDF 0.0.1", body: "patch", html_url: "https://example.com/releases/0.0.1" }),
    appUpdateCachePort: cachePort,
  });
  const { host, root } = await mountHome(services);
  await openUpdateTab();

  assert.equal(byId("app-update-btn").dataset.updateState, "idle", "Giữ trạng thái idle trước khi timer nền chạy");
  await waitFor(() => byId("app-update-btn").dataset.updateState !== "idle", "Hoàn tất chuyển trạng thái kiểm tra nền sau 1200ms");
  assert.equal(cachePort.read().fresh, true, "Ghi kết quả kiểm tra vào cache");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner: kiểm tra thủ công loading → thành công (available/latest) ba trạng thái và hiển thị formatReleaseNotes", async () => {
  const check1 = deferred();
  let callCount = 0;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    // Cache fresh bỏ qua bộ đếm tự kiểm tra nền, chỉ kiểm tra đường dẫn nhấp thủ công.
    appUpdateCachePort: memoryCachePort({ fresh: true, info: { checkedAt: Date.now(), currentVersion: "1.0.0", latestVersion: "1.0.0", hasUpdate: false } }),
    fetchLatestRelease: async () => {
      callCount += 1;
      return check1.promise;
    },
  });
  const { host, root } = await mountHome(services);
  await openUpdateDialog();

  click(byId("app-update-check-btn"));
  await waitFor(() => byId("app-update-btn").dataset.updateState === "checking", "Kiểm tra thủ công chuyển sang trạng thái loading");
  assert.equal(byId("app-update-status").classList.contains("hidden"), false);
  assert.equal(byId("app-update-status").textContent, "Đang kiểm tra GitHub Releases...");
  assert.equal(byId("app-update-dialog").querySelector("h2").textContent, "Đang kiểm tra cập nhật");

  check1.resolve({
    tag_name: "v4.2.0",
    name: "RetainPDF 4.2.0",
    body: "## Phiên bản mới\n- Sửa lỗi đã biết\n**Quan trọng**：Vui lòng nâng cấp\n`fix-1`",
    html_url: "https://example.com/releases/4.2.0",
  });
  await waitFor(() => byId("app-update-btn").dataset.updateState === "available", "Sau khi phân tích chuyển sang trạng thái available");
  assert.equal(byId("app-update-btn").classList.contains("has-update"), true);
  assert.equal(callCount, 1);

  // Xác nhận hiển thị formatReleaseNotes: loại bỏ dấu # tiêu đề, chuyển mục danh sách thành •, bỏ đánh dấu in đậm/mã.
  const notesText = byId("app-update-dialog").querySelector(".app-update-notes").textContent;
  assert.equal(notesText, "Phiên bản mới\n• Sửa lỗi đã biết\nQuan trọng：Vui lòng nâng cấp\nfix-1");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner: kiểm tra thủ công ở trạng thái lỗi hiển thị thông tin lỗi", async () => {
  const check1 = deferred();
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    appUpdateCachePort: memoryCachePort({ fresh: true, info: { checkedAt: Date.now(), currentVersion: "1.0.0", latestVersion: "1.0.0", hasUpdate: false } }),
    fetchLatestRelease: async () => check1.promise,
  });
  const { host, root } = await mountHome(services);
  await openUpdateDialog();

  click(byId("app-update-check-btn"));
  await waitFor(() => byId("app-update-btn").dataset.updateState === "checking", "Kiểm tra thủ công chuyển sang trạng thái loading");

  check1.reject(new Error("Không thể kết nối mạng"));
  await waitFor(() => byId("app-update-btn").dataset.updateState === "error", "Sau khi thất bại chuyển sang trạng thái error");
  assert.equal(byId("app-update-btn").classList.contains("has-update"), false);
  assert.equal(byId("app-update-status").textContent, "Kiểm tra thất bại");
  assert.equal(byId("app-update-dialog").querySelector(".app-update-notes").textContent, "Không thể kết nối mạng");

  root.unmount();
  services.dispose();
  host.remove();
});
