const desktopStore = {
  firstRunCompleted: false,
  closeToTrayHintShown: false,
  ocrProvider: "paddle",
  mineruToken: "",
  paddleToken: "",
  modelApiKey: "",
  developerConfig: {},
  runtimeConfig: {},
};

function buildBrowserConfig(config) {
  return {
    ocrProvider: config.ocrProvider || "paddle",
    mineruToken: config.mineruToken || "",
    paddleToken: config.paddleToken || "",
    modelApiKey: config.modelApiKey || "",
  };
}

function buildRuntimeConfig(config) {
  return {
    apiBase: "http://127.0.0.1:41000",
    xApiKey: "retain-pdf-desktop",
    ...buildBrowserConfig(config),
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com/v1",
    developerConfig: config.developerConfig || {},
  };
}

class ElementStub {
  constructor(id = "", tagName = "div") {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.textContent = "";
    this.dataset = {};
    this.open = false;
    this.children = [];
    this.style = {};
    // 真的记录 class：showDesktopUi() 靠 classList.remove("hidden") 显示按钮，
    // 空实现会让断言无从下手。
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((n) => classes.add(n)),
      remove: (...names) => names.forEach((n) => classes.delete(n)),
      toggle: (n) => (classes.has(n) ? classes.delete(n) : classes.add(n)),
      contains: (n) => classes.has(n),
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    return child;
  }

  setAttribute() {}

  removeAttribute() {}

  addEventListener() {}

  removeEventListener() {}

  close() {
    this.open = false;
  }

  showModal() {
    this.open = true;
  }
}

const elements = new Map();

function ensureElement(id) {
  if (!elements.has(id)) {
    elements.set(id, new ElementStub(id));
  }
  return elements.get(id);
}

const localStorageStore = new Map();

globalThis.window = {
  location: {
    protocol: "file:",
    href: "file:///tmp/index.html",
    origin: "null",
    hostname: "",
  },
  localStorage: {
    getItem(key) {
      return localStorageStore.has(key) ? localStorageStore.get(key) : null;
    },
    setItem(key, value) {
      localStorageStore.set(key, String(value));
    },
  },
  retainPdfDesktop: {
    platform: "linux",
    async invoke(command, args = {}) {
      if (command === "load_desktop_config") {
        return {
          firstRunCompleted: desktopStore.firstRunCompleted,
          closeToTrayHintShown: desktopStore.closeToTrayHintShown,
          browserConfig: buildBrowserConfig(desktopStore),
          developerConfig: desktopStore.developerConfig,
          runtimeConfig: buildRuntimeConfig(desktopStore),
        };
      }
      if (command === "save_desktop_config") {
        const payload = args?.payload || {};
        Object.assign(desktopStore, {
          firstRunCompleted: !!payload.firstRunCompleted,
          closeToTrayHintShown: !!payload.closeToTrayHintShown,
          ocrProvider: payload.ocrProvider || desktopStore.ocrProvider,
          mineruToken: payload.mineruToken || "",
          paddleToken: payload.paddleToken || "",
          modelApiKey: payload.modelApiKey || "",
          developerConfig: payload.developerConfig || {},
          runtimeConfig: payload.runtimeConfig || {},
        });
        return {
          firstRunCompleted: desktopStore.firstRunCompleted,
          closeToTrayHintShown: desktopStore.closeToTrayHintShown,
          browserConfig: buildBrowserConfig(desktopStore),
          developerConfig: desktopStore.developerConfig,
          runtimeConfig: buildRuntimeConfig(desktopStore),
        };
      }
      throw new Error(`unsupported command: ${command}`);
    },
    async loadDesktopConfig() {
      return this.invoke("load_desktop_config");
    },
    async saveDesktopConfig(payload = {}) {
      return this.invoke("save_desktop_config", { payload });
    },
    onStartupProgress() {
      return () => {};
    },
  },
};

