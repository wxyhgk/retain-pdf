// 设置 → 备份：书库数据库的备份列表、立即备份、恢复、删除手动备份。
//
// 状态从后端读（GET /api/v1/backups）。恢复要先点一次「恢复」再确认；后端先自动存一份
// 「恢复前」备份、有任务在跑时拒绝（原因显示出来）。恢复成功后整页刷新，界面上的书库
// 数据全部按恢复后的重新读。桌面版能打开备份所在的文件夹。

import { useCallback, useEffect, useState } from "react";
import {
  createBackupApi,
  deleteBackupApi,
  fetchBackupStatusApi,
  restoreBackupApi,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { getDesktopHost } from "@/platform/desktop/host.js";
import type { BackupItem, BackupStatus } from "@retainpdf/api/backups";
import { backupTime, describeAuto, formatSize, kindLabel } from "../domain/describe.js";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : `${error || "操作失败"}`;
}

function reloadPage() {
  window.location.reload();
}

export function BackupPanel({ onRestored = reloadPage }: { onRestored?: () => void } = {}) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<"" | "create" | "restore" | "delete">("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const desktop = getDesktopHost();

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchBackupStatusApi(API_PREFIX));
    } catch (error) {
      setMessage({ ok: false, text: errorText(error) });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createNow() {
    setBusy("create");
    setMessage(null);
    try {
      const made = await createBackupApi(API_PREFIX);
      setMessage({ ok: true, text: `已备份（${formatSize(made.bytes)}）。` });
      await refresh();
    } catch (error) {
      setMessage({ ok: false, text: errorText(error) });
    } finally {
      setBusy("");
    }
  }

  async function restore(id: string) {
    setBusy("restore");
    setMessage(null);
    try {
      await restoreBackupApi(API_PREFIX, id);
      setConfirming(null);
      setMessage({ ok: true, text: "已恢复，正在刷新…" });
      onRestored();
    } catch (error) {
      setConfirming(null);
      setMessage({ ok: false, text: errorText(error) });
      await refresh();
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    setBusy("delete");
    setMessage(null);
    try {
      setStatus(await deleteBackupApi(API_PREFIX, id));
    } catch (error) {
      setMessage({ ok: false, text: errorText(error) });
    } finally {
      setBusy("");
    }
  }

  async function openFolder() {
    try {
      await desktop?.openBackupDirectory();
    } catch (error) {
      setMessage({ ok: false, text: errorText(error) });
    }
  }

  const items: BackupItem[] = status?.items || [];
  const blockers: string[] = status?.restore_blockers || [];

  return (
    <div className="backup-settings" data-backup-panel>
      <p className="backup-settings-hint">
        {status ? describeAuto(status.auto_interval_hours, status.last_auto_at) : "正在读取…"}
        {" "}最近 7 天每天留一份，更早的每周留一份、留 4 周；数据库升级前也会自动存一份。
      </p>

      <div className="backup-settings-actions">
        <button
          type="button"
          className="backup-settings-button is-primary"
          onClick={createNow}
          disabled={Boolean(busy) || Boolean(status?.running)}
          data-backup-action="create"
        >
          {busy === "create" ? "正在备份…" : "立即备份"}
        </button>
        {desktop ? (
          <button type="button" className="backup-settings-button" onClick={openFolder} data-backup-action="open-folder">
            打开备份文件夹
          </button>
        ) : null}
      </div>
      {message ? (
        <p className={message.ok ? "backup-settings-hint is-ok" : "backup-settings-error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}

      <section className="backup-settings-field" aria-label="备份列表">
        <span className="backup-settings-label">备份</span>
        {items.length ? (
          <ul className="backup-settings-list">
            {items.map((item) => (
              <li key={item.id} className="backup-settings-item" data-backup-id={item.id}>
                <span className="backup-settings-item-main">
                  <span className="backup-settings-item-time">{backupTime(item.created_at)}</span>
                  <span className="backup-settings-item-meta">
                    {kindLabel(item.kind)} · {formatSize(item.bytes)}
                  </span>
                </span>
                {confirming === item.id ? (
                  <span className="backup-settings-confirm">
                    <span className="backup-settings-confirm-text">书库会回到这个时刻，当前的会先自动备份一份。</span>
                    <button
                      type="button"
                      className="backup-settings-button is-danger"
                      onClick={() => restore(item.id)}
                      disabled={Boolean(busy)}
                      data-backup-action="confirm-restore"
                    >
                      {busy === "restore" ? "正在恢复…" : "确定恢复"}
                    </button>
                    <button
                      type="button"
                      className="backup-settings-button"
                      onClick={() => setConfirming(null)}
                      disabled={busy === "restore"}
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <span className="backup-settings-item-actions">
                    <button
                      type="button"
                      className="backup-settings-button"
                      onClick={() => { setConfirming(item.id); setMessage(null); }}
                      disabled={Boolean(busy) || blockers.length > 0}
                      title={blockers.length ? `${blockers.join("，")}，结束后再恢复` : undefined}
                      data-backup-action="restore"
                    >
                      恢复
                    </button>
                    {item.kind === "manual" ? (
                      <button
                        type="button"
                        className="backup-settings-button"
                        onClick={() => remove(item.id)}
                        disabled={Boolean(busy)}
                        data-backup-action="delete"
                      >
                        删除
                      </button>
                    ) : null}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="backup-settings-hint">还没有备份。</p>
        )}
        {blockers.length ? (
          <p className="backup-settings-hint">{blockers.join("，")}，结束后才能恢复。</p>
        ) : null}
      </section>

      <p className="backup-settings-hint">
        备份的是书库数据库：书目、阅读状态、收藏、AI 对话、术语表、任务记录等。原文、译文、成品 PDF 这些文件不在备份里，恢复也不会动它们。
        开着同步时，恢复后会把同步文件夹里比备份新的改动重新收回来。
        {status?.dir ? ` 备份放在 ${status.dir}。` : ""}
      </p>
    </div>
  );
}
