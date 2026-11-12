// 设置弹窗里「外观」这一栏的登记（格式见 ui/settings/settings-section.ts）。
import type { SettingsSection } from "@/ui/settings/settings-section.js";
import { IconPalette } from "./settings-icons.jsx";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel.jsx";

export const appearanceSettingsSection: SettingsSection = {
  id: "appearance",
  label: "外观",
  Icon: IconPalette,
  order: 90,
  description: "选择界面配色，立即生效并记住本机选择。",
  // 纯本地状态，一直挂着（测试契约 #theme-appearance-panel 在切过来之前就要能找到）。
  lazy: false,
  render: () => <ThemeAppearancePanel />,
};
