import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// DetailApp (Radix Dialog: trang chi tiết nhiệm vụ) kiểm thử cấp component:
// Tải .jsx trực tiếp qua móc esbuild của tests/helpers/jsx-loader.mjs.
// Xác nhận: tải bố cục (overview → markdown), kết nối setText/setActionLink,
// thao tác mệnh lệnh (danh sách tạo phẩm), tải ngắt quãng danh sách sự kiện cùng mở/đóng dialog.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/detail.html?job_id=job-react-detail" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (giai đoạn B) cần cancelAnimationFrame trong jsdom
// (dọn dẹp bộ hẹn giờ mount animation của TabsContent) và getComputedStyle 
// (Presence đọc animation-name xác định animation thoát kết thúc) — jsdom window 
// có implement, chỉ là không được sao chép vào global như requestAnimationFrame.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { DetailApp } = await import("../src/pages/detail/DetailApp.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chạy song song — thời gian tải biến động theo áp lực tiến trình; dùng polling thay vì chờ cố định (tối đa 3s).
async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(20);
  }
  assert.fail(`Hết thời gian chờ: ${description}`);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function makePorts() {
  const payloadRaw = {
    job_id: "job-react-detail",
    status: "succeeded",
    display_stage: "done",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:03:00Z",
    finished_at: "2026-06-01T00:03:00Z",
    runtime: {
      stage_history: [
        {
          stage: "translating",
          display_stage: "translation",
          enter_at: "2026-06-01T00:00:00Z",
          exit_at: "2026-06-01T00:01:00Z",
          duration_ms: 60000,
        },
        {
          stage: "rendering",
          display_stage: "render",
          enter_at: "2026-06-01T00:01:00Z",
          exit_at: "2026-06-01T00:03:00Z",
          duration_ms: 120000,
        },
      ],
    },
    artifacts: {
      markdown: {
        ready: true,
        json_url: "/api/v1/jobs/job-react-detail/markdown",
        raw_url: "/api/v1/jobs/job-react-detail/markdown/raw",
      },
    },
    actions: {
      download_pdf: { enabled: true, url: "/api/v1/jobs/job-react-detail/pdf" },
    },
  };
  const manifestPayload = {
    items: [
      { artifact_key: "source_pdf", ready: true, resource_path: "/api/v1/jobs/job-react-detail/artifacts/source_pdf" },
      { artifact_key: "translated_pdf", ready: true, resource_path: "/api/v1/jobs/job-react-detail/pdf" },
    ],
  };
  const eventItems = [
    { seq: 1, event: "stage_transition", level: "info", message: "Bắt đầu biên dịch", display_stage: "translation" },
    { seq: 2, event: "stage_transition", level: "info", message: "Hoàn thành render", display_stage: "render" },
  ];
  const calls = { events: [] };
  return {
    calls,
    getJobId: () => "job-react-detail",
    configPort: { detailShareNote: () => "Văn bản khuyến nghị chia sẻ (kiểm thử)" },
    resumePort: { submit: async () => ({ job_id: "job-next" }) },
    dataPort: {
      apiPrefix: "/api/v1",
      loadOverview: async () => ({
        diagnosticsPayload: null,
        manifestPayload,
        payloadRaw,
        resumePlan: { can_resume: true, from_stage: "translation" },
      }),
      loadMarkdownPayload: async () => ({
        content: "# Tài liệu kiểm thử\n\nNội dung chính",
        file_name: "book.md",
        json_url: "/api/v1/jobs/job-react-detail/markdown",
        raw_url: "/api/v1/jobs/job-react-detail/markdown/raw",
        images: [],
      }),
      fetchJobEvents: async (jobId, apiPrefix, limit, offset) => {
        calls.events.push([jobId, apiPrefix, limit, offset]);
        return { items: eventItems };
      },
      fetchProtected: async () => {
        throw new Error("Bài kiểm thử này không nên thực hiện yêu cầu được bảo vệ");
      },
      rerunJob: async () => ({}),
      resumeJob: async () => ({}),
    },
  };
}

