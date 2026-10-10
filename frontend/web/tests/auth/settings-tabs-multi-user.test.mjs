// 设置弹窗：多用户普通用户看不到接口设置、同步、备份、更新，多了「账户」；点到被藏的分栏落到第一个能看的。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { DOM_GLOBAL_KEYS, makeDom as makeDomWith } from "../helpers/dom.mjs";

test("普通用户：藏掉单机分栏，多「账户」；要打开「接口设置」时落到「账户」", async () => {
  const dom = makeDomWith("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: [...DOM_GLOBAL_KEYS, "HTMLSelectElement"],
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { SettingsDialog } = await import("../../src/features/settings/ui/SettingsDialog.jsx");
  const { createDialogStore } = await import("../../src/platform/store/dialog-store.js");
  const store = createDialogStore(null);
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(SettingsDialog, {
    dialogStore: store,
    onOpenGlossaries: () => {},
    accountPanelSlot: React.createElement("p", { id: "account-body" }, "账户内容"),
    adminPanelSlot: null,
    hiddenTabs: ["api", "sync", "backup", "update"],
  }));
  store.open({ tab: "api" });
  const doc = dom.window.document;
  await waitFor(() => doc.querySelector("[data-settings-tab]"), "设置弹窗");
  const tabs = [...doc.querySelectorAll("[data-settings-tab]")].map((el) => el.dataset.settingsTab);
  assert.deepEqual(tabs, ["account", "glossary", "usage", "appearance"]);
  await waitFor(() => doc.getElementById("account-body"), "落到账户分栏");
  root.unmount();
});
