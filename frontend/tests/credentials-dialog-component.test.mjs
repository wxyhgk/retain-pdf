import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử thành phần CredentialsDialog (nhóm hộp thoại Phase 3, Blueprint §2).
// Kiểm tra: id hợp đồng, sự kiện openBrowserCredentials mở (bao gồm setupMode trạng thái cấu hình lần đầu),
// ba trạng thái xác thực OCR/DeepSeek, hai nhánh lưu (trình duyệt/máy tính để bàn), đồng bộ hai chiều input ẩn với
// credentialsStatePort, điểm kích hoạt #credentials-btn của SettingsHubDialog,
// id hợp đồng giữ chỗ của hai tab từ điển/cập nhật.

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
const { defaultCredentialsStatePort } = await import("../src/js/features/credentials/default-state-port.js");

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
  // Logic kích hoạt Trigger của Radix Tabs nằm trên onMouseDown (không phải onClick) — giai đoạn B
  // sau khi chuyển sang Radix Tabs (tab của CredentialsDialog/SettingsHubDialog), chỉ
  // dispatch "click" sẽ không kích hoạt chuyển tab. Click trình duyệt thực tế vốn là
  // toàn bộ mousedown→mouseup→click, ở đây thêm mousedown để mô phỏng nhấp gần với tương tác
  // thực, thay vì nới lỏng bất kỳ khẳng định nào.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function mockValidators(overrides = {}) {
  return {
    validateOcrToken: async (_apiPrefix, _providerId, token) => {
      if (!token) {
        return { ok: false, status: "unauthorized", summary: "Thiếu token" };
      }
      if (token === "bad-token") {
        return { ok: false, status: "unauthorized", summary: "Token không hợp lệ" };
      }
      return { ok: true, status: "valid", summary: "Token hợp lệ" };
    },
    validateDeepSeekToken: async (_apiPrefix, payload) => {
      if (!payload?.api_key) {
        return { ok: false, status: 0 };
      }
      if (payload.api_key === "bad-key") {
        return { ok: false, status: 401, summary: "DeepSeek Key không hợp lệ hoặc đã hết hạn." };
      }
      return { ok: true, status: 200, summary: "Kết nối DeepSeek thành công." };
    },
    queryDeepSeekBalance: async () => ({
      ok: true,
      is_available: true,
      balance_infos: [{ currency: "CNY", total_balance: "88.00" }],
    }),
    ...overrides,
  };
}

function createServices(overrides = {}) {
  const { validateOcrToken, validateDeepSeekToken, queryDeepSeekBalance, ...rest } = mockValidators(overrides.validators);
  return createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    validateOcrToken,
    validateDeepSeekToken,
    queryDeepSeekBalance,
    ...rest,
    ...overrides,
  });
}

async function mountHome(services) {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);
  services.initialize();
  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp 首帧渲染");
  await wait(0);
  return { host, root };
}

test("CredentialsDialog: lối vào thông thường qua API cài đặt; setupMode vẫn mở cửa cấu hình lần đầu độc lập", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // Giai đoạn C (cải tiến shadcn): CredentialsDialog chuyển sang Radix Dialog, không forceMount
  // Content — khi hộp thoại đóng, toàn bộ nội dung (bao gồm các id hợp đồng bên dưới) không được gắn.
  assert.equal(byId("browser-credentials-dialog"), null, "Không gắn khi chưa mở");

  // Thông thường: openBrowserCredentials → khu vực API trung tâm cài đặt (lối vào duy nhất hàng ngày)
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "Mở trung tâm cài đặt thông thường");
  await waitFor(() => byId("browser-api-key") !== null, "Bàn làm việc nhúng trong khu vực API");
  assert.equal(byId("browser-credentials-dialog"), null, "常规不再弹独立接口设置窗");
  assert.ok(byId("browser-credentials-save-btn"), "Bàn làm việc nhúng có nút lưu");

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-settings-dialog") === null, "Đóng cài đặt");

  // ---- setupMode trạng thái cấu hình lần đầu: cửa sổ bật lên độc lập, tabs ẩn, tiêu đề/văn bản lưu chuyển đổi ----
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  await waitFor(() => byId("browser-credentials-dialog") !== null, "setupMode mở cửa sổ bật lên độc lập");
  await waitFor(() => byId("browser-credentials-title")?.textContent === "Cấu hình lần đầu", "Tiêu đề setupMode chuyển đổi");

  for (const id of [
    "browser-credentials-title", "browser-credentials-close-btn", "browser-credentials-status",
    "browser-credentials-tabs", "browser-credential-tab-api", "browser-credential-tab-task",
    "browser-credentials-save-btn", "browser-paddle-token", "browser-paddle-validate-btn",
    "browser-paddle-validation", "browser-api-key", "browser-deepseek-validate-btn",
    "browser-deepseek-validation", "browser-deepseek-top-up-link", "browser-job-math-mode",
  ]) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }

  assert.equal(byId("browser-credentials-save-btn").textContent, "Lưu và khởi động");
  assert.equal(byId("browser-credentials-tabs").classList.contains("hidden"), true);
  assert.equal(byId("browser-credentials-dialog").dataset.setupMode, "1");

  root.unmount();
  services.dispose();
  host.remove();
});

