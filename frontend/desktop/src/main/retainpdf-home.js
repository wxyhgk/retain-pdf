// 桌面版设置与 ~/.retainpdf/ 的对接。
//
// ~/.retainpdf/ 是翻译服务商、各服务商的模型 / 地址 / 并发、API Key、OCR 的唯一来源，
// 命令行 retainpdf 与桌面版共用。读写都经命令行（`retainpdf config export / import`），
// TOML 的解析、校验、保留注释只有 Rust 一份实现。
//
// 桌面版自己的 desktop-config.json 只留界面状态（首次启动、托盘提示）和其它任务选项
// （公式模式等）；密钥不再写进去。第一次用到时，把旧文件里的接口设置搬过来（旧文件
// 先备份一份），之后从旧文件里删掉。
//
// 命令行不在（开发时还没编译）时退回旧做法：全部存在 desktop-config.json。

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const MAPPED_TOP_LEVEL = ["ocrProvider", "paddleToken", "mineruToken", "modelApiKey", "model", "baseUrl"];
const MAPPED_DEVELOPER = ["translationProvider", "translationProfiles", "model", "baseUrl", "workers", "apiProtocol", "thinking"];

function retainpdfHomeDir(env = process.env) {
  const custom = `${env.RETAINPDF_HOME || ""}`.trim();
  if (custom) {
    return custom.startsWith("~") ? path.join(os.homedir(), custom.slice(1)) : custom;
  }
  return path.join(os.homedir(), ".retainpdf");
}

