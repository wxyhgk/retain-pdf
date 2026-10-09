// 设置 → 同步：几台电脑通过一个网盘文件夹或 WebDAV（群晖、坚果云、Nextcloud…）同步书库。
//
// 状态从后端读（GET /api/v1/sync），面板开着时定时刷新。网盘文件夹失焦即保存；
// WebDAV 三个字段一起填，点「保存」才存（PUT /api/v1/sync），「测试连接」用填的值
// 试一次读写、不保存（POST /api/v1/sync/test）。后端改完设置马上跑一轮。桌面版能弹
// 系统的文件夹选择框，网页版手填路径（后端所在机器上的路径）。WebDAV 密码只写不读：
// 后端只告诉有没有保存过，输入框留空表示不改。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSyncStatusApi,
  runSyncNowApi,
  testSyncTargetApi,
  updateSyncSettingsApi,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { getDesktopHost } from "@/platform/desktop/host.js";
import { describeMaintenance, describePending, describeSyncStatus } from "../domain/describe.js";

type SyncStatus = Awaited<ReturnType<typeof fetchSyncStatusApi>>;
type SyncSettings = Parameters<typeof updateSyncSettingsApi>[1];
type Transport = "folder" | "webdav";

/** 已保存的设置里，当前方式的同步位置配好了没有。 */
function targetReady(status: SyncStatus | null): boolean {
  if (!status) return false;
  return status.transport === "webdav" ? Boolean(status.webdav_url) : Boolean(status.folder);
}

const POLL_IDLE_MS = 15_000;
const POLL_BUSY_MS = 2_000;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : `${error || "操作失败"}`;
}

