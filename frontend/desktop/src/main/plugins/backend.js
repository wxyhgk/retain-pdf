// 后端插件：校验运行文件、分配端口、拉起 rust_api、等就绪，然后提供
// `backend` 服务 { apiPort, external }。网关插件依赖它，所以就绪之前网关和窗口都不会启动。
//
// 原来 main.js 里的 backendChild / backendStopping / usingExternalBackend /
// suppressBackendCrashDialog 都收成这里的局部状态。子进程登记在一个 effect 里：插件树 dispose
// （退出）时照原来 before-quit 的规矩收尾——Windows 同步 taskkill，POSIX 先 SIGTERM 等收尾。
//
// 退出可能发生在启动途中。Cordis dispose 一个插件时会先等它的 apply 跑完，再执行 effect 的
// 清理，而等后端就绪最长 90 秒。所以启动里每个等待都和 quitSignal 赛跑：退出时立刻放弃等待，
// 让 apply 结束，子进程随即被清理。
const fs = require("fs");
const path = require("path");

const DEFAULT_API_PORT = 41000;
const DEFAULT_SIMPLE_PORT = 42000;
// Must match RUST_API_JOBS_PORT default in retainpdf-core config/jobs_service.rs
// (buildBackendEnv falls back to the same default when jobsPort is unset).
const DEFAULT_JOBS_PORT = 41002;
// 退出时按这个顺序发 SIGTERM。（以前先停 retainpdf-ai：RetainPDF 自己的 AI 2026-11-03 删了，只剩 rust_api。）
const CHILD_STOP_ORDER = ["rust_api"];

class StartupAborted extends Error {
  constructor() {
    super("startup aborted: quitting");
    this.name = "StartupAborted";
  }
}