function defaultRunCli(cliPath, args, input) {
  const result = spawnSync(cliPath, args, {
    input: input ?? "",
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    let message = `${result.stderr || ""}`.trim();
    try {
      message = JSON.parse(message).error || message;
    } catch {
      message = message.replace(/^错误:/, "").trim();
    }
    throw new Error(message || `retainpdf ${args.join(" ")} failed (${result.status})`);
  }
  return result.stdout;
}

/** ~/.retainpdf 导出的设置 → 桌面配置里对应的字段（盖在 base 上）。 */
function overlayExport(base, exported) {
  const translation = exported?.translation || {};
  const profiles = {};
  for (const [id, provider] of Object.entries(exported?.providers || {})) {
    profiles[id] = {
      apiKey: typeof provider.api_key === "string" ? provider.api_key : "",
      baseUrl: provider.base_url || "",
      model: provider.model || "",
      workers: Number(provider.workers) || 1,
      apiProtocol: provider.protocol || "openai",
      thinking: provider.thinking || "auto",
    };
  }
  const tokens = exported?.ocr?.tokens || {};
  return {
    ...base,
    ocrProvider: exported?.ocr?.provider === "mineru" ? "mineru" : "paddle",
    paddleToken: typeof tokens.paddle === "string" ? tokens.paddle : "",
    mineruToken: typeof tokens.mineru === "string" ? tokens.mineru : "",
    modelApiKey: typeof translation.api_key === "string" ? translation.api_key : "",
    model: translation.model || "",
    baseUrl: translation.base_url || "",
    developerConfig: {
      ...(base.developerConfig || {}),
      translationProvider: translation.provider || "deepseek",
      translationProfiles: profiles,
      model: translation.model || "",
      baseUrl: translation.base_url || "",
      workers: Number(translation.workers) || 1,
      apiProtocol: translation.protocol || "openai",
      thinking: translation.thinking || "auto",
    },
  };
}

/** 桌面配置 → 要写进 ~/.retainpdf 的改动（`config import` 的输入）。`known` 是认识的服务商。 */
function changesFromDesktop(config, known) {
  const developer = config.developerConfig || {};
  const changes = {};
  const provider = known.includes(developer.translationProvider) ? developer.translationProvider : "";
  if (provider) {
    changes["translation.provider"] = provider;
  }
  const profiles = { ...(developer.translationProfiles || {}) };
  if (provider) {
    // 旧配置只在顶层记了当前服务商的 key / 模型 / 地址 / 并发。
    const current = { ...(profiles[provider] || {}) };
    if (!current.apiKey && config.modelApiKey) current.apiKey = config.modelApiKey;
    if (!current.model && (developer.model || config.model)) current.model = developer.model || config.model;
    if (!current.baseUrl && (developer.baseUrl || config.baseUrl)) current.baseUrl = developer.baseUrl || config.baseUrl;
    if (!current.workers && developer.workers) current.workers = developer.workers;
    if (!current.apiProtocol && developer.apiProtocol) current.apiProtocol = developer.apiProtocol;
    if (!current.thinking && developer.thinking) current.thinking = developer.thinking;
    profiles[provider] = current;
  }
  for (const [id, profile] of Object.entries(profiles)) {
    if (!known.includes(id) || !profile || typeof profile !== "object") continue;
    changes[`providers.${id}.model`] = `${profile.model || ""}`.trim() || null;
    changes[`providers.${id}.workers`] = Number(profile.workers) > 0 ? String(Number(profile.workers)) : null;
    changes[`providers.${id}.api_key`] = `${profile.apiKey || ""}`.trim() || null;
    // 等于内置默认时 ~/.retainpdf 那边会自己删掉这一项；没填就清掉、回到默认。
    changes[`providers.${id}.protocol`] = ["openai", "openai_responses", "anthropic"].includes(profile.apiProtocol) ? profile.apiProtocol : null;
    changes[`providers.${id}.thinking`] = ["auto", "off", "low", "medium", "high", "max"].includes(profile.thinking)
      ? profile.thinking
      : null;
    if (id === "custom") {
      changes["providers.custom.base_url"] = `${profile.baseUrl || ""}`.trim() || null;
    }
  }
  if (config.ocrProvider === "paddle" || config.ocrProvider === "mineru") {
    changes["ocr.provider"] = config.ocrProvider;
  }
  if (typeof config.paddleToken === "string") changes["ocr.paddle_token"] = config.paddleToken.trim() || null;
  if (typeof config.mineruToken === "string") changes["ocr.mineru_token"] = config.mineruToken.trim() || null;
  return changes;
}

/** 写进 desktop-config.json 的部分：去掉已经归 ~/.retainpdf 管的字段（含全部密钥）。 */
function stripMapped(config) {
  const kept = { ...config };
  for (const key of MAPPED_TOP_LEVEL) delete kept[key];
  const developer = { ...(config.developerConfig || {}) };
  for (const key of MAPPED_DEVELOPER) delete developer[key];
  kept.developerConfig = developer;
  return kept;
}

function hasLegacySettings(config) {
  const developer = config.developerConfig || {};
  return Boolean(
    config.modelApiKey
      || config.paddleToken
      || config.mineruToken
      || developer.translationProvider
      || (developer.translationProfiles && Object.keys(developer.translationProfiles).length),
  );
}

function createRetainpdfHome(options = {}) {
  const resolveCli = options.resolveCli || (() => "");
  const runCli = options.runCli || defaultRunCli;
  const env = options.env || process.env;
  const logger = options.logger || console;
  let cache = null;

  function cliPath() {
    const candidate = resolveCli();
    return candidate && fs.existsSync(candidate) ? candidate : "";
  }

  function homeDir() {
    return retainpdfHomeDir(env);
  }

  function stamp() {
    return ["config.toml", "credentials.toml"]
      .map((name) => {
        try {
          const stat = fs.statSync(path.join(homeDir(), name));
          return `${stat.size}:${stat.mtimeMs}`;
        } catch {
          return "-";
        }
      })
      .join("|");
  }

  function exportSettings() {
    const cli = cliPath();
    if (!cli) return null;
    const key = stamp();
    if (cache && cache.key === key) return cache.value;
    const value = JSON.parse(runCli(cli, ["config", "export", "--with-secrets"]));
    cache = { key, value };
    return value;
  }

  function importChanges(changes) {
    const cli = cliPath();
    if (!cli) throw new Error("找不到 retainpdf 命令行，无法保存到 ~/.retainpdf");
    runCli(cli, ["--json", "config", "import"], JSON.stringify(changes));
    cache = null;
  }

  function knownProviders(exported) {
    return Object.keys(exported?.providers || {});
  }

  /**
   * 第一次：~/.retainpdf/config.toml 还不存在、旧文件里有接口设置时搬过去。
   * 返回 true 表示搬过（调用方随后把旧文件里的这些字段删掉）。
   */
  function migrate(legacy, legacyPath) {
    const cli = cliPath();
    if (!cli || fs.existsSync(path.join(homeDir(), "config.toml")) || !hasLegacySettings(legacy)) {
      return false;
    }
    const exported = exportSettings();
    importChanges(changesFromDesktop(legacy, knownProviders(exported)));
    if (legacyPath && fs.existsSync(legacyPath)) {
      const backup = legacyPath.replace(/\.json$/, ".before-retainpdf-home.json");
      if (!fs.existsSync(backup)) {
        fs.copyFileSync(legacyPath, backup);
        try {
          fs.chmodSync(backup, 0o600);
        } catch {
          /* best effort */
        }
      }
    }
    logger.log?.(`[desktop] moved API settings from ${legacyPath || "desktop config"} to ${homeDir()}`);
    return true;
  }

  return {
    available: () => Boolean(cliPath()),
    homeDir,
    exportSettings,
    /** 桌面配置（来自 desktop-config.json）盖上 ~/.retainpdf 的设置。 */
    overlay(config) {
      const exported = exportSettings();
      return exported ? overlayExport(config, exported) : config;
    },
    /** 保存：接口设置写进 ~/.retainpdf，返回该写进 desktop-config.json 的部分。 */
    save(config) {
      const exported = exportSettings();
      if (!exported) return config;
      importChanges(changesFromDesktop(config, knownProviders(exported)));
      return stripMapped(config);
    },
    migrate,
    stripMapped,
  };
}

module.exports = {
  changesFromDesktop,
  createRetainpdfHome,
  overlayExport,
  retainpdfHomeDir,
  stripMapped,
};
