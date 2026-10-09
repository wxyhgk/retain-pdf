/** 设置 → 更新 → 命令行工具：只在桌面版、且包里有命令行时出现；安装结果与提示显示出来。 */
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom } from "../helpers/dom.mjs";

test("安装命令行工具：装到哪里、终端找不到时怎么办，都说清楚", async () => {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "Event", "MouseEvent", "Node", "MutationObserver"] });
  const calls = [];
  let installed = "";
  dom.window.retainPdfDesktop = {
    invoke: async (command) => {
      calls.push(command);
      if (command === "cli_status") return { available: true, installedAt: installed, supported: true };
      if (command === "install_cli") {
        installed = "/Users/me/.local/bin/retainpdf";
        return { ok: true, path: installed, onPath: false, hint: "终端还找不到它：把 export PATH=\"/Users/me/.local/bin:$PATH\" 加到 ~/.zshrc，再开一个新终端。" };
      }
      throw new Error(`unexpected ${command}`);
    },
  };
  globalThis.window.retainPdfDesktop = dom.window.retainPdfDesktop;
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { CommandLinePanel } = await import("../../src/features/settings/ui/CommandLinePanel.jsx");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(CommandLinePanel));

  await waitFor(() => host.querySelector('[data-cli-action="install"]'));
  assert.equal(host.querySelector('[data-cli-action="install"]').textContent, "安装命令行工具");
  click(dom, host.querySelector('[data-cli-action="install"]'));
  await waitFor(() => host.textContent.includes("已安装到 /Users/me/.local/bin/retainpdf"));
  assert.match(host.textContent, /export PATH=/);
  await waitFor(() => host.querySelector('[data-cli-action="install"]').textContent === "重新安装");
  assert.deepEqual(calls.filter((c) => c === "install_cli").length, 1);
  root.unmount();
  dom.window.close();
});
