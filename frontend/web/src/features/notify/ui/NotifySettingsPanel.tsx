// 设置 → 通知：任务跑完时弹不弹系统通知，网页版顺带要授权、发一条试试。

import { useState } from "react";
import { Button, Checkbox } from "@retainpdf/ui";
import { getDesktopHost } from "@/platform/desktop/host.js";
import { readJobFinishNotifyEnabled, writeJobFinishNotifyEnabled } from "../domain/notify-prefs.js";

type PermissionApi = {
  permission: string;
  requestPermission?: () => Promise<string>;
  new (title: string, options?: { body?: string; tag?: string }): unknown;
};

function notificationApi(): PermissionApi | null {
  const api = (globalThis as { Notification?: PermissionApi }).Notification;
  return typeof api === "function" ? api : null;
}

function permissionHint(permission: string, desktop: boolean): string {
  if (permission === "granted") return desktop ? "" : "浏览器已允许本站弹通知。";
  if (permission === "denied") {
    return desktop
      ? "系统设置里关掉了本程序的通知，要在系统的「通知」设置里打开。"
      : "浏览器拒绝了本站的通知，要在地址栏左边的网站设置里改成允许。";
  }
  return "还没允许本站弹通知，点下面的按钮允许。";
}

export function NotifySettingsPanel() {
  const api = notificationApi();
  const desktop = Boolean(getDesktopHost());
  const [enabled, setEnabled] = useState(() => readJobFinishNotifyEnabled());
  const [permission, setPermission] = useState(() => api?.permission || "unsupported");
  const [message, setMessage] = useState("");

  function toggle(next: boolean) {
    setEnabled(next);
    writeJobFinishNotifyEnabled(next);
    setMessage("");
  }

  async function requestPermission() {
    if (!api?.requestPermission) return;
    try {
      setPermission(await api.requestPermission());
    } catch {
      setPermission(api.permission);
    }
  }

  function sendTest() {
    if (!api) return;
    try {
      new api("通知能用了", { body: "任务跑完时会像这样提醒你。", tag: "retainpdf-notify-test" });
      setMessage("已发出一条测试通知。没看到的话，看看系统是不是开了勿扰。");
    } catch {
      setMessage("这个浏览器不支持在页面里直接弹通知。");
    }
  }

  return (
    <div className="notify-settings" data-notify-panel>
      <Checkbox
        className="notify-settings-toggle"
        label="任务跑完时弹系统通知"
        checked={enabled}
        onChange={(event) => toggle(event.target.checked)}
        data-notify-toggle
      />
      <p className="notify-settings-hint">
        {"正看着这个页面时只在页面里提示；切到别处时弹系统通知，标签页标题前面也会出现 ✓ / ✗。"}
        {"自己取消的任务不提醒。要开着 RetainPDF 的页面（桌面版缩在托盘里也算）才提醒得到。"}
      </p>

      {api ? (
        <>
          {permissionHint(permission, desktop) ? (
            <p className="notify-settings-hint" data-notify-permission={permission}>
              {permissionHint(permission, desktop)}
            </p>
          ) : null}
          <div className="notify-settings-actions">
            {permission === "default" && api.requestPermission ? (
              <Button variant="primary" onClick={requestPermission} data-notify-action="allow">
                允许通知
              </Button>
            ) : null}
            {permission === "granted" ? (
              <Button variant="secondary" onClick={sendTest} disabled={!enabled} data-notify-action="test">
                发一条试试
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="notify-settings-hint">这个浏览器不支持系统通知，跑完时只在页面里提示。</p>
      )}
      {message ? <p className="notify-settings-hint" role="status">{message}</p> : null}
    </div>
  );
}