// 这个假 document 要撑住的不只是 desktop bootstrap 自己的 getElementById——
// bootstrap 经 features/credentials/domain 会把整条 React 依赖链拉进来，其中
// sonner 在**模块顶层**就执行 __insertCSS()：
//     document.head || document.getElementsByTagName("head")[0]
//     document.createElement("style") → head.appendChild(style)
//     style.appendChild(document.createTextNode(code))
// 缺任何一环脚本都会在 import 阶段崩，而不是跑到断言。
const dispatchedEvents = [];
const documentHead = new ElementStub("", "head");
const documentBody = new ElementStub("", "body");

globalThis.document = {
  head: documentHead,
  body: documentBody,
  documentElement: new ElementStub("", "html"),
  getElementById(id) {
    return ensureElement(id);
  },
  getElementsByTagName(tagName) {
    const name = `${tagName}`.toLowerCase();
    if (name === "head") return [documentHead];
    if (name === "body") return [documentBody];
    return [];
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  createElement(tagName) {
    return new ElementStub("", tagName);
  },
  createTextNode(data) {
    const node = new ElementStub("", "#text");
    node.textContent = `${data}`;
    return node;
  },
  addEventListener() {},
  removeEventListener() {},
  // openSetupDialog() 是靠派发 APP_EVENTS.openBrowserCredentials 打开首配窗的
  // （React 侧 CredentialsDialog.tsx 监听它）。记下来才能断言。
  dispatchEvent(event) {
    dispatchedEvents.push({ type: event?.type, detail: event?.detail });
    return true;
  },
};

// ── 被测对象：bootstrapDesktop() ───────────────────────────────────────
//
// 这个脚本原先测的是 `app/desktop/bootstrap.ts` 的 saveDesktopConfig()。
// 排查发现那个函数**生产从不执行**——entry.tsx 只 import bootstrapDesktop，
// 而 createHomeComposition 的 saveDesktopConfig 选项没有任何生产传入点，
// 凭据功能实际用的是 composition 自己的 saveDesktopCredentialConfig。
// 该函数连同 closeSetupDialog / setDesktopBusy 已一并删除。
//
// 现在测的是这个文件里仅存的活路径：桌面首启探测与首配窗拉起。
// 保存分支的覆盖在 tests/home/credentials-dialog-component.test.mjs
//（「CredentialsDialog：保存(桌面模式)」）。

const { bootstrapDesktop } = await import("../src/app/desktop/bootstrap.ts");
const { desktopBootstrapState: state } = await import("../src/platform/desktop/state.ts");

// ── 场景 1：未完成首次配置 → 应拉起首配窗 ──
desktopStore.firstRunCompleted = false;
desktopStore.developerConfig = { workers: 4 };
dispatchedEvents.length = 0;
ensureElement("open-output-btn").classList.add("hidden");

await bootstrapDesktop();

if (state.desktopMode !== true) {
  throw new Error("expected state.desktopMode to be true after bootstrapDesktop");
}
if (state.desktopConfigured !== false) {
  throw new Error("expected state.desktopConfigured to stay false on first run");
}
if (ensureElement("open-output-btn").classList.contains("hidden")) {
  throw new Error("expected showDesktopUi() to unhide #open-output-btn");
}
const setupEvents = dispatchedEvents.filter(
  (e) => e.type === "retainpdf:open-browser-credentials" && e.detail?.setupMode === true,
);
if (setupEvents.length !== 1) {
  throw new Error(
    `expected exactly one setup-dialog event on first run, got ${setupEvents.length}`,
  );
}
if (JSON.stringify(state.developerConfig) !== JSON.stringify({ workers: 4 })) {
  throw new Error(
    `expected developerConfig to propagate, got ${JSON.stringify(state.developerConfig)}`,
  );
}

// ── 场景 2：已完成首次配置 → 不应拉起首配窗 ──
desktopStore.firstRunCompleted = true;
dispatchedEvents.length = 0;

await bootstrapDesktop();

if (state.desktopConfigured !== true) {
  throw new Error("expected state.desktopConfigured to be true when already configured");
}
if (dispatchedEvents.some((e) => e.type === "retainpdf:open-browser-credentials")) {
  throw new Error("expected no setup-dialog event when first run already completed");
}

console.log("desktop-first-run-smoke: ok");
