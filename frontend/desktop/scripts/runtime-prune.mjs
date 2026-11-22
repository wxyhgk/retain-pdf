import fs from "fs";
import path from "path";


function appendPythonPackagingToolTargets(removalTargets, sitePackagesRoot) {
  removalTargets.push(
    path.join(sitePackagesRoot, "pip"),
    path.join(sitePackagesRoot, "setuptools"),
    path.join(sitePackagesRoot, "pkg_resources"),
    path.join(sitePackagesRoot, "_distutils_hack"),
    path.join(sitePackagesRoot, "distutils-precedence.pth"),
  );
  if (!fs.existsSync(sitePackagesRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(sitePackagesRoot)) {
    if (/^(pip|setuptools)-.+\.dist-info$/.test(entry)) {
      removalTargets.push(path.join(sitePackagesRoot, entry));
    }
  }
}

// setup-python 在 Windows 工具缓存目录里留着官方安装器（如 python-3.11.9-amd64.exe，
// 约 25MiB），robocopy 会把它一起拷进来；它只是安装器，运行时用不到。pip 已从
// site-packages 删掉，Scripts 下的 pip*.exe 启动器也成了死链接，一并去掉。
function appendWindowsPythonInstallerTargets(removalTargets, root) {
  for (const entry of fs.readdirSync(root)) {
    if (/^python-\d+\.\d+.*\.exe$/i.test(entry)) {
      removalTargets.push(path.join(root, entry));
    }
  }
  const scriptsRoot = path.join(root, "Scripts");
  if (!fs.existsSync(scriptsRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(scriptsRoot)) {
    if (/^pip(\d+(\.\d+)?)?\.exe$/i.test(entry)) {
      removalTargets.push(path.join(scriptsRoot, entry));
    }
  }
}

// 运行时用不到的死重（2026-11-22 后端拆开 v2026.11.22 的 Linux 包量出来的）：
// - lib/python3.x/config-3.x-*：libpython3.x.a 静态库和 Makefile，只有编译扩展时用（Linux 46MB）；
// - pydoc_data（help() 的主题文本）、distutils（3.11 已弃用，打包后也没 setuptools 了）；
// 运行时真要用到时，prepare-app 在剪完的目录上跑的 desktop_python_check 会让构建失败。
function appendStdlibDeadWeightTargets(removalTargets, stdlibRoot) {
  removalTargets.push(path.join(stdlibRoot, "pydoc_data"), path.join(stdlibRoot, "distutils"));
  if (!fs.existsSync(stdlibRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(stdlibRoot)) {
    if (/^config-\d+\.\d+/.test(entry)) {
      removalTargets.push(path.join(stdlibRoot, entry));
    }
  }
}

// lib/ 下的开发用文件：pkgconfig；rsync -aL 把 libpython3.x.so → .so.1.0 的软链接解成了第二份
// 一模一样的 22MB 实体文件，python3 只链 .so.1.0（带版本号的 soname），没带版本号的那份删掉。
function appendPosixLibDeadWeightTargets(removalTargets, libRoot) {
  removalTargets.push(path.join(libRoot, "pkgconfig"));
  if (!fs.existsSync(libRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(libRoot)) {
    const match = entry.match(/^(libpython\d+\.\d+)\.so$/);
    if (match && fs.readdirSync(libRoot).some((other) => other.startsWith(`${match[1]}.so.`))) {
      removalTargets.push(path.join(libRoot, entry));
    }
  }
}

function pruneTransientPythonTree(currentPath) {
  if (!fs.existsSync(currentPath)) {
    return;
  }
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__" || entry.name === "test" || entry.name === "tests") {
        fs.rmSync(entryPath, { recursive: true, force: true });
        continue;
      }
      pruneTransientPythonTree(entryPath);
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".pyc") || entry.name.endsWith(".pyo"))) {
      fs.rmSync(entryPath, { force: true });
    }
  }
}

