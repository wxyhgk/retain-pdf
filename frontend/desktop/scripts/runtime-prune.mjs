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

export function pruneBundledMacPythonRuntime(root) {
  if (!fs.existsSync(root)) {
    return;
  }
  const frameworkVersionsRoot = path.join(root, "Frameworks", "Python.framework", "Versions");
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
    appendPythonPackagingToolTargets(
      removalTargets,
      path.join(frameworkStdlibRoot, "site-packages"),
    );
  }
  if (pythonLibDir) {
    const sitePackagesRoot = path.join(libRoot, pythonLibDir, "site-packages");
    removalTargets.push(path.join(libRoot, pythonLibDir, "ensurepip"));
    appendPythonPackagingToolTargets(removalTargets, sitePackagesRoot);
  }
  removePythonRuntimeTargets(removalTargets);

  for (const fileName of ["2to3", "idle3", "pydoc3", "python3-config"]) {
    fs.rmSync(path.join(root, "bin", fileName), { force: true });
  }

  if (fs.existsSync(frameworkVersionsRoot)) {
    for (const entry of fs.readdirSync(frameworkVersionsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === "Current" || entry.name === expectedFrameworkVersion) {
        continue;
      }
      fs.rmSync(path.join(frameworkVersionsRoot, entry.name), { recursive: true, force: true });
    }
    if (expectedFrameworkVersion) {
      const currentLink = path.join(frameworkVersionsRoot, "Current");
      fs.rmSync(currentLink, { recursive: true, force: true });
      fs.symlinkSync(expectedFrameworkVersion, currentLink);
    }
  }

  pruneTransientPythonTree(root);
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
    ...(platformName === "windows" ? [path.join(root, "tcl")] : []),
  ];
  for (const stdlibRoot of stdlibRoots) {
    removalTargets.push(
      path.join(stdlibRoot, "ensurepip"),
      path.join(stdlibRoot, "idlelib"),
      path.join(stdlibRoot, "lib2to3"),
      path.join(stdlibRoot, "tkinter"),
      path.join(stdlibRoot, "turtledemo"),
    );
    appendPythonPackagingToolTargets(
      removalTargets,
      path.join(stdlibRoot, "site-packages"),
    );
  }
  removePythonRuntimeTargets(removalTargets);
  pruneTransientPythonTree(root);
}
