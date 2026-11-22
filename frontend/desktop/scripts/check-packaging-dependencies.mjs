import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const desktopPackage = require("../package.json");
const installedElectron = require("electron/package.json").version;
const installedElectronBuilder = require("electron-builder/package.json").version;
const dependencyElectron = desktopPackage.devDependencies?.electron;
const dependencyElectronBuilder = desktopPackage.devDependencies?.["electron-builder"];
const configuredElectron = desktopPackage.build?.electronVersion;

if (!/^\d+\.\d+\.\d+$/.test(dependencyElectron || "")) {
  throw new Error(
    `Electron must use an exact version for reproducible workspace packaging; received ${dependencyElectron || "<missing>"}`,
  );
}

if (configuredElectron !== dependencyElectron) {
  throw new Error(
    `build.electronVersion (${configuredElectron || "<missing>"}) must match devDependencies.electron (${dependencyElectron})`,
  );
}

if (installedElectron !== dependencyElectron) {
  throw new Error(
    `Installed Electron (${installedElectron}) does not match the packaging version (${dependencyElectron})`,
  );
}

if (!/^\d+\.\d+\.\d+$/.test(dependencyElectronBuilder || "")) {
  throw new Error(
    `electron-builder must use an exact version; received ${dependencyElectronBuilder || "<missing>"}`,
  );
}

if (installedElectronBuilder !== dependencyElectronBuilder) {
  throw new Error(
    `Installed electron-builder (${installedElectronBuilder}) does not match the packaging version (${dependencyElectronBuilder})`,
  );
}

if (desktopPackage.build?.npmRebuild !== false) {
  throw new Error("build.npmRebuild must remain false while the desktop workspace has no native Node runtime dependencies");
}

// npmRebuild 关着，所以运行时依赖（连同它们的依赖）不许带原生模块：原生模块要按 Electron 的 ABI 重编，
// 不重编装进去就加载失败。纯 JS 的可以（2026-11-22 起 electron-updater 是唯一的运行时依赖）。
// 带了原生模块的依赖，要先换成分阶段重编的打包方式，再打开 npmRebuild。
const runtimeDependencyNames = [
  ...Object.keys(desktopPackage.dependencies || {}),
  ...Object.keys(desktopPackage.optionalDependencies || {}),
];
const nativeDependencies = findNativeDependencies(runtimeDependencyNames);
if (nativeDependencies.length > 0) {
  throw new Error(
    `Desktop Node runtime dependencies with native modules require a staged rebuild strategy before npmRebuild can be enabled: ${nativeDependencies.join(", ")}`,
  );
}

// electron-builder 26 把 `app-builder-bin` 和 `7zip-bin` 都从依赖树里去掉了（25.x 还
// 有），所以这里不再校验那个可执行文件存不存在——它已经不由 npm 依赖提供。改成校验
// 打包入口本身能被解析到，这是这个脚本真正要保证的事:工具链装齐了、版本对得上。
const builderEntry = require.resolve("electron-builder");
fs.accessSync(builderEntry, fs.constants.R_OK);

// 用 electron-builder 自带的 schema 校验 `build` 配置。
//
// 升级 electron-builder 大版本时，配置字段的形状会变，而这类错误**只有在真正打包时
// 才暴露**——CI 上要等四分钟走到 "Build Linux package" 才报
// `Invalid configuration object`。v4.2.5 就吃过一次:eb 25 收扁平的
// `linux.desktop: { Name, ... }`，eb 26 要求包在 `linux.desktop.entry` 里。
//
// ajv 和 scheme.json 都由 electron-builder 自己带（它的 validateConfiguration 用的就是
// 这两个）。万一取不到就只警告不拦——这一条是加分项，不该让整个检查脚本挂掉。
let schemaChecked = false;
try {
  const Ajv = require("ajv");
  const schema = require("app-builder-lib/scheme.json");
  const ajv = new Ajv({ allErrors: true, verbose: true, schemaId: "auto" });
  // 上游同样对函数型字段放行:schema 里用 `typeof` 关键字标注它们，ajv 本身不认。
  ajv.addKeyword("typeof", { validate: () => true });
  const validate = ajv.compile(schema);
  if (!validate(desktopPackage.build)) {
    const details = validate.errors
      .map((error) => `  ${error.dataPath || "(root)"} ${error.message}`)
      .join("\n");
    throw new Error(
      `electron-builder ${installedElectronBuilder} 不接受当前的 build 配置：\n${details}`,
    );
  }
  schemaChecked = true;
} catch (error) {
  if (error instanceof Error && error.message.startsWith("electron-builder ")) throw error;
  console.warn(`warning: 跳过 build 配置的 schema 校验（${error.message}）`);
}

console.log(
  `Desktop packaging dependencies verified: electron=${installedElectron}, electron-builder=${installedElectronBuilder}, config-schema=${schemaChecked ? "ok" : "skipped"}`,
);

/** 运行时依赖及其传递依赖里，哪些带原生模块（binding.gyp、package.json 的 gypfile，或包里有 .node 文件）。 */
function findNativeDependencies(names) {
  const seen = new Map();
  const native = [];
  const queue = names.map((name) => ({ name, from: path.dirname(require.resolve("../package.json")) }));
  while (queue.length) {
    const { name, from } = queue.shift();
    const manifestPath = require.resolve(`${name}/package.json`, { paths: [from] });
    const dir = path.dirname(manifestPath);
    if (seen.has(dir)) continue;
    seen.set(dir, name);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.gypfile || fs.existsSync(path.join(dir, "binding.gyp")) || containsNodeAddon(dir)) {
      native.push(`${name}@${manifest.version}`);
    }
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })) {
      queue.push({ name: dependency, from: dir });
    }
  }
  return native;
}

function containsNodeAddon(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && containsNodeAddon(full)) return true;
    if (entry.isFile() && entry.name.endsWith(".node")) return true;
  }
  return false;
}