function removePythonRuntimeTargets(removalTargets) {
  for (const target of removalTargets) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

/** Python.framework 只留打包的版本：删掉其他版本，Current 指向它，顶层 Python / Resources 指向 Versions/Current。 */
function normalizeFrameworkVersions(frameworkRoot, expectedVersion) {
  const versionsRoot = path.join(frameworkRoot, "Versions");
  if (!expectedVersion || !fs.existsSync(path.join(versionsRoot, expectedVersion))) {
    return;
  }
  for (const entry of fs.readdirSync(versionsRoot, { withFileTypes: true })) {
    if (entry.name === "Current" || entry.name === expectedVersion) {
      continue;
    }
    fs.rmSync(path.join(versionsRoot, entry.name), { recursive: true, force: true });
  }
  const currentLink = path.join(versionsRoot, "Current");
  fs.rmSync(currentLink, { recursive: true, force: true });
  fs.symlinkSync(expectedVersion, currentLink);
  for (const name of ["Python", "Resources"]) {
    const link = path.join(frameworkRoot, name);
    fs.rmSync(link, { recursive: true, force: true });
    if (fs.existsSync(path.join(versionsRoot, expectedVersion, name))) {
      fs.symlinkSync(path.join("Versions", "Current", name), link);
    }
  }
}

/** 剪完以后指向不存在目标的软链接（比如 Headers → 已删的 include）删掉：codesign / osx-sign 遇到会 ENOENT。 */
export function removeDanglingSymlinks(currentPath) {
  if (!fs.existsSync(currentPath)) {
    return;
  }
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isSymbolicLink()) {
      if (!fs.existsSync(entryPath)) {
        fs.rmSync(entryPath, { force: true });
      }
      continue;
    }
    if (entry.isDirectory()) {
      removeDanglingSymlinks(entryPath);
    }
  }
}

export function pruneBundledMacPythonRuntime(root) {
  if (!fs.existsSync(root)) {
    return;
  }
  const libRoot = path.join(root, "lib");
  const pythonLibDir = fs.existsSync(libRoot)
    ? fs.readdirSync(libRoot).find((entry) => /^python\d+\.\d+$/.test(entry))
    : null;
  const expectedFrameworkVersion = pythonLibDir
    ? pythonLibDir.replace(/^python/, "")
    : "";
  const frameworkCurrentRoot = path.join(
    root,
    "Frameworks",
    "Python.framework",
    "Versions",
    "Current",
  );
  // 先把 Versions 收拾成只剩打包的那个版本、Current 指向它，下面按 Current 算的删除才落在真正打包的版本上。
  // 2026-11-22 发现：构建机上 Current 原本指向 runner 自己的 Python（3.15），以前是先按 Current 算删除、
  // 再删掉其他版本、最后才改 Current，结果所有删除都落在随后整个删掉的 3.15 上，3.11 的 include、share、
  // Headers、config 一样没删；框架顶层的 Python / Resources 软链接也还指着 3.15，签名时 ENOENT。
  normalizeFrameworkVersions(path.join(root, "Frameworks", "Python.framework"), expectedFrameworkVersion);
  const frameworkStdlibRoot = expectedFrameworkVersion
    ? path.join(frameworkCurrentRoot, "lib", `python${expectedFrameworkVersion}`)
    : "";
  const removalTargets = [
    path.join(root, "Frameworks", "Python.framework", "Headers"),
    path.join(frameworkCurrentRoot, "Frameworks", "Tk.framework"),
    path.join(frameworkCurrentRoot, "Frameworks", "Tcl.framework"),
    path.join(frameworkCurrentRoot, "Headers"),
    path.join(frameworkCurrentRoot, "include"),
    path.join(frameworkCurrentRoot, "share"),
    path.join(frameworkCurrentRoot, "Resources", "English.lproj", "Documentation"),
    path.join(frameworkCurrentRoot, "lib", "tcl8"),
    path.join(frameworkCurrentRoot, "lib", "tcl8.6"),
    path.join(frameworkCurrentRoot, "lib", "tk8.6"),
    path.join(frameworkCurrentRoot, "lib", "libtcl8.6.dylib"),
    path.join(frameworkCurrentRoot, "lib", "libtk8.6.dylib"),
    path.join(frameworkCurrentRoot, "lib", "Tk.icns"),
    path.join(frameworkCurrentRoot, "lib", "Tk.tiff"),
  ];
  if (frameworkStdlibRoot) {
    removalTargets.push(
      path.join(frameworkStdlibRoot, "ensurepip"),
      path.join(frameworkStdlibRoot, "idlelib"),
      path.join(frameworkStdlibRoot, "lib2to3"),
      path.join(frameworkStdlibRoot, "tkinter"),
      path.join(frameworkStdlibRoot, "turtledemo"),
    );
    appendStdlibDeadWeightTargets(removalTargets, frameworkStdlibRoot);
    appendPythonPackagingToolTargets(
      removalTargets,
      path.join(frameworkStdlibRoot, "site-packages"),
    );
  }
  removalTargets.push(path.join(frameworkCurrentRoot, "lib", "pkgconfig"));
  if (pythonLibDir) {
    appendStdlibDeadWeightTargets(removalTargets, path.join(libRoot, pythonLibDir));
    const sitePackagesRoot = path.join(libRoot, pythonLibDir, "site-packages");
    removalTargets.push(path.join(libRoot, pythonLibDir, "ensurepip"));
    appendPythonPackagingToolTargets(removalTargets, sitePackagesRoot);
  }
  removePythonRuntimeTargets(removalTargets);

  for (const fileName of ["2to3", "idle3", "pydoc3", "python3-config"]) {
    fs.rmSync(path.join(root, "bin", fileName), { force: true });
  }

  pruneTransientPythonTree(root);
  removeDanglingSymlinks(root);
}

