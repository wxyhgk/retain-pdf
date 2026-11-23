// 设置弹窗的分栏表：首页按这张表画设置弹窗（外壳 SettingsDialog 不知道有哪些分栏）。
//
// 加一个分栏：在功能目录里写好它的那一项（格式 ui/settings/settings-section.ts，例子 features/sync/ui/settings-section.tsx），
// 从功能出口导出，再在下面 FEATURE_SECTIONS 里加一行。要主页服务才拼得出的分栏（接口设置、术语表、更新、账户、
// 账号管理）在 useHomeSettingsSections 里拼。谁能看见也在这里定：多用户的普通用户看不到单机才有的分栏。
// 方案见 docs/ops/planning/frontend-migration/20261112-功能登记表.md。

import { useMemo } from "react";
import type { SettingsSection } from "@/ui/settings/settings-section.js";
import { AppUpdateBanner, AppUpdateSettingsIcon } from "@/features/app-update/index.js";
import { CredentialsSettingsIcon, CredentialsWorkbench } from "@/features/credentials/index.js";
import { CREDENTIAL_DOM_IDS } from "@/features/credentials/ui/credentials-dom-ids.js";
import { GlossariesSettingsIcon } from "@/features/glossaries/index.js";
import { APP_SETTINGS_DIALOG_IDS, CommandLinePanel, appearanceSettingsSection } from "@/features/settings/index.js";
import { backupSettingsSection } from "@/features/backup/index.js";
import { syncSettingsSection } from "@/features/sync/index.js";
import { lanShareSettingsSection } from "@/features/lan-share/index.js";
import { isDesktopHostAvailable } from "@/platform/desktop/host.js";
import { isLanSharedPage } from "@/platform/config/runtime.js";
import { usageSettingsSection } from "@/features/usage/index.js";
import { notifySettingsSection } from "@/features/notify/index.js";
import { AdminConsoleEntry, AdminSettingsIcon } from "@/features/admin/index.js";
import { AccountPanel, AccountSettingsIcon, hiddenSettingsTabs, isAdmin, isMultiUser, useAuthSession } from "@/features/auth/index.js";
import { Button } from "@retainpdf/ui";
import { useHomeAppUpdate, useHomeCredentials, useHomeGlossaries } from "../home-services-context.js";

/** 功能自己登记好的分栏（不要主页服务）。加一个这样的分栏 = 这里加一行。 */
const FEATURE_SECTIONS: readonly SettingsSection[] = [
  usageSettingsSection,
  syncSettingsSection,
  backupSettingsSection,
  notifySettingsSection,
  appearanceSettingsSection,
];

function AppUpdateBannerSlot() {
  const appUpdate = useHomeAppUpdate();
  return <AppUpdateBanner view={appUpdate.view} handlersRef={appUpdate.handlersRef} />;
}

export function useHomeSettingsSections(): SettingsSection[] {
  const glossaries = useHomeGlossaries();
  const credentials = useHomeCredentials();
  const session = useAuthSession();
  const multi = isMultiUser(session);
  const admin = isAdmin(session);

  return useMemo(() => {
    const sections: SettingsSection[] = [
      ...(multi ? [{
        id: "account",
        guide: null,
        label: "账户",
        Icon: AccountSettingsIcon,
        order: 10,
        description: "当前登录的账号。",
        render: () => <AccountPanel />,
      }] : []),
      ...(multi && admin ? [{
        id: "admin",
        guide: null,
        label: "账号管理",
        Icon: AdminSettingsIcon,
        order: 20,
        description: "账号由管理员创建，初始密码交给用户，用户首次登录时改成自己的密码。",
        render: () => <AdminConsoleEntry />,
      }] : []),
      {
        id: "api",
        guide: "credentials",
        label: "接口设置",
        Icon: CredentialsSettingsIcon,
        order: 30,
        // 首次配置门：本弹窗停在这一栏，多一句引导（id 是凭据测试的契约）。
        subtitle: ({ setupMode }) => (setupMode
          ? <p id={CREDENTIAL_DOM_IDS.browser.subtitle} className="muted">先配好接口再开始</p>
          : null),
        // 表单要先挂上才能回填，一直挂着。多用户下是平台接口的入口。
        lazy: false,
        render: () => (multi ? <AdminConsoleEntry section="platform" /> : <CredentialsWorkbench />),
        onShow: multi ? undefined : (options) => credentials?.feature?.prepareCredentialsPanels?.(options),
      },
      {
        id: "glossary",
        guide: "glossaries",
        label: "术语表",
        Icon: GlossariesSettingsIcon,
        order: 40,
        description: "维护术语偏好，翻译时优先使用你的术语。",
        lazy: false,
        render: () => (
          <div className="app-settings-launcher">
            <p>
              术语表决定翻译时的优先译法。可维护多张术语表并
              按需启用，翻译任务发起时生效。
            </p>
            <Button variant="primary" id={APP_SETTINGS_DIALOG_IDS.glossaryButton} onClick={() => glossaries.dialogStore.open()}>
              打开术语表
            </Button>
          </div>
        ),
      },
      ...FEATURE_SECTIONS,
      // 局域网共享只有桌面版单机有：网页版、多用户本身就是服务器。
      ...(!multi && isDesktopHostAvailable() ? [lanShareSettingsSection] : []),
      {
        id: "update",
        guide: "app-update",
        label: "更新",
        Icon: AppUpdateSettingsIcon,
        order: 100,
        description: "查看当前版本，并从 GitHub Releases 重新检查更新。",
        // 更新横幅一直挂着（#app-update-btn 是测试契约，后台自检和它挂不挂无关）；命令行工具只在选中时画。
        lazy: false,
        render: ({ active }) => (
          <>
            <AppUpdateBannerSlot />
            {active ? <CommandLinePanel /> : null}
          </>
        ),
      },
    ];
    const hidden = new Set(hiddenSettingsTabs(session));
    // 经桌面版局域网共享打开：同步、备份的接口在局域网上不开放（frontend/desktop/src/main/lan-share.js 的 LAN_BLOCKED），
    // 这两栏只能在那台电脑上用。
    if (isLanSharedPage()) {
      hidden.add(syncSettingsSection.id);
      hidden.add(backupSettingsSection.id);
    }
    return sections.filter(({ id }) => !hidden.has(id));
  }, [multi, admin, session, glossaries, credentials]);
}
