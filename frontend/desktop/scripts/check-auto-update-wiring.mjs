// 打完包检查自动更新接好了没有（2026-11-22 起，build-desktop-packages.yml 的 Windows / Mac 打包后跑）：
// - resources/app-update.yml：electron-updater 启动时读它找 GitHub Release（来自 package.json 的 publish 配置）；
// - app.asar 里有 electron-updater（桌面包唯一的运行时依赖，workspace 提升到根 node_modules，打包要收得到）。
// 用法：node scripts/check-auto-update-wiring.mjs <resources 目录>
import fs from "node:fs";
import path from "node:path";

import asar from "@electron/asar";

const resources = path.resolve(process.argv[2] || "");
const problems = [];
const updateYml = path.join(resources, "app-update.yml");
if (!fs.existsSync(updateYml)) {
  problems.push(`缺 ${updateYml}`);
} else {
  const text = fs.readFileSync(updateYml, "utf8");
  for (const needle of ["provider: github", "owner: wxyhgk", "repo: retain-pdf"]) {
    if (!text.includes(needle)) problems.push(`app-update.yml 里没有「${needle}」`);
  }
  console.log(text.trim());
}
const archive = path.join(resources, "app.asar");
const files = fs.existsSync(archive) ? asar.listPackage(archive) : [];
if (!files.length) problems.push(`缺 ${archive}`);
const updaterMain = files.find((file) => file.replaceAll("\\", "/").endsWith("/node_modules/electron-updater/out/main.js"));
if (!updaterMain) problems.push("app.asar 里没有 electron-updater");
if (problems.length) {
  console.error(`auto-update wiring check failed:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`auto-update wiring ok (${updaterMain})`);
