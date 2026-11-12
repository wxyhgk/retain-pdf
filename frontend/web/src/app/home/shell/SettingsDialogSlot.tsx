// 设置弹窗的页面侧绑定（从 HomeApp 拆出来）：分栏表在 settings-sections.tsx，
// 这里只接开合状态和「打开接口设置」事件。

import { useHomeSettingsHub } from "../home-services-context.js";
import { SettingsDialog } from "@/features/settings/index.js";
import { useAppEvent } from "@/ui/hooks/use-app-event.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { useHomeSettingsSections } from "./settings-sections.jsx";

export function SettingsDialogSlot() {
  const settingsHub = useHomeSettingsHub();
  const sections = useHomeSettingsSections();

  // 「打开接口设置」只有这一个落点了。首次配置门曾经另开一个独立弹窗
  // （CredentialsDialog），于是同一件事有两个长得不一样的壳；现在两条路都是
  // 本弹窗停在 api 分栏，区别只在 payload.setupMode。
  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    settingsHub?.dialogStore?.open?.({ tab: "api", setupMode: Boolean(detail.setupMode) });
  });

  return <SettingsDialog dialogStore={settingsHub.dialogStore} sections={sections} />;
}
