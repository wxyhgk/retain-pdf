// 主进程插件树（启动画面 → 后端 → 网关 → 窗口）的装配测试：用真 Cordis 和真插件，
// Electron、子进程、端口探测都换成假的，只看先后顺序和退出时的收尾。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import cordis from "./cordis.js";
import { createBackendPlugin } from "./plugins/backend.js";
import { createGatewayPlugin } from "./plugins/gateway.js";
import { createSplashPlugin } from "./plugins/splash.js";
import { createWindowsPlugin } from "./plugins/windows.js";

const { Context } = cordis;

async function until(predicate, what, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for: ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function fakeChild(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.killed = false;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

/** 每个场景一棵新的插件树；scenario 覆盖默认的假依赖。 */
function boot(scenario = {}) {
  const events = [];
  const progress = [];
  const spawned = [];
  const failures = [];
  const quitController = new AbortController();
  let nextPid = 100;

  class FakeBrowserWindow {
    constructor() {
      this.destroyed = false;
      this.webContents = { send: (_channel, payload) => progress.push(payload.progress) };
    }
    async loadFile() {}
    isDestroyed() {
      return this.destroyed;
    }
    close() {
      this.destroyed = true;
      events.push("splash closed");
    }
    hide() {}
    static getAllWindows() {
      return [{ isDestroyed: () => false, hide: () => events.push("windows hidden") }];
    }
  }

  const portBusy = scenario.portBusy || {};
  const backendDeps = {
    app: { isPackaged: false },
    appRoot: "/fake/desktop",
    appendDesktopLog: () => {},
    backendRuntime: {
      bundledPythonImportPaths: () => [],
      preparePythonRuntime: async (runtime) => runtime,
      resolveBackendBinary: () => "/fake/backend/bin/rust_api",
      resolveBackendRoot: () => "/fake/backend",
      resolveBundledPythonHome: () => "",
      resolvePipelineCommand: () => "/fake/backend/pipeline/run",
      resolvePythonRuntime: () => ({ command: "python3", bundledHome: "" }),
      resolveTypstBinary: () => "/fake/typst",
    },
    backendStartupDiagnostics: {
      hasBindConflict: () => false,
      hasExited: () => false,
      markExit: () => {},
      rememberOutput: () => {},
      reset: () => {},
      waitForBackendReady: scenario.waitForBackendReady || (async () => {}),
    },
    buildBackendEnv: (input) => ({ RUST_API_PORT: String(input.apiPort) }),
    canConnectToPort: async (_host, port) => Boolean(portBusy[port]),
    canReuseExistingBackend: async () => Boolean(scenario.reusable),
    createPortAllocator: () => ({
      allocateBackendPorts: async () => ({
        ports: { apiPort: 41000, simplePort: 42000, jobsPort: 41002 },
        relocations: [],
      }),
    }),
    desktopApiKey: "test-key",
    fileSystem: {
      existsSync: (target) => !(scenario.missingPaths || []).includes(target),
      mkdirSync: () => {},
    },
    getDesktopLogPath: () => "",
    isQuitting: () => quitController.signal.aborted,
    logDesktop: () => {},
    logDesktopError: () => {},
    onStartupFailure: (error) => failures.push(error.message),
    platform: "darwin",
    portOccupant: {
      describeOccupant: () => "",
      forceKillProcessSync: (pid) => events.push(`force-kill ${pid}`),
      getPortOccupant: async () => null,
      reclaimPortIfOwnResidual: async () => ({ status: "foreign", occupant: null }),
    },
    quitSignal: quitController.signal,
    readRetainpdfSettings: () => null,
    resolveDataRoot: () => "/fake/data",
    setBackendApiPort: () => {},
    showErrorBox: (title) => events.push(`dialog ${title}`),
    spawn: (command) => {
      const child = fakeChild(nextPid++);
      spawned.push({ command, child });
      events.push(`spawn ${command}`);
      return child;
    },
    stopChildGracefully: async (child, { label }) => {
      events.push(`stop ${label}`);
      child.emit("exit", 0, "SIGTERM");
      return "exited";
    },
    waitForPort: async () => {},
  };

  const root = new Context();
  const gatewayStarts = [];
  root.plugin(createSplashPlugin({
    BrowserWindow: FakeBrowserWindow,
    appRoot: "/fake/desktop",
    resolveWindowIcon: () => undefined,
    onStartupFailure: (error) => failures.push(error.message),
  }));
  root.plugin(createBackendPlugin(backendDeps));
  root.plugin(createGatewayPlugin({
    buildRuntimeConfig: () => ({}),
    canConnectToPort: async () => false,
    createLocalGateway: () => ({
      start: async () => {
        gatewayStarts.push(Date.now());
        return "http://127.0.0.1:40001";
      },
      stop: async () => {
        events.push("gateway stopped");
      },
    }),
    logDesktop: () => {},
    logDesktopError: () => {},
    resolveFrontendRoot: () => "/fake/frontend",
  }));
  const app = new EventEmitter();
  root.plugin(createWindowsPlugin({
    app,
    BrowserWindow: FakeBrowserWindow,
    desktopWindows: {
      createTray: () => events.push("tray"),
      createWindow: () => events.push(`window base=${root.get("gateway")?.baseUrl ?? "<none>"}`),
      hasLiveMainWindow: () => true,
      showMainWindow: () => {},
    },
    onStartupFailure: (error) => failures.push(error.message),
  }));

  async function quit() {
    quitController.abort();
    await root.fiber.dispose();
  }
  return { app, events, failures, gatewayStarts, progress, quit, root, spawned };
}

test("fresh backend: splash → backend → gateway → window, then quit tears down in reverse", async () => {
  const run = boot();
  await until(() => run.events.some((event) => event.startsWith("window")), "main window");

  // 只拉起 rust_api：RetainPDF 自己的 AI（python -m retainpdf_ai）2026-11-03 删了。
  assert.deepEqual(run.events.slice(0, 3), [
    "spawn /fake/backend/bin/rust_api",
    "tray",
    "window base=http://127.0.0.1:40001",
  ]);
  assert.deepEqual(run.progress, [6, 18, 34, 52, 92], "splash progress keeps the same steps");
  assert.equal(run.app.listenerCount("activate"), 1);

  await run.quit();
  const teardown = run.events.slice(3);
  assert.ok(teardown.indexOf("windows hidden") < teardown.indexOf("stop rust_api"), "windows hide before children stop");
  assert.deepEqual(teardown.filter((event) => event.startsWith("stop")), ["stop rust_api"]);
  assert.ok(teardown.includes("gateway stopped"));
  assert.ok(teardown.indexOf("stop rust_api") < teardown.indexOf("splash closed"), "splash goes last");
  assert.equal(run.app.listenerCount("activate"), 0, "activate listener removed on dispose");
  assert.ok(!run.events.some((event) => event.startsWith("dialog")), "no crash dialog for children stopped on quit");
  assert.deepEqual(run.failures, []);
});

test("external backend in development: reused, no gateway, window falls back to file", async () => {
  const run = boot({ portBusy: { 41000: true }, reusable: true });
  await until(() => run.events.some((event) => event.startsWith("window")), "main window");

  assert.deepEqual(run.spawned, [], "nothing spawned: backend reused");
  assert.deepEqual(run.gatewayStarts, [], "gateway is not started on the reuse path (unchanged behaviour)");
  assert.ok(run.events.includes("window base="), "window gets an empty gateway base and loads from file");
  assert.deepEqual(run.progress, [6, 18, 34, 52, 92]);

  await run.quit();
  assert.ok(!run.events.some((event) => event.startsWith("stop")), "never stops a backend we did not start");
});

test("quit during startup does not wait for the readiness timeout", async () => {
  const run = boot({ waitForBackendReady: () => new Promise(() => {}) });
  await until(() => run.spawned.length === 1, "rust_api spawned");

  const started = Date.now();
  await run.quit();
  assert.ok(Date.now() - started < 1000, "dispose returns promptly instead of waiting for readiness");
  assert.deepEqual(run.events.filter((event) => event.startsWith("stop")), ["stop rust_api"]);
  assert.ok(!run.events.some((event) => event.startsWith("window")), "no window after an aborted startup");
  assert.deepEqual(run.failures, [], "quitting is not reported as a startup failure");
});

test("startup failure is reported once and nothing downstream starts", async () => {
  const run = boot({ missingPaths: ["/fake/backend/bin/rust_api"] });
  await until(() => run.failures.length > 0, "startup failure");

  assert.match(run.failures[0], /missing bundled backend binary/);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(run.gatewayStarts, []);
  assert.ok(!run.events.some((event) => event.startsWith("window")));
  await run.quit();
});

test("backend crash after startup shows the crash dialog", async () => {
  const run = boot();
  await until(() => run.events.some((event) => event.startsWith("window")), "main window");

  const rust = run.spawned.find(({ command }) => command.endsWith("rust_api")).child;
  rust.emit("exit", 1, null);
  assert.ok(run.events.includes("dialog Rust API worker crashed"));
  await run.quit();
  assert.deepEqual(run.events.filter((event) => event.startsWith("stop")), [], "the crashed rust_api is not stopped again");
});
