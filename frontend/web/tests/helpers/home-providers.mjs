/** 测试里挂主页组件：套上 ui 层的窄口 Provider，以及各功能自带的 Provider。
 *
 * 书架服务已改由 features/library 自带的 LibraryServicesProvider 下发（不再挂在 ui 窄口上），
 * 只套 ui 的 HomeShellProviders 时，用到书架服务的组件会报「需要外层 LibraryServicesProvider」。
 */
export async function withHomeProviders(React, services, child) {
  const { HomeShellProviders } = await import("../../src/ui/context/home-services-context.js");
  const { LibraryServicesProvider } = await import("../../src/features/library/index.js");
  let element = child;
  if (services?.library) {
    element = React.createElement(LibraryServicesProvider, { value: services.library }, element);
  }
  return React.createElement(HomeShellProviders, { services }, element);
}
