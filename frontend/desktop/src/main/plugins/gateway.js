// 网关插件：后端就绪后起同源本地网关，提供 `gateway` 服务 { baseUrl }。
// baseUrl 为空表示没有网关，窗口退回 file:// 加载——起不来时如此，复用外部后端时也如此
// （原来复用外部后端的路径在起网关之前就 return 了，这里照旧，不改行为）。
function createGatewayPlugin({
  buildRuntimeConfig,
  canConnectToPort,
  createLanShare = null,
  createLocalGateway,
  desktopApiKey = "",
  lanShareState = null,
  setLanShare = () => {},
  logDesktop,
  logDesktopError,
  resolveFrontendRoot,
}) {
  async function gateway(ctx) {
    const { apiPort, external } = ctx.backend;
    let baseUrl = "";
    if (external) {
      logDesktop("[desktop] reusing an external backend; local gateway not started (window loads from file)");
    } else {
      try {
        const instance = createLocalGateway({
          frontendRoot: resolveFrontendRoot(),
          getBackendBase: () => `http://127.0.0.1:${apiPort}`,
          // Inline the full runtime config (apiBase + xApiKey + providers):
          // the page carries its own credentials, no IPC ordering risk.
          getRuntimeConfig: buildRuntimeConfig,
          canConnectToPort,
          logger: console,
        });
        baseUrl = await instance.start("127.0.0.1", 40001);
        // 退出时不等它关完：server.close() 要等长连接都断开，等下去可能卡住退出。
        ctx.effect(() => () => {
          void instance.stop();
        }, "local gateway");
        // 局域网共享（src/main/lan-share.js）：和本机网关一起建，设置里打开过的照旧开起来。
        if (createLanShare) {
          const lanShare = createLanShare({
            frontendRoot: () => resolveFrontendRoot(),
            getBackendBase: () => `http://127.0.0.1:${apiPort}`,
            getDesktopApiKey: () => desktopApiKey,
            getRuntimeConfig: buildRuntimeConfig,
            loadState: lanShareState?.load,
            saveState: lanShareState?.save,
            logger: { warn: logDesktop, error: logDesktopError },
          });
          setLanShare(lanShare);
          await lanShare.startIfEnabled();
          ctx.effect(() => () => {
            setLanShare(null);
            void lanShare.stop();
          }, "lan share");
        }
      } catch (error) {
        // Gateway is an optimization: without it windows fall back to loadFile
        // plus IPC runtime config, exactly like before.
        baseUrl = "";
        logDesktopError(`[desktop] local gateway unavailable, falling back to file: ${error?.message || error}`);
      }
    }
    ctx.splash.update(92, "本地服务已就绪", "正在加载主界面");
    ctx.provide("gateway", { baseUrl });
  }
  gateway.inject = ["backend", "splash"];
  return gateway;
}

module.exports = { createGatewayPlugin };
