// 设置 → 更新 →「命令行工具」（只在桌面版显示）：把包里的 retainpdf 装进终端。
//
// 命令行和桌面版共用 ~/.retainpdf/ 里的配置：在终端里 `retainpdf config set …` 改的，
// 应用里马上看得到。

import { useEffect, useState } from "react";
import { getDesktopHost } from "@/platform/desktop/host.js";

type Status = { available: boolean; installedAt: string; supported: boolean };

export function CommandLinePanel() {
  const desktop = getDesktopHost();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!desktop) return;
    desktop.cliStatus().then(setStatus).catch(() => setStatus(null));
  }, [desktop]);

  if (!desktop || !status?.available) return null;

  async function install() {
    if (!desktop) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await desktop.installCli();
      if (result.ok) {
        setMessage({ ok: true, text: [`已安装到 ${result.path}。`, result.hint || "打开终端试试 retainpdf status。"].join("") });
        setStatus(await desktop.cliStatus());
      } else {
        setMessage({ ok: false, text: result.error || "安装失败" });
      }
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : `${error}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cli-install" data-cli-install>
      <h3 className="cli-install-title">命令行工具</h3>
      <p className="cli-install-hint">
        在终端里用 retainpdf 查看状态、备份、同步，或配置接口密钥、模型和并发。配置放在 ~/.retainpdf/，和这里的设置是同一份。
      </p>
      {status.installedAt ? <p className="cli-install-hint">已安装：{status.installedAt}</p> : null}
      {status.supported ? (
        <button type="button" className="cli-install-button" onClick={install} disabled={busy} data-cli-action="install">
          {busy ? "正在安装…" : status.installedAt ? "重新安装" : "安装命令行工具"}
        </button>
      ) : (
        <p className="cli-install-hint">Windows 版暂不支持一键安装。</p>
      )}
      {message ? (
        <p className={message.ok ? "cli-install-hint is-ok" : "cli-install-error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