export function SyncSettingsPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [transport, setTransport] = useState<Transport | null>(null);
  const [dav, setDav] = useState({ url: "", username: "", password: "" });
  const [davDirty, setDavDirty] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "run" | "test">("");
  const [actionError, setActionError] = useState("");
  const desktop = getDesktopHost();
  const editing = useRef({ folder: false, name: false, dav: false });

  const applyStatus = useCallback((next: SyncStatus) => {
    setStatus(next);
    setTransport((current) => current ?? (next?.transport === "webdav" ? "webdav" : "folder"));
    if (!editing.current.folder) setFolderDraft(next?.folder || "");
    if (!editing.current.name) setNameDraft(next?.device_name || "");
    if (!editing.current.dav) {
      setDav({ url: next?.webdav_url || "", username: next?.webdav_username || "", password: "" });
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyStatus(await fetchSyncStatusApi(API_PREFIX));
    } catch (error) {
      setActionError(errorText(error));
    }
  }, [applyStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const delay = status?.running || busy === "run" ? POLL_BUSY_MS : POLL_IDLE_MS;
    const timer = window.setTimeout(refresh, delay);
    return () => window.clearTimeout(timer);
  }, [status, busy, refresh]);

  async function save(payload: SyncSettings): Promise<boolean> {
    setBusy("save");
    setActionError("");
    try {
      applyStatus(await updateSyncSettingsApi(API_PREFIX, payload));
      return true;
    } catch (error) {
      setActionError(errorText(error));
      return false;
    } finally {
      setBusy("");
    }
  }

  function davPayload(): SyncSettings {
    const payload: SyncSettings = {
      transport: "webdav",
      webdav_url: dav.url.trim(),
      webdav_username: dav.username.trim(),
    };
    if (dav.password) payload.webdav_password = dav.password;
    return payload;
  }

  async function saveDav() {
    editing.current.dav = false;
    if (await save(davPayload())) {
      setDavDirty(false);
      setDav((current) => ({ ...current, password: "" }));
    }
  }

  async function testDav() {
    setBusy("test");
    setTestResult(null);
    try {
      const result = await testSyncTargetApi(API_PREFIX, davPayload());
      setTestResult(
        result.ok
          ? { ok: true, text: `连接正常，读写都没问题（${((result.latency_ms || 0) / 1000).toFixed(1)} 秒）。` }
          : { ok: false, text: result.error || "连接失败" },
      );
    } catch (error) {
      setTestResult({ ok: false, text: errorText(error) });
    } finally {
      setBusy("");
    }
  }

  function editDav(field: "url" | "username" | "password", value: string) {
    editing.current.dav = true;
    setDavDirty(true);
    setTestResult(null);
    setDav((current) => ({ ...current, [field]: value }));
  }

  async function runNow() {
    setBusy("run");
    setActionError("");
    try {
      applyStatus(await runSyncNowApi(API_PREFIX));
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setBusy("");
    }
  }

  async function pickFolder() {
    if (!desktop) return;
    try {
      const picked = await desktop.pickDirectory({
        title: "选择同步文件夹（网盘里的文件夹）",
        defaultPath: status?.folder || undefined,
      });
      if (picked) {
        setFolderDraft(picked);
        await save({ folder: picked, transport: "folder" });
      }
    } catch (error) {
      setActionError(errorText(error));
    }
  }

  function commitFolder() {
    editing.current.folder = false;
    const value = folderDraft.trim();
    if (value !== (status?.folder || "") || status?.transport !== "folder") {
      save({ folder: value, transport: "folder" });
    }
  }

  function commitName() {
    editing.current.name = false;
    const value = nameDraft.trim();
    if (value && value !== status?.device_name) save({ device_name: value });
  }

  const summary = describeSyncStatus(status);
  const pending = describePending(status);
  const maintenance = describeMaintenance(status);
  const enabled = Boolean(status?.enabled);
  const peers = status?.peers || [];
  const view: Transport = transport || "folder";
  const savedTransport: Transport = status?.transport === "webdav" ? "webdav" : "folder";
  const switching = Boolean(status) && view !== savedTransport && targetReady(status);

  return (
    <div className="sync-settings" id="sync-settings-panel">
      <section className="sync-settings-status" aria-live="polite">
        <span className={`sync-settings-dot is-${summary.tone}`} aria-hidden="true" />
        <p className="sync-settings-headline">{summary.headline}</p>
        {summary.detail ? (
          <p className={summary.tone === "error" ? "sync-settings-detail is-error" : "sync-settings-detail"}>
            {summary.detail}
          </p>
        ) : null}
        {pending ? <p className="sync-settings-detail">{pending}</p> : null}
        {maintenance ? <p className="sync-settings-detail">{maintenance}</p> : null}
      </section>

      <div className="sync-settings-switch" role="radiogroup" aria-label="同步方式">
        {([["folder", "网盘文件夹"], ["webdav", "WebDAV"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={view === value}
            className={view === value ? "sync-settings-switch-option is-current" : "sync-settings-switch-option"}
            onClick={() => { setTransport(value); setTestResult(null); }}
            data-sync-transport={value}
          >
            {label}
          </button>
        ))}
      </div>
      {switching ? (
        <p className="sync-settings-hint">
          现在用的是{savedTransport === "webdav" ? " WebDAV" : "网盘文件夹"}；保存后改用{view === "webdav" ? " WebDAV" : "网盘文件夹"}，书库会重新全部放进新的位置。
        </p>
      ) : null}

      {view === "folder" ? (
      <label className="sync-settings-field">
        <span className="sync-settings-label">同步文件夹</span>
        <span className="sync-settings-row">
          <input
            className="sync-settings-input"
            aria-label="同步文件夹"
            placeholder={desktop ? "点「选择」挑一个网盘里的文件夹" : "后端所在电脑上的文件夹路径"}
            value={folderDraft}
            onFocus={() => { editing.current.folder = true; }}
            onChange={(event) => setFolderDraft(event.target.value)}
            onBlur={commitFolder}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            disabled={busy === "save"}
          />
          {desktop ? (
            <button type="button" className="sync-settings-button" onClick={pickFolder} disabled={Boolean(busy)}>
              选择…
            </button>
          ) : null}
        </span>
        <p className="sync-settings-hint">
          选 iCloud、坚果云、Dropbox 等网盘里的一个文件夹，几台电脑选同一个。
          {status?.sync_root && status.folder && !status.sync_root.endsWith("/RetainPDF-Sync")
            ? ` 这个文件夹本身就是同步文件夹，直接使用。`
            : " 会在里面建一个 RetainPDF-Sync 文件夹存放同步数据。"}
        </p>
      </label>
      ) : (
        <section className="sync-settings-field" aria-label="WebDAV 设置">
          <label className="sync-settings-field">
            <span className="sync-settings-label">WebDAV 地址</span>
            <input
              className="sync-settings-input"
              aria-label="WebDAV 地址"
              placeholder="http://群晖地址:5005/webdav/retainpdf"
              value={dav.url}
              onChange={(event) => editDav("url", event.target.value)}
              disabled={busy === "save"}
            />
          </label>
          <div className="sync-settings-row">
            <label className="sync-settings-field sync-settings-grow">
              <span className="sync-settings-label">账号</span>
              <input
                className="sync-settings-input"
                aria-label="WebDAV 账号"
                autoComplete="username"
                value={dav.username}
                onChange={(event) => editDav("username", event.target.value)}
                disabled={busy === "save"}
              />
            </label>
            <label className="sync-settings-field sync-settings-grow">
              <span className="sync-settings-label">密码</span>
              <input
                className="sync-settings-input"
                aria-label="WebDAV 密码"
                type="password"
                autoComplete="new-password"
                placeholder={status?.webdav_has_password ? "已保存，留空不改" : ""}
                value={dav.password}
                onChange={(event) => editDav("password", event.target.value)}
                disabled={busy === "save"}
              />
            </label>
          </div>
          <p className="sync-settings-hint">
            群晖、威联通、Nextcloud、坚果云等。地址填同步文件夹本身（不存在会自动建）；坚果云要用网页上生成的「应用密码」。
            密码只存在这台电脑上，不会同步出去。
          </p>
          <div className="sync-settings-actions">
            <button
              type="button"
              className="sync-settings-button"
              onClick={testDav}
              disabled={Boolean(busy) || !dav.url.trim()}
              data-sync-action="test"
            >
              {busy === "test" ? "正在测试…" : "测试连接"}
            </button>
            <button
              type="button"
              className="sync-settings-button is-primary"
              onClick={saveDav}
              disabled={Boolean(busy) || !dav.url.trim() || (!davDirty && savedTransport === "webdav")}
              data-sync-action="save-webdav"
            >
              保存
            </button>
          </div>
          {testResult ? (
            <p className={testResult.ok ? "sync-settings-hint is-ok" : "sync-settings-error"} role="status">{testResult.text}</p>
          ) : null}
        </section>
      )}

      <label className="sync-settings-field">
        <span className="sync-settings-label">这台电脑的名字</span>
        <input
          className="sync-settings-input"
          aria-label="这台电脑的名字"
          value={nameDraft}
          onFocus={() => { editing.current.name = true; }}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          disabled={busy === "save"}
        />
      </label>

      <div className="sync-settings-actions">
        <button
          type="button"
          className={enabled ? "sync-settings-button" : "sync-settings-button is-primary"}
          onClick={() => save({ enabled: !enabled })}
          disabled={Boolean(busy) || !status || (!enabled && !targetReady(status))}
          data-sync-action="toggle"
        >
          {enabled ? "关闭同步" : "开启同步"}
        </button>
        {enabled ? (
          <button
            type="button"
            className="sync-settings-button is-primary"
            onClick={runNow}
            disabled={Boolean(busy) || Boolean(status?.running)}
            data-sync-action="run"
          >
            {busy === "run" || status?.running ? "正在同步…" : "立即同步"}
          </button>
        ) : null}
      </div>
      {actionError ? <p className="sync-settings-error" role="alert">{actionError}</p> : null}

      <section className="sync-settings-field">
        <span className="sync-settings-label">其它设备</span>
        {peers.length ? (
          <ul className="sync-settings-peers">
            {peers.map((peer) => (
              <li key={peer.device_id}>{peer.name || `设备 ${peer.device_id.slice(0, 6)}`}</li>
            ))}
          </ul>
        ) : (
          <p className="sync-settings-hint">还没有。在另一台电脑上选同一个网盘文件夹（或填同一个 WebDAV 地址）并开启同步即可。</p>
        )}
        <p className="sync-settings-hint">API Key 不会同步，每台电脑各自填写。渲染中间文件也不同步，需要时各自重新生成。</p>
      </section>
    </div>
  );
}
