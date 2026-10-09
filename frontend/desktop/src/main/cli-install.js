// 设置 → 更新 →「安装命令行工具」：把包里的 retainpdf 链接到终端找得到的地方。
//
// /usr/local/bin 可写就放那里，否则放 ~/.local/bin（不在 PATH 里时告诉用户怎么加）。
// 只替换自己以前放的链接，同名的普通文件不碰。Windows 暂不支持。

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function loginShellHasDir(dir) {
  // 图形界面启动的应用拿不到终端里的 PATH，问一下登录 shell。
  const shell = process.env.SHELL || "/bin/zsh";
  const result = spawnSync(shell, ["-lc", "echo $PATH"], { encoding: "utf8", timeout: 5000 });
  return `${result.stdout || ""}`.trim().split(":").includes(dir);
}

function createCliInstaller(options = {}) {
  const resolveSource = options.resolveSource || (() => "");
  const targets = options.targets || ["/usr/local/bin", path.join(os.homedir(), ".local", "bin")];
  const platform = options.platform || process.platform;
  const onPath = options.onPath || loginShellHasDir;

  function status() {
    const source = resolveSource();
    const installedAt = targets
      .map((dir) => path.join(dir, "retainpdf"))
      .find((target) => {
        try {
          return fs.lstatSync(target).isSymbolicLink() && fs.readlinkSync(target) === source;
        } catch {
          return false;
        }
      }) || "";
    return { available: Boolean(source), source, installedAt, supported: platform !== "win32" };
  }

  function install() {
    if (platform === "win32") {
      return { ok: false, error: "Windows 版暂不支持一键安装" };
    }
    const source = resolveSource();
    if (!source) {
      return { ok: false, error: "这个版本里没有命令行工具" };
    }
    const [systemDir, userDir] = targets;
    let dir = userDir;
    try {
      fs.accessSync(systemDir, fs.constants.W_OK);
      dir = systemDir;
    } catch {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const target = path.join(dir, "retainpdf");
    try {
      if (!fs.lstatSync(target).isSymbolicLink()) {
        return { ok: false, error: `${target} 已经有一个同名文件，没有覆盖` };
      }
      fs.unlinkSync(target);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    fs.symlinkSync(source, target);
    const found = onPath(dir);
    return {
      ok: true,
      path: target,
      onPath: found,
      hint: found ? "" : `终端还找不到它：把 export PATH="${dir}:$PATH" 加到 ~/.zshrc，再开一个新终端。`,
    };
  }

  return { install, status };
}

module.exports = { createCliInstaller };