test("Lối vào thông tin xác thực: bàn làm việc nhúng trong khu vực API cài đặt; #credential-gate-action cũng mở API cài đặt", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // Cài đặt → Khu vực API: CredentialsWorkbench nhúng trực tiếp (thay đổi lớn v2, nút sảnh
  // #credentials-btn đã nghỉ hưu), không còn mở browser-credentials-dialog.
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "Mở hộp thoại cài đặt");
  await waitFor(() => byId("browser-credentials-tabs") !== null, "API 区内嵌凭据工作台(tabs 挂载)");
  assert.ok(byId("browser-credentials-save-btn"), "Bàn làm việc nhúng có nút lưu");
  assert.equal(byId("credentials-btn"), null, "Nút sảnh đã nghỉ hưu");
  assert.equal(byId("browser-credentials-dialog"), null, "Không còn mở hộp thoại thông tin xác thực cấp hai trong cài đặt");

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-settings-dialog") === null, "Đóng hộp thoại cài đặt");

  // Giai đoạn C (cải tiến shadcn): credential-gate-action nằm bên trong TranslationWorkflowDialog
  // (khu vực hướng dẫn tải lên của HeroUpload), hộp thoại này chuyển sang Radix Dialog, không forceMount
  // Content — cần mở một lần trước khi gắn (giống các hộp thoại giai đoạn C khác).
  services.workflowDialog.openUpload();
  await waitFor(() => byId("credential-gate-action"), "Sau khi mở hộp thoại workflow, credential-gate-action được gắn");
  click(byId("credential-gate-action"));
  await waitFor(() => byId("app-settings-dialog") !== null, "credential-gate-action mở trung tâm cài đặt");
  await waitFor(() => byId("browser-api-key") !== null, "落到 API 设置工作台");
  assert.equal(byId("browser-credentials-dialog"), null, "Cổng thông thường không mở cửa sổ giao diện độc lập");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: ba trạng thái xác thực OCR/DeepSeek (thiếu/lỗi/thành công)", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // Xác minh chạy trên bảng điều khiển nhúng cài đặt (nhất quán với điểm vào hàng ngày)
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "Mở cài đặt");
  await waitFor(() => byId("browser-paddle-validate-btn") !== null, "Bàn làm việc API sẵn sàng");

  // ---- OCR(paddle):Thiếu → Lỗi → Thành công ----
  click(byId("browser-paddle-validate-btn"));
  await waitFor(() => byId("browser-paddle-validation").title === "Vui lòng điền Paddle Access Token trước.", "Trạng thái thiếu OCR");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(byId("browser-paddle-token"), "bad-token");
  click(byId("browser-paddle-validate-btn"));
  await waitFor(() => byId("browser-paddle-validation").title === "Token không hợp lệ", "Trạng thái lỗi OCR");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(byId("browser-paddle-token"), "good-token");
  click(byId("browser-paddle-validate-btn"));
  await waitFor(() => byId("browser-paddle-validation").title === "Token hợp lệ", "Trạng thái thành công OCR");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-valid"), true);

  // ---- DeepSeek:Thiếu → Lỗi → Thành công (bao gồm gợi ý nạp tiền, chỉ xuất hiện khi số dư < 2 CNY——
  //      mock trả về 88 CNY, không nên hiển thị liên kết nạp tiền) ----
  // Trạng thái thiếu:handleBrowserDeepSeekValidate trong deepseek-flow.js(kept) đối với "thiếu"
  // Key", trực tiếp return, không ghi nhãn kiểm tra (khác với ngữ nghĩa của nhánh OCR, đây là
  // logic kinh doanh hiện có, không phải hành vi được ghi lại trong lĩnh vực này) — Trạng thái thiếu được
  // kích hoạt bởi bảo vệ nút lưu, thay vì yêu cầu.
  click(byId("browser-credentials-save-btn"));
  await waitFor(() => byId("browser-deepseek-validation").title === "Vui lòng điền DeepSeek Key trước.", "DeepSeek thiếu(được kích hoạt bởi bảo vệ nút lưu)");
  assert.equal(byId("browser-deepseek-validation").classList.contains("is-error"), true);
  assert.notEqual(byId("app-settings-dialog"), null, "Khi thiếu trường, lưu sẽ bị chặn, hộp thoại cài đặt không đóng");

  typeInput(byId("browser-api-key"), "bad-key");
  click(byId("browser-deepseek-validate-btn"));
  await waitFor(() => byId("browser-deepseek-validation").title === "DeepSeek Key không hợp lệ hoặc đã hết hạn.", "Trạng thái lỗi DeepSeek");
  assert.equal(byId("browser-deepseek-validation").classList.contains("is-error"), true);
  assert.equal(byId("browser-deepseek-top-up-link").classList.contains("hidden"), true);

  typeInput(byId("browser-api-key"), "good-key");
  click(byId("browser-deepseek-validate-btn"));
  await waitFor(() => byId("browser-deepseek-validation").classList.contains("is-valid"), "Trạng thái thành công DeepSeek");
  assert.match(byId("browser-deepseek-validation").title, /Số dư CNY 88\.00/);
  assert.equal(byId("browser-deepseek-top-up-link").classList.contains("hidden"), true, "Số dư đủ, không hiển thị gợi ý nạp tiền");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: lưu (chế độ trình duyệt) — ghi input ẩn, đồng bộ credentialsStatePort", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // 阶段 C(shadcn 改造):paddle_token/api_key/ocr_provider 等隐藏 input
  // (HiddenCredentialInputs)挂在 TranslationWorkflowDialog 内部(job-form),
  // 该对话框换成 Radix Dialog 后不 forceMount Content——需要先打开一次才会
  // 挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId("paddle_token"), "Sau khi mở hộp thoại workflow, input ẩn được gắn");

  // 常规保存入口：设置 → API
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "Mở cài đặt");
  await waitFor(() => byId("browser-api-key") !== null, "Bàn làm việc API sẵn sàng");

  typeInput(byId("browser-paddle-token"), "paddle-secret");
  typeInput(byId("browser-api-key"), "deepseek-secret");

  click(byId("browser-credentials-save-btn"));
  await waitFor(
    () => defaultCredentialsStatePort.getCredentials().modelApiKey === "deepseek-secret",
    "Sau khi lưu, credentialsStatePort cập nhật",
  );

  assert.equal(byId("paddle_token").value, "paddle-secret", "Cầu nối input ẩn: paddle_token");
  assert.equal(byId("api_key").value, "deepseek-secret", "Cầu nối input ẩn: api_key");
  assert.equal(byId("ocr_provider").value, "paddle");

  const credentials = defaultCredentialsStatePort.getCredentials();
  assert.equal(credentials.paddleToken, "paddle-secret");
  assert.equal(credentials.modelApiKey, "deepseek-secret");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: lưu (chế độ máy tính để bàn) — đi nhánh saveDesktopConfig", async () => {
  const desktopCalls = [];
  const services = createServices({
    initialDesktopMode: true,
    saveDesktopConfig: async (browserConfig, afterSave) => {
      desktopCalls.push({ browserConfig });
      await afterSave?.();
      return { firstRunCompleted: true };
    },
  });
  const { host, root } = await mountHome(services);

  // 阶段 C(shadcn 改造):saveDesktopConfig 分支同样会读 HiddenCredentialInputs
  // 挂在 TranslationWorkflowDialog 内部的隐藏 input(paddle_token 等),需要先
  // 打开一次工作流对话框才会挂载。
  services.workflowDialog.openUpload();
  await waitFor(() => byId("paddle_token"), "Sau khi mở hộp thoại workflow, input ẩn được gắn");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  await waitFor(() => byId("browser-credentials-dialog") !== null, "Mở hộp thoại (setupMode)");

  typeInput(byId("browser-paddle-token"), "paddle-desktop");
  typeInput(byId("browser-api-key"), "deepseek-desktop");

  click(byId("browser-credentials-save-btn"));
  await waitFor(() => desktopCalls.length === 1, "saveDesktopConfig được gọi");
  assert.equal(desktopCalls[0].browserConfig.modelApiKey, "deepseek-desktop");
  assert.equal(desktopCalls[0].browserConfig.paddleToken, "paddle-desktop");
  assert.equal(desktopCalls[0].browserConfig.markConfigured, true, "Trong setupMode nên đánh dấu hoàn thành cấu hình lần đầu");
  await waitFor(() => byId("browser-credentials-dialog") === null, "Hộp thoại đóng sau khi lưu thành công");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: đồng bộ một chiều có điều khiển giữa input ẩn và credentialsStatePort (rủi ro thiết kế 1)", async () => {
  // 实现调整说明(见 HiddenCredentialInputs.jsx 头注释):隐藏 input 改走
  // 受控渲染(value 直接订阅 credentialsStatePort.store),不是蓝图原计划的
  // "非受控 ref + mirrorCredentialsToHiddenInputs 双向同步"——实测证实那套
  // 组合在任何兄弟组件重渲染时都会被 React 的表单元素受控态回收逻辑悄悄清空
  // (上传进行中 HeroUpload 高频重渲染,会把刚保存的 token 冲掉),受控是唯一
  // 不会被 React 自己吃掉的写法。store 是唯一真值,DOM 是纯投影,因此这里只
  // 断言"store → 隐藏 input"单向同步,并确认"外部直接改 DOM"不会被采纳
  // (证明真值确实是 store,不是可以被绕过的 DOM)。
  const services = createServices();
  const { host, root } = await mountHome(services);

  // 阶段 C(shadcn 改造):隐藏 input 挂在 TranslationWorkflowDialog 内部
  // (job-form),该对话框换成 Radix Dialog 后不 forceMount Content——需要先
  // 打开一次才会挂载(同其余阶段 C 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId("paddle_token"), "Sau khi mở hộp thoại workflow, input ẩn được gắn");

  // composition 初始化时 credentialsStatePort 已经写入过持久化配置;
  // HiddenCredentialInputs 应把当前 store 状态实时投影进隐藏 input。
  defaultCredentialsStatePort.setCredentials({
    ocrProvider: "paddle",
    paddleToken: "from-store",
    modelApiKey: "from-store-key",
  });
  await waitFor(() => byId("paddle_token").value === "from-store", "Hình chiếu store → input ẩn");
  assert.equal(byId("api_key").value, "from-store-key");

  // 外部直接改 DOM(模拟浏览器自动填充等非受控写入路径)不经过 store,
  // 不会被采纳为"真值"——下一次任意 credentials 变更触发的重渲染都会把
  // DOM 拉回 store 的值,证明 store 才是唯一真值,不存在"DOM 悄悄漂移、
  // 表单提交读到脏值"的风险(这正是蓝图风险 1 要防的静默失败)。
  typeInput(byId("paddle_token"), "from-dom");
  assert.equal(byId("paddle_token").value, "from-dom", "Việc ghi bằng setter gốc sẽ có hiệu lực (không có onChange chặn)");
  // 触发一次(哪怕内容不变的)credentials 更新,验证下一次渲染把 DOM 拉回 store
  defaultCredentialsStatePort.patchCredentials({});
  await waitFor(() => byId("paddle_token").value === "from-store", "Sau khi render lại, DOM được kéo về giá trị thực của store, ghi từ bên ngoài không được chấp nhận");
  assert.equal(defaultCredentialsStatePort.getCredentials().paddleToken, "from-store", "store không bị nhiễm bởi ghi DOM");

  root.unmount();
  services.dispose();
  host.remove();
});

