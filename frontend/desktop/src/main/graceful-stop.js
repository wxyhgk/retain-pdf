// 退出时按「先 SIGTERM、超时再 SIGKILL」结束本地服务子进程（仅 POSIX）。
// rust_api 收到 SIGTERM 会自己有序收尾：依次结束 jobsd 和 AI 服务（每个最多等
// RUST_API_WORKER_TERMINATE_GRACE_SECS，默认 3 秒），所以默认给 10 秒。
// Windows 没有可用的 SIGTERM，调用方继续用 taskkill /T /F。

const DEFAULT_GRACE_MS = 10000;
// SIGKILL 之后再等 exit 事件的上限：正常立刻就到，只防事件丢失时卡住退出。
const AFTER_KILL_WAIT_MS = 2000;

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

// 返回 Promise<"exited" | "killed" | "gone">，从不 reject。
//   exited：SIGTERM 后在宽限期内自己退出
//   killed：超时后发了 SIGKILL
//   gone：调用时进程已经不在了
function stopChildGracefully(child, options = {}) {
  const graceMs = Number.isFinite(options.graceMs) ? options.graceMs : DEFAULT_GRACE_MS;
  const afterKillWaitMs = Number.isFinite(options.afterKillWaitMs) ? options.afterKillWaitMs : AFTER_KILL_WAIT_MS;
  const logger = options.logger || console;
  const label = options.label || `pid ${child?.pid}`;

  return new Promise((resolve) => {
    if (!child || !child.pid || hasExited(child)) {
      resolve("gone");
      return;
    }
    let outcome = "exited";
    let graceTimer = null;
    let afterKillTimer = null;
    const finish = () => {
      clearTimeout(graceTimer);
      clearTimeout(afterKillTimer);
      child.removeListener("exit", finish);
      resolve(outcome);
    };
    child.once("exit", finish);

    try {
      child.kill("SIGTERM");
    } catch (error) {
      logger.warn(`[desktop] failed to send SIGTERM to ${label}: ${error?.message || error}`);
    }
    graceTimer = setTimeout(() => {
      outcome = "killed";
      logger.warn(`[desktop] ${label} did not exit within ${graceMs}ms after SIGTERM; sending SIGKILL`);
      try {
        child.kill("SIGKILL");
      } catch (error) {
        logger.warn(`[desktop] failed to send SIGKILL to ${label}: ${error?.message || error}`);
      }
      afterKillTimer = setTimeout(finish, afterKillWaitMs);
    }, graceMs);
  });
}

module.exports = {
  DEFAULT_GRACE_MS,
  stopChildGracefully,
};
