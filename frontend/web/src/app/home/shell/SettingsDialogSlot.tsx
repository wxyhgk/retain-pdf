// 设置弹窗的页面侧绑定（从 HomeApp 拆出来，那个文件逼近 380 行上限）：把主页的服务
// 上下文接到 SettingsDialog 的各个分栏插槽上。为什么是插槽而不是设置功能自己 import，
// 见 features/settings/ui/SettingsDialog.tsx 的说明。

import {
  useHomeAppUpdate,
  useHomeCredentials,
  useHomeGlossaries,
  useHomeSettingsHub,
} from "../home-services-context.js";
import { AppUpdateBanner } from "@/features/app-update/index.js";
import { CredentialsWorkbench } from "@/features/credentials/index.js";
import { CREDENTIAL_DOM_IDS } from "@/features/credentials/ui/credentials-dom-ids.js";
import { SettingsDialog } from "@/features/settings/index.js";
import { BackupPanel } from "@/features/backup/index.js";
import { SyncSettingsPanel } from "@/features/sync/index.js";
import { UsageSettingsPanel } from "@/features/usage/index.js";
import { NotifySettingsPanel } from "@/features/notify/index.js";
import { AdminConsoleEntry } from "@/features/admin/index.js";
import { AccountPanel, hiddenSettingsTabs, isAdmin, isMultiUser, useAuthSession } from "@/features/auth/index.js";
import { useAppEvent } from "@/ui/hooks/use-app-event.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";

function AppUpdateBannerSlot() {
  const appUpdate = useHomeAppUpdate();
  return <AppUpdateBanner view={appUpdate.view} handlersRef={appUpdate.handlersRef} />;
}

export function SettingsDialogSlot() {
  const settingsHub = useHomeSettingsHub();
  const glossaries = useHomeGlossaries();
  const credentials = useHomeCredentials();
  const session = useAuthSession();
  const multi = isMultiUser(session);
  const admin = isAdmin(session);

  // 「打开接口设置」只有这一个落点了。首次配置门曾经另开一个独立弹窗
  // （CredentialsDialog），于是同一件事有两个长得不一样的壳；现在两条路都是
  // 本弹窗停在 api tab，区别只在 payload.setupMode。
  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    settingsHub?.dialogStore?.open?.({ tab: "api", setupMode: Boolean(detail.setupMode) });
  });

  return (
    <SettingsDialog
      dialogStore={settingsHub.dialogStore}
      onOpenGlossaries={() => glossaries.dialogStore.open()}
      onPrepareCredentialPanels={(options) => (multi ? undefined : credentials?.feature?.prepareCredentialsPanels?.(options))}
      credentialsWorkbenchSlot={multi ? <AdminConsoleEntry section="platform" /> : <CredentialsWorkbench />}
      apiPaneSetupHintSlot={
        <p id={CREDENTIAL_DOM_IDS.browser.subtitle} className="muted">先配好接口再开始</p>
      }
      appUpdateBannerSlot={<AppUpdateBannerSlot />}
      syncPanelSlot={<SyncSettingsPanel />}
      backupPanelSlot={<BackupPanel />}
      usagePanelSlot={<UsageSettingsPanel />}
      notifyPanelSlot={<NotifySettingsPanel />}
      accountPanelSlot={multi ? <AccountPanel /> : null}
      adminPanelSlot={multi && admin ? <AdminConsoleEntry /> : null}
      hiddenTabs={hiddenSettingsTabs(session)}
    />
  );
}
