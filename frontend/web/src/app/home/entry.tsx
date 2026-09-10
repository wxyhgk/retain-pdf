// home 页生产 React 入口（产物 dist/app.bundle.js，由 index.html 挂载）。
// 启动顺序见 src/pages/shell-boot.ts：adapters → bootTheme → 找根 → 挂载（不开 StrictMode）。
// 业务组装：composition 先建、事件桥先绑、idle 视图先落 store，再一行挂载。

import { DecorStage } from "@/ui/decor/DecorStage.jsx";
import { createHomeComposition } from "./create-home-composition.js";
import { HomeApp } from "./HomeApp.jsx";
import { mountShellPage } from "../shell-boot.js";
import {
  isDesktopMode,
  loadPersistedConfig,
} from "@/platform/config/desktop-persistence.js";
import { bootstrapDesktop } from "@/app/desktop/bootstrap.js";

// appUpdateAutoCheckEnabled: true——create-home-composition 默认关闭后台
// GitHub 自检（测试隔离），生产入口这里显式打开。
async function bootHome() {
  const desktopMode = isDesktopMode();
  let desktopConfig: Awaited<ReturnType<typeof loadPersistedConfig>> | null = null;
  if (desktopMode) {
    try {
      desktopConfig = await loadPersistedConfig();
    } catch (error) {
      console.error("[desktop] failed to restore persisted config", error);
    }
  }

  const services = createHomeComposition({
    appUpdateAutoCheckEnabled: true,
    initialDesktopMode: desktopMode,
    ...(desktopConfig ? {
      loadPersistedBrowserConfig: () => desktopConfig.browserConfig || {},
      loadPersistedDeveloperConfig: () => desktopConfig.developerConfig || {},
    } : {}),
  });
  services.initialize();

  mountShellPage("home-root", <><DecorStage /><HomeApp services={services} /></>, { createIfMissing: true });

  if (desktopMode) {
    await services.features.browserCredentialsFeature.ready();
    try {
      await bootstrapDesktop();
    } catch (error) {
      console.error("[desktop] failed to finish desktop bootstrap", error);
    }
  }
}

void bootHome();