test("SettingsHubDialog: hợp đồng tab từ vựng/giao diện/cập nhật", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "Mở hộp thoại cài đặt");

  const glossaryTab = dom.window.document.querySelector('[data-settings-tab="glossary"]');
  click(glossaryTab);
  await waitFor(() => byId("glossary-btn"), "Nút giữ chỗ tab từ vựng tồn tại");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="glossary"]').hidden, false);

  const appearanceTab = dom.window.document.querySelector('[data-settings-tab="appearance"]');
  assert.ok(appearanceTab, "Tab giao diện tồn tại");
  click(appearanceTab);
  await waitFor(() => byId("theme-appearance-panel"), "Bảng giao diện được gắn");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="appearance"]').hidden, false);
  assert.ok(byId("theme-option-classic"), "Tùy chọn giao diện cổ điển");
  assert.ok(byId("theme-option-jiangnan"), "Tùy chọn sân vườn Giang Nam");
  assert.ok(byId("theme-option-seacliff"), "Tùy chọn mũi đá biển");
  assert.ok(byId("theme-option-night"), "Tùy chọn đêm ngói đen");

  // 切换皮肤应写入 data-theme
  click(byId("theme-option-jiangnan"));
  await waitFor(
    () => dom.window.document.documentElement.dataset.theme === "jiangnan",
    "Sau khi chọn sân vườn Giang Nam, html[data-theme=jiangnan]",
  );
  click(byId("theme-option-night"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "night"
      && dom.window.document.documentElement.classList.contains("theme-dark"),
    "Đêm ngói đen + class theme-dark",
  );
  click(byId("theme-option-classic"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "classic"
      && !dom.window.document.documentElement.classList.contains("theme-dark"),
    "Quay lại cổ điển và bỏ theme-dark",
  );

  const updateTab = dom.window.document.querySelector('[data-settings-tab="update"]');
  click(updateTab);
  await waitFor(() => byId("app-update-btn"), "Nút giữ chỗ tab cập nhật tồn tại");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="update"]').hidden, false);

  root.unmount();
  services.dispose();
  host.remove();
});
