// 给打好的 RetainPDF.app 做 Developer ID 签名、公证、staple（.github/workflows/sign-macos.yml 调它）。
//
// 为什么不让 electron-builder 打包时顺手签：桌面打包和测试是并行跑的，打包那一步不许碰任何密钥
// （test_release_quality_gates），签名放到测试过了以后的单独 job。electron-builder 的 --prepackaged
// 只打 dmg / zip、不签名，所以这里直接用它内部用的两个库：
// - @electron/osx-sign：遍历 .app，包里每个二进制都签（Python.framework、site-packages 的 .so、
//   rust_api / retain-jobsd / retainpdf、typst、rendering-engine 的原生模块），hardened runtime + 时间戳，
//   entitlements 用 build/entitlements.mac.plist（App 和子程序共用）；
// - @electron/notarize：用 App Store Connect API key 交 notarytool 公证，过了自动 staple。
//
// 用法：node scripts/sign-mac.mjs --app <RetainPDF.app> --keychain <钥匙串> [--no-notarize]
//   公证要 APPLE_API_KEY（.p8 文件路径）、APPLE_API_KEY_ID、APPLE_API_ISSUER 三个环境变量。
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { signAsync } from "@electron/osx-sign";
import { notarize } from "@electron/notarize";

const DESKTOP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENTITLEMENTS = path.join(DESKTOP_ROOT, "build", "entitlements.mac.plist");

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : "";
}

/** 钥匙串里的 Developer ID Application 身份（证书名），只认一个。 */
export function findDeveloperIdIdentity(keychain) {
  const output = execFileSync("security", ["find-identity", "-v", "-p", "codesigning", keychain], { encoding: "utf8" });
  const names = [...output.matchAll(/"(Developer ID Application: [^"]+)"/g)].map((match) => match[1]);
  const unique = [...new Set(names)];
  if (unique.length !== 1) {
    throw new Error(`钥匙串里应当正好一个 Developer ID Application 身份，找到 ${unique.length} 个`);
  }
  return unique[0];
}

// Mach-O 的魔数（大小端、32/64 位、多架构 fat 包）。
const MACH_O_MAGICS = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca]);

/** 文件开头 4 个字节是不是 Mach-O（可执行程序、.dylib、.so、.node 都是）。 */
export function isMachO(filePath) {
  let fd;
  try {
    fd = openSync(filePath, "r");
    const head = Buffer.alloc(4);
    if (readSync(fd, head, 0, 4, 0) < 4) return false;
    return MACH_O_MAGICS.has(head.readUInt32BE(0));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * osx-sign 要跳过的：不是 Mach-O 的普通文件。osx-sign 默认把所有「看起来是二进制」的文件都签一遍——
 * 包里 1721 个，真正的 Mach-O 只有约 300 个，其余是图片、字体、PDF、数据文件，它们由 App 顶层签名的
 * CodeResources 统一封住，不用单独签。每签一个都要连一次苹果的时间戳服务器，这一步原来要 3 分多钟
 * （2026-11-22 试验 44997010299）。.app / .framework 是目录，照常签。
 */
export function skipNonMachO(filePath) {
  try {
    if (statSync(filePath).isDirectory()) return false;
  } catch {
    return false;
  }
  return !isMachO(filePath);
}

/** osx-sign 的参数：只签 Mach-O（和 .app / .framework），每个都开 hardened runtime、用同一份 entitlements。 */
export function signOptions({ app, identity, keychain, entitlements = ENTITLEMENTS }) {
  return {
    app,
    identity,
    keychain,
    platform: "darwin",
    type: "distribution",
    preAutoEntitlements: false,
    ignore: skipNonMachO,
    optionsForFile: () => ({ hardenedRuntime: true, entitlements }),
  };
}

export function notarizeOptions(app, env = process.env) {
  const { APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER } = env;
  if (!APPLE_API_KEY || !APPLE_API_KEY_ID || !APPLE_API_ISSUER) return null;
  return { appPath: app, appleApiKey: APPLE_API_KEY, appleApiKeyId: APPLE_API_KEY_ID, appleApiIssuer: APPLE_API_ISSUER };
}

async function main(argv) {
  const app = path.resolve(argValue(argv, "--app"));
  const keychain = argValue(argv, "--keychain");
  if (!app.endsWith(".app") || !existsSync(app)) throw new Error(`--app 要指向 RetainPDF.app：${app}`);
  if (!keychain) throw new Error("--keychain 必填（导入了 Developer ID 证书的临时钥匙串）");
  const identity = findDeveloperIdIdentity(keychain);
  console.log(`[sign-mac] signing ${app} as ${identity.replace(/\(.*\)/, "(…)")}`);
  await signAsync(signOptions({ app, identity, keychain }));
  console.log("[sign-mac] signed");
  if (argv.includes("--no-notarize")) return;
  const options = notarizeOptions(app);
  if (!options) throw new Error("缺 APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER，没法公证（不公证请加 --no-notarize）");
  console.log("[sign-mac] notarizing (notarytool, usually a few minutes)…");
  await notarize(options);
  console.log("[sign-mac] notarized and stapled");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[sign-mac] ${error?.stack || error}`);
    process.exit(1);
  });
}
