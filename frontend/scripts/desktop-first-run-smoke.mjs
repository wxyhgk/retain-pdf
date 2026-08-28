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
  constructor(id) {
    this.id = id;
    this.textContent = "";
    this.dataset = {};
    this.open = false;
  }

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

globalThis.document = {
  getElementById(id) {
    return ensureElement(id);
  },
  dispatchEvent() {},
};

ensureElement("browser-credentials-dialog").open = true;
ensureElement("browser-credentials-dialog").dataset.setupMode = "1";
ensureElement("error-box").textContent = "old error";

const [{ saveDesktopConfig }, { state }] = await Promise.all([
  import("../src/js/desktop/index.ts"),
  import("../src/js/state/store.ts"),
]);

let caughtMessage = "";
try {
  // Chữ ký hiện tại: saveDesktopConfig(browserConfig, afterSave)
  await saveDesktopConfig(
    {
      ocrProvider: "paddle",
      paddleToken: "paddle-token",
      modelApiKey: "deepseek-key",
      markConfigured: true,
    },
    async () => {
      throw new Error("health 503");
    },
  );
} catch (error) {
  caughtMessage = error?.message || String(error);
}

if (desktopStore.firstRunCompleted !== true) {
  throw new Error("expected desktopStore.firstRunCompleted to be true after first-run save");
}

if (state.desktopConfigured !== true) {
  throw new Error("expected state.desktopConfigured to be true after first-run save");
}

if (ensureElement("browser-credentials-dialog").open !== false) {
  throw new Error("expected setup dialog to close after first-run save");
}

if (!caughtMessage.includes("首次配置已保存")) {
  throw new Error(`expected saved-first-run connectivity error, got: ${caughtMessage || "<empty>"}`);
}

console.log("desktop-first-run-smoke: ok");