function untilQuit(promise, signal) {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(new StartupAborted());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new StartupAborted());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function createBackendPlugin(deps) {
  const {
    app,
    appRoot,
    appendDesktopLog,
    backendRuntime,
    backendStartupDiagnostics,
    buildBackendEnv,
    canConnectToPort,
    canReuseExistingBackend,
    createPortAllocator,
    desktopApiKey,
    fileSystem = fs,
    getDesktopLogPath,
    isQuitting = () => false,
    logDesktop,
    logDesktopError,
    onStartupFailure,
    platform = process.platform,
    portOccupant,
    quitSignal,
    readRetainpdfSettings,
    resolveDataRoot,
    setBackendApiPort,
    showErrorBox,
    spawn,
    stopChildGracefully,
    waitForPort,
  } = deps;
  const {
    bundledPythonImportPaths,
    preparePythonRuntime,
    resolveBackendBinary,
    resolveBackendRoot,
    resolveBundledPythonHome,
    resolvePipelineCommand,
    resolvePythonRuntime,
    resolveTypstBinary,
  } = backendRuntime;

  async function backend(ctx) {
    const splash = ctx.splash;
    const updateSplashProgress = (progress, title, detail) => splash.update(progress, title, detail);
    const children = new Map();
    let stopping = false;
    const isStopping = () => stopping || Boolean(quitSignal?.aborted);

    ctx.effect(() => async () => {
      stopping = true;
      // Never touch foreign backends: rust_api is only registered when we spawned it.
      const live = CHILD_STOP_ORDER
        .map((label) => ({ label, child: children.get(label) }))
        .filter(({ child }) => child && child.pid);
      children.clear();
      if (live.length === 0) {
        return;
      }
      if (platform === "win32") {
        // Windows 没有可用的 SIGTERM：taskkill /T /F 同步结束整棵进程树。
        for (const { child } of live) {
          portOccupant.forceKillProcessSync(child.pid);
        }
        return;
      }
      // POSIX：先 SIGTERM 让 rust_api 自己有序回收 jobsd 和 AI 服务，超时再 SIGKILL。
      logDesktop(`[desktop] quitting: sending SIGTERM to ${live.map(({ label }) => label).join(", ")}`);
      await Promise.all(
        live.map(({ child, label }) =>
          stopChildGracefully(child, { label, logger: console }).then((outcome) => {
            logDesktop(`[desktop] ${label} stopped (${outcome})`);
          }),
        ),
      );
    }, "backend child processes");

    function pipeChildOutput(child, tag, rememberOutput) {
      child.stdout.on("data", (chunk) => {
        rememberOutput?.("stdout", chunk);
        const message = `[${tag}] ${chunk}`;
        process.stdout.write(message);
        appendDesktopLog(message.trimEnd());
      });
      child.stderr.on("data", (chunk) => {
        rememberOutput?.("stderr", chunk);
        const message = `[${tag}] ${chunk}`;
        process.stderr.write(message);
        appendDesktopLog(message.trimEnd());
      });
    }

    async function startBundledBackend() {
      updateSplashProgress(18, "正在检查运行文件", "正在校验后端、Python 和脚本资源");
      const backendRoot = resolveBackendRoot();
      const backendBin = resolveBackendBinary(backendRoot);
      let pythonRuntime = resolvePythonRuntime(backendRoot);
      const scriptsDir = path.join(backendRoot, "pipeline");
      const pipelineCommand = typeof resolvePipelineCommand === "function"
        ? resolvePipelineCommand(backendRoot)
        : null;
      const pipelineEntrypointMode = pipelineCommand ? "console" : "script";
      const typstBin = resolveTypstBinary(backendRoot);
      const bundledFontPath = path.join(backendRoot, "fonts", "SourceHanSerifSC-Regular.otf");
      const bundledTitleBoldFontPath = path.join(backendRoot, "fonts", "SourceHanSerifSC-Bold.otf");
      const bundledTypstFontDir = path.join(backendRoot, "fonts");
      const dataRoot = resolveDataRoot();
      const rustApiRoot = path.join(dataRoot, "rust_api");
      const typstPackagePath = path.join(backendRoot, "typst-packages");
      const typstPackageCachePath = path.join(dataRoot, "typst-package-cache");
      let apiPort = DEFAULT_API_PORT;
      let simplePort = DEFAULT_SIMPLE_PORT;
      let jobsServicePort = DEFAULT_JOBS_PORT;

      logDesktop(
        [
          "[desktop] starting bundled backend",
          `platform=${platform}`,
          `packaged=${app.isPackaged}`,
          `backendRoot=${backendRoot}`,
          `backendBin=${backendBin}`,
          `python=${pythonRuntime.command || "<missing>"}`,
          `pythonHome=${pythonRuntime.bundledHome || "<system>"}`,
          `scriptsDir=${scriptsDir}`,
          `pipelineCommand=${pipelineCommand || "<missing-script-fallback>"}`,
          `entrypointMode=${pipelineEntrypointMode}`,
          `typst=${typstBin || "<missing>"}`,
          `log=${getDesktopLogPath() || "<unavailable>"}`,
        ].join(" "),
      );

      if (!fileSystem.existsSync(backendBin)) {
        throw new Error(`missing bundled backend binary: ${backendBin}`);
      }
      if (!pythonRuntime.command) {
        throw new Error("missing python runtime");
      }
      if (!fileSystem.existsSync(scriptsDir)) {
        throw new Error(`missing bundled scripts directory: ${scriptsDir}`);
      }
      if (!pipelineCommand) {
        logDesktop("[desktop] pipeline console wrapper missing; falling back to script entrypoint mode");
      }
      if (app.isPackaged && !typstBin) {
        throw new Error(`missing bundled typst runtime under ${path.join(backendRoot, "typst")}`);
      }

      pythonRuntime = await untilQuit(preparePythonRuntime(pythonRuntime, {
        updateSplashProgress,
      }), quitSignal);
      if (app.isPackaged && !pythonRuntime.bundledHome) {
        throw new Error(
          `missing bundled python runtime under ${path.join(backendRoot, "python")}`,
        );
      }

      fileSystem.mkdirSync(dataRoot, { recursive: true });
      fileSystem.mkdirSync(rustApiRoot, { recursive: true });
      fileSystem.mkdirSync(typstPackageCachePath, { recursive: true });
      updateSplashProgress(34, "正在准备工作目录", "正在初始化本地数据目录");

      const envInput = (extra) => ({
        retainpdfSettings: readRetainpdfSettings(),
        apiPort,
        backendRoot,
        bundledFontPath,
        bundledPythonHome: resolveBundledPythonHome(pythonRuntime.bundledHome),
        bundledPythonImportPaths: bundledPythonImportPaths(pythonRuntime.bundledHome),
        bundledTitleBoldFontPath,
        bundledTypstFontDir,
        dataRoot,
        desktopApiKey,
        entrypointMode: pipelineEntrypointMode,
        inheritHostPythonPath: !app.isPackaged,
        pipelineCommand: pipelineCommand || undefined,
        pythonRuntime,
        rustApiRoot,
        scriptsDir,
        simplePort,
        typstBin,
        typstPackageCachePath,
        typstPackagePath,
        ...extra,
      });

      // Default API port busy? Try reclaiming our own residual first; a
      // compatible existing backend may be reused in development only.
      const defaultApiBusy = await untilQuit(canConnectToPort("127.0.0.1", apiPort), quitSignal);
      logDesktop(`[desktop] port ${apiPort} busy=${defaultApiBusy}`);
      if (defaultApiBusy) {
        const reclaim = await untilQuit(portOccupant.reclaimPortIfOwnResidual("127.0.0.1", apiPort), quitSignal);
        logDesktop(
          `[desktop] port ${apiPort} occupant=${reclaim.occupant ? `${reclaim.occupant.image || "<unknown>"}:${reclaim.occupant.pid}` : "<none>"} reclaim=${reclaim.status}`,
        );
        if (reclaim.status === "reclaimed") {
          updateSplashProgress(36, "正在清理残留进程", "已回收上次残留的后端端口");
        }
      }
      const defaultApiStillBusy = defaultApiBusy
        ? await untilQuit(canConnectToPort("127.0.0.1", apiPort), quitSignal)
        : false;
      if (defaultApiStillBusy) {
        const allowExternalBackend = process.env.RETAINPDF_DESKTOP_ALLOW_EXTERNAL_BACKEND === "1";
        if ((allowExternalBackend || !app.isPackaged) && await untilQuit(canReuseExistingBackend(apiPort), quitSignal)) {
          logDesktop(`[desktop] reusing existing backend on port ${apiPort}`);
          updateSplashProgress(52, "检测到已有本地服务", "桌面端将直接复用当前后端");
          await untilQuit(waitForPort("127.0.0.1", apiPort, 5000), quitSignal);
          return { apiPort, external: true };
        }
        // Not reusable and not ours to reclaim: fall through to fresh allocation
        // on fallback ports below instead of failing. Packaged builds never
        // connect to the foreign backend, they just move to a free port.
      }

      // Allocate fresh ports for all three backend roles: reclaim own residuals,
      // otherwise take the next free port. Retried on bind races (see below).
      const excludedPorts = new Set();
      // Startup retry rounds spawn short-lived backends; their crash dialogs would
      // be noise (the startup error itself is reported). Only show crash dialogs
      // for backends that die after a successful startup.
      let suppressBackendCrashDialog = true;
      for (let attempt = 1; ; attempt += 1) {
        const allocator = createPortAllocator({
          canConnectToPort,
          reclaimPortIfOwnResidual: (host, port) => portOccupant.reclaimPortIfOwnResidual(host, port),
          describeOccupant: (port, occupant) => portOccupant.describeOccupant(port, occupant),
          exclude: excludedPorts,
          logger: console,
        });
        const allocated = await untilQuit(allocator.allocateBackendPorts("127.0.0.1", {
          apiPort: DEFAULT_API_PORT,
          simplePort: DEFAULT_SIMPLE_PORT,
          jobsPort: DEFAULT_JOBS_PORT,
        }), quitSignal);
        apiPort = allocated.ports.apiPort;
        simplePort = allocated.ports.simplePort;
        jobsServicePort = allocated.ports.jobsPort;
        setBackendApiPort(apiPort);
        if (allocated.relocations.length > 0) {
          const summary = allocated.relocations.map((item) => `${item.from}→${item.to}`).join("、");
          logDesktop(`[desktop] ports relocated: ${summary}`);
          updateSplashProgress(36, "端口自动切换", `默认端口被占用，已切换：${summary}`);
        }

        // ADR-002 Phase3: 打包版默认 remote + 监督（改壳不杀任务），开发版保持 InProcess 除非显式设 env
        const jobsModeForEnv = process.env.RUST_API_JOBS_MODE || (app.isPackaged ? "remote" : "");
        const jobsSuperviseForEnv = process.env.RUST_API_JOBS_SUPERVISE || (app.isPackaged ? "1" : "");
        const env = buildBackendEnv(envInput({
          jobsMode: jobsModeForEnv,
          jobsSupervise: jobsSuperviseForEnv,
        }));

        updateSplashProgress(52, "正在启动本地服务", "Rust API 正在启动");
        logDesktop(`[desktop] spawning backend: ${backendBin}`);
        backendStartupDiagnostics.reset(backendBin, backendRoot);
        const backendChild = spawn(backendBin, [], {
          cwd: backendRoot,
          env,
          windowsHide: platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
        });
        children.set("rust_api", backendChild);
        pipeChildOutput(backendChild, "rust_api", (stream, chunk) => backendStartupDiagnostics.rememberOutput(stream, chunk));
        backendChild.once("exit", (code, signal) => {
          if (children.get("rust_api") === backendChild) {
            children.delete("rust_api");
          }
          if (isStopping() || suppressBackendCrashDialog) {
            return;
          }
          const detail = `code=${code ?? "null"} signal=${signal ?? "null"}`;
          backendStartupDiagnostics.markExit(detail);
          logDesktopError(`[desktop] Rust API worker crashed: ${detail}`);
          showErrorBox("Rust API worker crashed", detail);
        });

        const jobsdSupervisedByShell = env.RUST_API_JOBS_SUPERVISE === "1" && env.RUST_API_JOBS_MODE === "remote";
        if (jobsdSupervisedByShell) {
          logDesktop("[desktop] jobsd supervised by shell (RUST_API_JOBS_SUPERVISE=1); shell will spawn retain-jobsd");
        }

        let waitingProgress = 58;
        const waitingTimer = setInterval(() => {
          waitingProgress = Math.min(waitingProgress + 3, 88);
          updateSplashProgress(
            waitingProgress,
            "正在连接本地服务",
            "首次启动可能稍慢，请稍候",
          );
        }, 500);
        const backendReadyTimeoutMs = app.isPackaged ? 90000 : 30000;
        logDesktop(`[desktop] waiting for backend port ${apiPort} timeoutMs=${backendReadyTimeoutMs} (attempt ${attempt}/3)`);
        try {
          await untilQuit(
            backendStartupDiagnostics.waitForBackendReady("127.0.0.1", apiPort, backendReadyTimeoutMs),
            quitSignal,
          );
        } catch (error) {
          clearInterval(waitingTimer);
          if (error instanceof StartupAborted) {
            throw error;
          }
          const conflict = backendStartupDiagnostics.hasExited() && backendStartupDiagnostics.hasBindConflict();
          if (conflict && attempt < 3) {
            // Bind race: someone grabbed our ports between probe and bind.
            // Re-allocate excluding them and respawn.
            excludedPorts.add(apiPort);
            excludedPorts.add(simplePort);
            excludedPorts.add(jobsServicePort);
            logDesktop(`[desktop] backend bind conflict on attempt ${attempt}, reallocating ports and retrying`);
            updateSplashProgress(36, "端口冲突重试", "检测到端口竞争，正在换端口重试");
            continue;
          }
          throw error;
        }
        clearInterval(waitingTimer);
        logDesktop(`[desktop] backend ready on port ${apiPort}`);
        suppressBackendCrashDialog = false;
        return { apiPort, external: false };
      }
    }

    let info;
    try {
      info = await startBundledBackend();
    } catch (error) {
      if (error instanceof StartupAborted || quitSignal?.aborted) {
        logDesktop("[desktop] backend startup abandoned: app is quitting");
        return;
      }
      onStartupFailure(error);
      return;
    }
    ctx.provide("backend", info);
  }
  backend.inject = ["splash"];
  return backend;
}

module.exports = {
  StartupAborted,
  createBackendPlugin,
  untilQuit,
};
