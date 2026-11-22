// 设置 → 局域网共享（只在桌面版显示）：让同一局域网里的手机、平板、别的电脑用浏览器打开这台电脑上的 RetainPDF。
//
// 开关、地址、二维码、重置访问码都由桌面主进程管（frontend/desktop/src/main/lan-share.js），这里只是调 IPC 画出来。
// 别的设备能用全部功能，翻译和 OCR 用这台电脑上存好的 Key（2026-11-22 用户定的）。

import { useCallback, useEffect, useState } from "react";
import { Button, Checkbox } from "@retainpdf/ui";
import { getDesktopHost, type DesktopLanShareStatus } from "@/platform/desktop/host.js";
import { lanShareHeadline } from "../domain/describe.js";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : `${error || "操作失败"}`;
}

export function LanSharePanel() {
  const desktop = getDesktopHost();
  const [status, setStatus] = useState<DesktopLanShareStatus | null>(null);
  const [busy, setBusy] = useState<"" | "toggle" | "reset">("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const refresh = useCallback(async () => {
    if (!desktop) return;
    try {
      setStatus(await desktop.lanShareStatus());
    } catch {
      // 旧版桌面壳没有这个命令。
      setStatus({ supported: false, enabled: false, running: false, port: 0, urls: [] });
    }
  }, [desktop]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!desktop || !status) return null;
  if (!status.supported) {
    return (
      <section className="lan-share" data-lan-share="unsupported">
        <p className="lan-share-hint">当前连接的是外部后端，局域网共享不可用。</p>
      </section>
    );
  }

  async function run(kind: "toggle" | "reset", action: () => Promise<DesktopLanShareStatus>) {
    setBusy(kind);
    setError("");
    try {
      setStatus(await action());
    } catch (cause) {
      setError(errorText(cause));
      await refresh();
    } finally {
      setBusy("");
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  const host = desktop;
  return (
    <section className="lan-share" data-lan-share={status.running ? "on" : "off"}>
      <div className="lan-share-status">
        <span className={status.running ? "lan-share-dot is-ok" : "lan-share-dot"} aria-hidden="true" />
        <p className="lan-share-headline">{lanShareHeadline(status)}</p>
      </div>

      <Checkbox
        checked={status.enabled}
        disabled={busy !== ""}
        onChange={(event) => {
          const checked = event.currentTarget.checked;
          void run("toggle", () => host.setLanShareEnabled(checked));
        }}
        data-lan-share-action="toggle"
        label="允许局域网里的设备访问"
      />

      <p className="lan-share-hint">
        手机、平板、别的电脑连同一个 Wi‑Fi，扫下面的二维码或打开链接，就能用浏览器看书库、阅读、上传新书。
        翻译和 OCR 用这台电脑上设置好的 Key，费用也记在这些 Key 上。
      </p>
      <p className="lan-share-hint is-warn">
        拿到链接的人能用你的 Key 发起翻译，只发给信任的设备。发错了就点「重置访问码」，之前连上的设备会立刻断开。
      </p>

      {status.running && status.urls.length === 0 ? (
        <p className="lan-share-hint">没找到局域网地址：这台电脑现在好像没连 Wi‑Fi 或网线。</p>
      ) : null}

      {status.running ? status.urls.map((item) => (
        <div className="lan-share-address" key={item.url} data-lan-share-address={item.display}>
          {item.qrSvg ? (
            <img
              className="lan-share-qr"
              alt={`扫码打开 ${item.display}`}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.qrSvg)}`}
            />
          ) : null}
          <div className="lan-share-address-body">
            <p className="lan-share-address-url">{item.display}</p>
            <p className="lan-share-hint">网卡 {item.name}</p>
            <Button variant="secondary" size="sm" onClick={() => void copy(item.url)} data-lan-share-action="copy">
              {copied === item.url ? "已复制" : "复制完整链接"}
            </Button>
          </div>
        </div>
      )) : null}

      {status.enabled ? (
        <Button
          variant="secondary"
          className="lan-share-reset"
          onClick={() => void run("reset", () => host.resetLanShareToken())}
          pending={busy === "reset"}
          data-lan-share-action="reset"
        >
          重置访问码
        </Button>
      ) : null}

      {error ? <p className="lan-share-error" role="alert">{error}</p> : null}
    </section>
  );
}