test("DetailApp:加载编排、文案适配、产物孤岛、事件流模态框", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "detail-root";
  dom.window.document.body.appendChild(host);

  const ports = makePorts();
  const root = createRoot(host);
  root.render(React.createElement(DetailApp, {
    configPort: ports.configPort,
    dataPort: ports.dataPort,
    getJobId: ports.getJobId,
    resumePort: ports.resumePort,
  }));
  // 等待 overview + markdown 两段异步编排全部落地
  await waitFor(
    () => /已加载/.test(byId("detail-markdown-status")?.textContent || ""),
    "markdown 状态就绪",
  );

  // 头部:job id 与分享提示走 setText 适配
  assert.equal(byId("detail-job-id")?.textContent, "job-react-detail");
  assert.equal(byId("detail-head-note")?.textContent, "分享提示文案(测试)");
  assert.notEqual(byId("detail-status-summary")?.textContent, "-");

  // 断点恢复:resumePlan 可恢复 → 文案与按钮状态(命令式写入)
  assert.match(byId("detail-rerun-status")?.textContent || "", /可从 translation 恢复/);
  assert.equal(byId("detail-rerun-btn")?.disabled, false);

  // 动作链接:setActionLink 适配(reader/pdf 均就绪)
  assert.equal(byId("detail-reader-btn")?.classList.contains("disabled"), false);
  assert.equal(byId("detail-reader-btn")?.getAttribute("aria-disabled"), "false");
  assert.equal(byId("detail-pdf-btn")?.classList.contains("disabled"), false);

  // 产物清单:保留的 artifacts.js 经 overview-renderer 命令式写入 React 容器
  assert.equal(byId("detail-artifacts-summary")?.textContent, "共 2 项");
  assert.equal(host.querySelectorAll(".detail-artifact-row").length, 2);

  // Markdown:markdown-flow 复用 → 状态与预览
  assert.match(byId("detail-markdown-status")?.textContent || "", /已加载 \/markdown JSON/);
  assert.match(byId("detail-markdown-preview")?.textContent || "", /# 测试文档/);
  assert.equal(byId("detail-markdown-image-count")?.textContent, "0");

  // 阶段时间线模态框(阶段 C 收官批换 Radix Dialog,不 forceMount:关闭态
  // 整个 Content 不挂载于 DOM,断言从"hidden class 真假"改为"是否挂载"):
  // 打开渲染条目,Escape 关闭
  assert.equal(byId("detail-stage-history-modal"), null, "初始未打开时不挂载");
  click(byId("detail-open-stage-history-btn"));
  await waitFor(
    () => byId("detail-stage-history-modal") !== null,
    "阶段时间线模态框打开",
  );
  // Radix Dialog Content 走 Portal,渲染到 document.body 而不是 host 子树内,
  // 断言从 host 作用域改成整个 document(镜像其余已迁移对话框测试的先例)。
  assert.equal(dom.window.document.querySelectorAll(".detail-stage-item").length, 2);
  assert.match(dom.window.document.querySelector(".detail-stage-item .detail-stage-title")?.textContent || "", /^1\. /);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(
    () => byId("detail-stage-history-modal") === null,
    "Escape 关闭阶段时间线模态框",
  );

  // 事件流:按需分页拉全量 + 页内缓存 + 按钮文案变为「查看」
  assert.equal(byId("detail-open-events-btn")?.textContent, "按需加载");
  assert.equal(byId("detail-events-modal"), null, "初始未打开时不挂载");
  click(byId("detail-open-events-btn"));
  await waitFor(
    () => dom.window.document.querySelectorAll(".detail-event-item").length === 2,
    "事件流条目渲染",
  );
  assert.ok(byId("detail-events-modal"), "事件流模态框已挂载");
  assert.deepEqual(ports.calls.events, [["job-react-detail", "/api/v1", 200, 0]]);
  assert.equal(byId("detail-events-status")?.textContent, "全部事件 · 2 条");
  assert.equal(byId("detail-open-events-btn")?.textContent, "查看");

  // 再次打开不重复请求(页内缓存)
  click(byId("detail-close-events-btn"));
  await waitFor(
    () => byId("detail-events-modal") === null,
    "关闭事件流模态框",
  );
  click(byId("detail-open-events-btn"));
  await waitFor(
    () => byId("detail-events-modal") !== null,
    "再次打开事件流模态框",
  );
  assert.equal(ports.calls.events.length, 1);

  root.unmount();
  host.remove();
});

test("DetailApp:缺少 job_id 时提示且不发起请求", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  let overviewCalls = 0;
  const root = createRoot(host);
  root.render(React.createElement(DetailApp, {
    configPort: { detailShareNote: () => "share" },
    dataPort: {
      apiPrefix: "/api/v1",
      loadOverview: async () => {
        overviewCalls += 1;
        return {};
      },
      loadMarkdownPayload: async () => null,
      fetchJobEvents: async () => ({ items: [] }),
      fetchProtected: async () => ({}),
    },
    getJobId: () => "",
    resumePort: { submit: async () => ({}) },
  }));
  await waitFor(
    () => host.querySelector("#detail-head-note")?.textContent === "缺少 job_id，请通过 detail.html?job_id=... 打开。",
    "缺少 job_id 提示",
  );
  assert.equal(overviewCalls, 0);

  root.unmount();
  host.remove();
});
