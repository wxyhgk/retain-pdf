/** 设置 → 备份：面板经后端接口看备份、立即备份、恢复（先确认）、删除手动备份。
 *
 * 用桩住的 fetch 扮演后端（真实形状：{code, message, data}），走一遍用户的路径：
 * 看到自动备份的说明与列表 → 立即备份 → 有任务在跑时恢复被拒、原因显示出来 →
 * 确认后恢复成功、触发刷新 → 删掉一份手动备份。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { click, makeDom } from "../helpers/dom.mjs";

const { backupTime, describeAuto, formatSize, kindLabel } = await import("../../src/features/backup/domain/describe.js");

test("备份的说明文字：种类、大小、时间、自动备份", () => {
  const now = Date.parse("2026-10-09T10:00:00Z");
  assert.equal(kindLabel("before-restore"), "恢复前");
  assert.equal(kindLabel("auto"), "自动");
  assert.equal(formatSize(9_600_000), "9.2 MB");
  assert.equal(formatSize(300), "1 KB");
  assert.match(backupTime("2026-10-08T12:05:00Z", now), /^10月8日 \d\d:05$/);
  assert.match(backupTime("2025-12-30T12:05:00Z", now), /^2025年12月30日/);
  assert.equal(describeAuto(0, null, now), "自动备份已关闭。");
  assert.equal(describeAuto(24, null, now), "每天自动备份一次，还没有自动备份过。");
  assert.match(describeAuto(24, "2026-10-09T09:05:00Z", now), /^每天自动备份一次，上次是 10月9日/);
  assert.match(describeAuto(48, null, now), /^每 2 天/);
});

function fakeBackend() {
  const item = (id, kind, created_at) => ({ id, kind, created_at, schema_version: 19, bytes: 9_600_000 });
  const state = {
    dir: "/data/backups/db",
    auto_interval_hours: 24,
    running: false,
    restore_blockers: ["有 1 个任务在排队或运行"],
    /** 面板看到的还是可以恢复,点下去时恰好有任务开始了。 */
    refuseNextRestore: false,
    items: [
      item("auto-20261009T030000000Z-v19", "auto", "2026-10-09T03:00:00Z"),
      item("manual-20261007T120000000Z-v19", "manual", "2026-10-07T12:00:00Z"),
    ],
  };
  const calls = [];
  let made = 0;
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const snapshot = () => ({ ...state, last_auto_at: "2026-10-09T03:00:00Z", items: [...state.items] });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || "GET";
    const path = new URL(`${url}`, "http://localhost").pathname;
    calls.push({ method, path });
    const restore = path.match(/\/api\/v1\/backups\/([^/]+)\/restore$/);
    const one = path.match(/\/api\/v1\/backups\/([^/]+)$/);
    if (path.endsWith("/api/v1/backups") && method === "GET") return reply(200, { code: 0, message: "ok", data: snapshot() });
    if (path.endsWith("/api/v1/backups") && method === "POST") {
      made += 1;
      const fresh = item(`manual-20261009T10000${made}000Z-v19`, "manual", `2026-10-09T10:00:0${made}Z`);
      state.items.unshift(fresh);
      return reply(200, { code: 0, message: "ok", data: fresh });
    }
    if (restore && method === "POST") {
      if (state.restore_blockers.length || state.refuseNextRestore) {
        state.refuseNextRestore = false;
        return reply(409, { code: 409, message: "有 1 个任务在排队或运行，等它们结束后再恢复" });
      }
      const safety = item("before-restore-20261009T100500000Z-v19", "before-restore", "2026-10-09T10:05:00Z");
      state.items.unshift(safety);
      return reply(200, { code: 0, message: "ok", data: { restored: decodeURIComponent(restore[1]), safety_backup: safety.id, status: snapshot() } });
    }
    if (one && method === "DELETE") {
      state.items = state.items.filter((b) => b.id !== decodeURIComponent(one[1]));
      return reply(200, { code: 0, message: "ok", data: snapshot() });
    }
    return reply(404, { code: 404, message: "not found" });
  };
  return { state, calls };
}

test("立即备份、恢复（先确认；有任务在跑时被拒）、删除手动备份", async () => {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "Event", "MouseEvent", "FocusEvent", "Node", "MutationObserver", "URL"] });
  const backend = fakeBackend();
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { BackupPanel } = await import("../../src/features/backup/index.js");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  let reloaded = 0;
  root.render(React.createElement(BackupPanel, { onRestored: () => { reloaded += 1; } }));
  const text = () => host.textContent;
  const rows = () => [...host.querySelectorAll("[data-backup-id]")];

  await waitFor(() => text().includes("每天自动备份一次"));
  assert.equal(rows().length, 2);
  assert.match(text(), /自动 · 9\.2 MB/);
  // 有任务在跑:恢复按钮点不了,说明在等什么。
  assert.match(text(), /有 1 个任务在排队或运行，结束后才能恢复/);
  assert.equal(rows()[0].querySelector('[data-backup-action="restore"]').disabled, true);
  // 只有手动备份能删。
  assert.equal(rows()[0].querySelector('[data-backup-action="delete"]'), null);
  assert.ok(rows()[1].querySelector('[data-backup-action="delete"]'));

  click(dom, host.querySelector('[data-backup-action="create"]'));
  await waitFor(() => text().includes("已备份（9.2 MB）"));
  await waitFor(() => rows().length === 3);

  // 任务结束了,刷新后可以恢复;但点下去的那一刻又有任务开始:后端拒绝,原因显示出来,不刷新页面。
  backend.state.restore_blockers = [];
  backend.state.refuseNextRestore = true;
  click(dom, host.querySelector('[data-backup-action="create"]'));
  await waitFor(() => rows().length === 4 && !rows()[1].querySelector('[data-backup-action="restore"]').disabled);
  click(dom, rows()[1].querySelector('[data-backup-action="restore"]'));
  await waitFor(() => host.querySelector('[data-backup-action="confirm-restore"]'));
  click(dom, host.querySelector('[data-backup-action="confirm-restore"]'));
  await waitFor(() => text().includes("等它们结束后再恢复"));
  assert.equal(reloaded, 0);

  const target = rows()[1].getAttribute("data-backup-id");
  click(dom, rows()[1].querySelector('[data-backup-action="restore"]'));
  await waitFor(() => host.querySelector('[data-backup-action="confirm-restore"]'));
  assert.match(text(), /当前的会先自动备份一份/);
  click(dom, host.querySelector('[data-backup-action="confirm-restore"]'));
  await waitFor(() => reloaded === 1);
  assert.match(text(), /已恢复/);
  assert.ok(backend.calls.some((c) => c.method === "POST" && c.path.endsWith(`/api/v1/backups/${target}/restore`)));

  const manual = rows().find((row) => row.querySelector('[data-backup-action="delete"]'));
  const manualId = manual.getAttribute("data-backup-id");
  click(dom, manual.querySelector('[data-backup-action="delete"]'));
  await waitFor(() => !rows().some((row) => row.getAttribute("data-backup-id") === manualId));
  assert.ok(backend.calls.every((c) => c.path.startsWith("/api/v1/")), "requests carry the API prefix");
  root.unmount();
  dom.window.close();
});