export function pruneBundledPortablePythonRuntime(root, platformName) {
  if (!fs.existsSync(root)) {
    return;
  }
  const stdlibRoots = [];
  if (platformName === "windows") {
    stdlibRoots.push(path.join(root, "Lib"));
  } else {
    const libRoot = path.join(root, "lib");
    if (fs.existsSync(libRoot)) {
      for (const entry of fs.readdirSync(libRoot)) {
        if (/^python\d+\.\d+$/.test(entry)) {
          stdlibRoots.push(path.join(libRoot, entry));
        }
      }
    }
  }

  const removalTargets = [
    path.join(root, "Doc"),
    path.join(root, "docs"),
    path.join(root, "include"),
    path.join(root, "share", "doc"),
    path.join(root, "share", "man"),
    path.join(root, "Tools"),
    // 打包机留下的构建日志，被一起拷进了包里（Linux 包里 3.5MB）。
    path.join(root, "build_output.txt"),
    path.join(root, "tools_structure.txt"),
    // Windows：libs/python3xx.lib 等导入库，只有编译扩展时链接用。
    ...(platformName === "windows" ? [path.join(root, "tcl"), path.join(root, "libs")] : []),
  ];
  if (platformName !== "windows") {
    appendPosixLibDeadWeightTargets(removalTargets, path.join(root, "lib"));
  }
  for (const stdlibRoot of stdlibRoots) {
    removalTargets.push(
      path.join(stdlibRoot, "ensurepip"),
      path.join(stdlibRoot, "idlelib"),
      path.join(stdlibRoot, "lib2to3"),
      path.join(stdlibRoot, "tkinter"),
      path.join(stdlibRoot, "turtledemo"),
    );
    appendStdlibDeadWeightTargets(removalTargets, stdlibRoot);
    appendPythonPackagingToolTargets(
      removalTargets,
      path.join(stdlibRoot, "site-packages"),
    );
  }
  if (platformName === "windows") {
    appendWindowsPythonInstallerTargets(removalTargets, root);
  }
  removePythonRuntimeTargets(removalTargets);
  pruneTransientPythonTree(root);
}
