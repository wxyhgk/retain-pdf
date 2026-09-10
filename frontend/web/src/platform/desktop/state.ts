// 桌面 / 开发者配置的状态片，以及 desktop bootstrap 使用的单例。
//
// 由 `src/js/state/` 塌缩而来（批次 5B 的 B10）。原先那里是一个 8 片合并的全局
// 可变单例 `createInitialState()`，实测其中 6 片（job / upload / credential /
// home / recent-jobs / timer）在生产代码里零消费方——那些能力早已在
// `features/*` 用 `platform/store` 独立重建，单例这一份是从未被读写的死代码。
// 三层实证见提交信息。
//
// 剩下的 desktop / developer 两片保留在这里：唯一消费方是
// `app/desktop/bootstrap.ts`（读写 desktopBootstrapState）与主页装配层的三个
// 工厂（只用纯函数，各自喂自己的 state 对象）。
//
// 函数签名与实现逐字保留，未借迁移改写状态模型。

export function createDesktopState() {
  return {
    desktopMode: false,
    desktopConfigured: false,
  };
}

export function setDesktopMode(target, value = true) {
  target.desktopMode = Boolean(value);
}

export function setDesktopConfigured(target, value = false) {
  target.desktopConfigured = Boolean(value);
}

export function isDesktopMode(target) {
  return Boolean(target.desktopMode);
}

export function isDesktopConfigured(target) {
  return Boolean(target.desktopConfigured);
}

export function createDeveloperState() {
  return {
    developerConfig: {},
  };
}

export function setDeveloperConfig(target, config = {}) {
  target.developerConfig = config && typeof config === "object" ? { ...config } : {};
}

export function resetDeveloperConfig(target) {
  target.developerConfig = {};
}

export function getDeveloperConfig(target) {
  return target.developerConfig && typeof target.developerConfig === "object"
    ? target.developerConfig
    : {};
}

// 桌面首启流程读写的单例，顶替原 `js/state/store.ts` 的 `state`。
// 只含上面两片——原单例的另外 6 片已确证为死代码并删除。
export const desktopBootstrapState = {
  ...createDesktopState(),
  ...createDeveloperState(),
};
