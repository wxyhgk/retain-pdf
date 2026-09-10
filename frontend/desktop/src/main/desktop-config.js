const fs = require("fs");
const path = require("path");

const DEFAULT_OCR_PROVIDER = "paddle";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

function createDesktopConfigStore(app, options = {}) {
  const desktopApiKey = options.desktopApiKey || "";
  const resolveCredentialSecret = options.resolveCredentialSecret
    || ((credentialRef, expectedKind) => resolveVaultCredentialSecret(app, credentialRef, expectedKind));
  // Actual Rust API port chosen at startup (dynamic fallback when the
  // default is occupied). IPC config responses read it so the frontend
  // follows without a restart.
  let backendApiPort = 41000;

  function setBackendApiPort(port) {
    const parsed = Number(port);
    if (Number.isFinite(parsed) && parsed > 0) {
      backendApiPort = parsed;
    }
  }

  function createDefaultDesktopConfig() {
    return {
      firstRunCompleted: false,
      ocrProvider: DEFAULT_OCR_PROVIDER,
      ocrCredentialRef: "",
      translationCredentialRef: "",
      mineruToken: "",
      paddleToken: "",
      modelApiKey: "",
      model: DEFAULT_MODEL,
      baseUrl: DEFAULT_BASE_URL,
      developerConfig: {},
      closeToTrayHintShown: false,
    };
  }

  function resolveDesktopConfigPath() {
    return path.join(app.getPath("userData"), "desktop-config.json");
  }

  function loadDesktopConfig() {
    const configPath = resolveDesktopConfigPath();
    if (!fs.existsSync(configPath)) {
      return createDefaultDesktopConfig();
    }
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      return normalizeDesktopConfig(JSON.parse(raw));
    } catch (error) {
      console.error(`[desktop] failed to load desktop config: ${error?.message || error}`);
      return createDefaultDesktopConfig();
    }
  }

  function saveDesktopConfig(payload = {}) {
    const nextConfig = mergeDesktopConfig(loadDesktopConfig(), payload);
    const configPath = resolveDesktopConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
    return nextConfig;
  }

  function buildDesktopRuntimeConfig(config) {
    return {
      apiBase: `http://127.0.0.1:${backendApiPort}`,
      xApiKey: desktopApiKey,
      ...buildResolvedBrowserConfig(config),
      model: config.model || DEFAULT_MODEL,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      developerConfig: config.developerConfig || {},
    };
  }

  function buildDesktopConfigResponse(config) {
    return {
      firstRunCompleted: config.firstRunCompleted,
      closeToTrayHintShown: config.closeToTrayHintShown,
      browserConfig: buildResolvedBrowserConfig(config),
      developerConfig: config.developerConfig || {},
      runtimeConfig: buildDesktopRuntimeConfig(config),
    };
  }

  function buildResolvedBrowserConfig(config) {
    const browserConfig = buildBrowserConfig(config);
    if (!browserConfig.paddleToken && browserConfig.ocrCredentialRef) {
      browserConfig.paddleToken = resolveCredentialSecret(
        browserConfig.ocrCredentialRef,
        "ocr_provider_token",
      );
    }
    if (!browserConfig.modelApiKey && browserConfig.translationCredentialRef) {
      browserConfig.modelApiKey = resolveCredentialSecret(
        browserConfig.translationCredentialRef,
        "translation_api_key",
      );
    }
    return browserConfig;
  }

  return {
    buildBrowserConfig,
    buildDesktopConfigResponse,
    buildDesktopRuntimeConfig,
    createDefaultDesktopConfig,
    loadDesktopConfig,
    resolveDesktopConfigPath,
    saveDesktopConfig,
    setBackendApiPort,
  };
}

function resolveVaultCredentialSecret(app, credentialRef, expectedKind) {
  const normalizedRef = normalizeTrimmedString(credentialRef);
  if (!normalizedRef) return "";
  try {
    const vaultPath = path.join(app.getPath("userData"), "data", "secrets", "credentials.json");
    if (!fs.existsSync(vaultPath)) return "";
    const vault = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
    const credential = vault?.credentials?.[normalizedRef];
    if (!credential || credential.kind !== expectedKind) return "";
    return normalizeTrimmedString(credential.secret);
  } catch {
    return "";
  }
}

function buildBrowserConfig(config) {
  return {
    ocrProvider: config.ocrProvider || DEFAULT_OCR_PROVIDER,
    ocrCredentialRef: config.ocrCredentialRef || "",
    translationCredentialRef: config.translationCredentialRef || "",
    mineruToken: config.mineruToken || "",
    paddleToken: config.paddleToken || "",
    modelApiKey: config.modelApiKey || "",
  };
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function normalizeOcrProvider(value) {
  return value === "paddle" ? "paddle" : DEFAULT_OCR_PROVIDER;
}

function normalizeTrimmedString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeDesktopConfig(raw = {}) {
  const defaults = {
    mineruToken: "",
    ocrCredentialRef: "",
    translationCredentialRef: "",
    paddleToken: "",
    modelApiKey: "",
    model: DEFAULT_MODEL,
    baseUrl: DEFAULT_BASE_URL,
  };
  return {
    firstRunCompleted: !!raw.firstRunCompleted,
    ocrProvider: normalizeOcrProvider(raw.ocrProvider),
    ocrCredentialRef: normalizeTrimmedString(raw.ocrCredentialRef, defaults.ocrCredentialRef),
    translationCredentialRef: normalizeTrimmedString(
      raw.translationCredentialRef,
      defaults.translationCredentialRef,
    ),
    mineruToken: normalizeTrimmedString(raw.mineruToken, defaults.mineruToken),
    paddleToken: normalizeTrimmedString(raw.paddleToken, defaults.paddleToken),
    modelApiKey: normalizeTrimmedString(raw.modelApiKey, defaults.modelApiKey),
    model: normalizeTrimmedString(raw.model, defaults.model),
    baseUrl: normalizeTrimmedString(raw.baseUrl, defaults.baseUrl),
    developerConfig: typeof raw.developerConfig === "object" && raw.developerConfig !== null
      ? { ...raw.developerConfig }
      : {},
    closeToTrayHintShown: !!raw.closeToTrayHintShown,
  };
}

function mergeDesktopConfig(currentConfig, payload = {}) {
  const merged = { ...currentConfig };
  const runtimeConfig = typeof payload.runtimeConfig === "object" && payload.runtimeConfig !== null
    ? payload.runtimeConfig
    : {};
  const keys = [
    "ocrProvider",
    "ocrCredentialRef",
    "translationCredentialRef",
    "mineruToken",
    "paddleToken",
    "modelApiKey",
    "model",
    "baseUrl",
    "closeToTrayHintShown",
  ];
  for (const key of keys) {
    if (hasOwn(payload, key)) {
      merged[key] = payload[key];
      continue;
    }
    if (hasOwn(runtimeConfig, key)) {
      merged[key] = runtimeConfig[key];
    }
  }
  if (typeof payload.developerConfig === "object" && payload.developerConfig !== null) {
    merged.developerConfig = { ...payload.developerConfig };
  }
  if (hasOwn(payload, "firstRunCompleted")) {
    merged.firstRunCompleted = !!payload.firstRunCompleted;
  }
  return normalizeDesktopConfig(merged);
}

module.exports = {
  createDesktopConfigStore,
};
