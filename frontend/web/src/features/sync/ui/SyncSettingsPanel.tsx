// 设置 → 同步：几台电脑通过一个网盘文件夹同步书库。
//
// 状态从后端读（GET /api/v1/sync），面板开着时定时刷新；改设置立即保存
// （PUT /api/v1/sync），后端改完马上跑一轮。桌面版能弹系统的文件夹选择框，
// 网页版手填路径（后端所在机器上的路径）。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSyncStatusApi,
  runSyncNowApi,
  updateSyncSettingsApi,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { getDesktopHost } from "@/platform/desktop/host.js";
import { describePending, describeSyncStatus } from "../domain/describe.js";

type SyncStatus = Awaited<ReturnType<typeof fetchSyncStatusApi>>;

const POLL_IDLE_MS = 15_000;
const POLL_BUSY_MS = 2_000;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : `${error || "操作失败"}`;
}

export function SyncSettingsPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [actionError, setActionError] = useState("");
  const desktop = getDesktopHost();
  const editing = useRef({ folder: false, name: false });

  const applyStatus = useCallback((next: SyncStatus) => {
    setStatus(next);
    if (!editing.current.folder) setFolderDraft(next?.folder || "");
    if (!editing.current.name) setNameDraft(next?.device_name || "");
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

  async function save(payload: { enabled?: boolean; folder?: string; device_name?: string }) {
    setBusy("save");
    setActionError("");
    try {
      applyStatus(await updateSyncSettingsApi(API_PREFIX, payload));
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setBusy("");
    }
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
        await save({ folder: picked });
      }
    } catch (error) {
      setActionError(errorText(error));
    }
  }

  function commitFolder() {
    editing.current.folder = false;
    const value = folderDraft.trim();
    if (value !== (status?.folder || "")) save({ folder: value });
  }

  function commitName() {
    editing.current.name = false;
    const value = nameDraft.trim();
    if (value && value !== status?.device_name) save({ device_name: value });
  }

  const summary = describeSyncStatus(status);
  const pending = describePending(status);
  const enabled = Boolean(status?.enabled);
  const peers = status?.peers || [];

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
      </section>

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
          disabled={Boolean(busy) || !status || (!enabled && !status?.folder)}
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
          <p className="sync-settings-hint">还没有。在另一台电脑上选同一个网盘文件夹并开启同步即可。</p>
        )}
        <p className="sync-settings-hint">API Key 不会同步，每台电脑各自填写。渲染中间文件也不同步，需要时各自重新生成。</p>
      </section>
    </div>
  );
}
