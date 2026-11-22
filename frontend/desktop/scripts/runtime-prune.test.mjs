import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  pruneBundledMacPythonRuntime,
  pruneBundledPortablePythonRuntime,
} from "./runtime-prune.mjs";


function makeFile(root, relativePath) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "fixture", "utf8");
}

function withTempRuntime(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-runtime-prune-"));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("mac runtime pruning removes documentation and build tooling", () => {
  withTempRuntime((root) => {
    const versionRoot = path.join(root, "Frameworks/Python.framework/Versions/3.11");
    fs.mkdirSync(versionRoot, { recursive: true });
    fs.symlinkSync("3.11", path.join(root, "Frameworks/Python.framework/Versions/Current"));
    makeFile(root, "lib/python3.11/site-packages/runtime_dependency/__init__.py");
    makeFile(root, "lib/python3.11/site-packages/pip/__init__.py");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/Resources/English.lproj/Documentation/index.html");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/lib/python3.11/ensurepip/__init__.py");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/lib/python3.11/site-packages/setuptools/__init__.py");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/lib/python3.11/__pycache__/module.pyc");

    pruneBundledMacPythonRuntime(root);

    assert.equal(fs.existsSync(path.join(root, "lib/python3.11/site-packages/pip")), false);
    assert.equal(fs.existsSync(path.join(versionRoot, "Resources/English.lproj/Documentation")), false);
    assert.equal(fs.existsSync(path.join(versionRoot, "lib/python3.11/ensurepip")), false);
    assert.equal(fs.existsSync(path.join(versionRoot, "lib/python3.11/site-packages/setuptools")), false);
    assert.equal(fs.existsSync(path.join(versionRoot, "lib/python3.11/__pycache__")), false);
    assert.equal(fs.existsSync(path.join(root, "lib/python3.11/site-packages/runtime_dependency")), true);
    assert.equal(fs.readlinkSync(path.join(root, "Frameworks/Python.framework/Versions/Current")), "3.11");
  });
});

test("portable runtime pruning keeps application dependencies", () => {
  for (const platformName of ["linux", "windows"]) {
    withTempRuntime((root) => {
      const stdlibRoot = platformName === "windows" ? "Lib" : "lib/python3.11";
      makeFile(root, `${stdlibRoot}/site-packages/runtime_dependency/__init__.py`);
      makeFile(root, `${stdlibRoot}/site-packages/pip/__init__.py`);
      makeFile(root, `${stdlibRoot}/idlelib/__init__.py`);
      makeFile(root, `${stdlibRoot}/tests/test_fixture.py`);
      makeFile(root, "share/docs/python/index.html");

      pruneBundledPortablePythonRuntime(root, platformName);

      assert.equal(fs.existsSync(path.join(root, stdlibRoot, "site-packages/pip")), false);
      assert.equal(fs.existsSync(path.join(root, stdlibRoot, "idlelib")), false);
      assert.equal(fs.existsSync(path.join(root, stdlibRoot, "tests")), false);
      assert.equal(fs.existsSync(path.join(root, "share/doc")), false);
      assert.equal(
        fs.existsSync(path.join(root, stdlibRoot, "site-packages/runtime_dependency")),
        true,
      );
    });
  }
});

test("windows runtime pruning drops the bundled python installer and pip launchers", () => {
  withTempRuntime((root) => {
    for (const relativePath of [
      "python.exe",
      "python3.exe",
      "pythonw.exe",
      "python311.dll",
      "python-3.11.9-amd64.exe",
      "Scripts/pip.exe",
      "Scripts/pip3.exe",
      "Scripts/pip3.11.exe",
      "Scripts/keep-me.exe",
      "Lib/site-packages/runtime_dependency/__init__.py",
    ]) {
      makeFile(root, relativePath);
    }

    pruneBundledPortablePythonRuntime(root, "windows");

    for (const removed of [
      "python-3.11.9-amd64.exe",
      "Scripts/pip.exe",
      "Scripts/pip3.exe",
      "Scripts/pip3.11.exe",
    ]) {
      assert.equal(fs.existsSync(path.join(root, removed)), false, removed);
    }
    for (const kept of [
      "python.exe",
      "python3.exe",
      "pythonw.exe",
      "python311.dll",
      "Scripts/keep-me.exe",
      "Lib/site-packages/runtime_dependency/__init__.py",
    ]) {
      assert.equal(fs.existsSync(path.join(root, kept)), true, kept);
    }
  });
});

test("linux runtime pruning leaves python-* named files alone", () => {
  withTempRuntime((root) => {
    makeFile(root, "bin/python-3.11-config.exe");

    pruneBundledPortablePythonRuntime(root, "linux");

    assert.equal(fs.existsSync(path.join(root, "bin/python-3.11-config.exe")), true);
  });
});

test("portable runtime pruning removes build-only dead weight (static lib, duplicate libpython, logs)", () => {
  withTempRuntime((root) => {
    makeFile(root, "lib/python3.11/config-3.11-x86_64-linux-gnu/libpython3.11.a");
    makeFile(root, "lib/python3.11/pydoc_data/topics.py");
    makeFile(root, "lib/python3.11/distutils/__init__.py");
    makeFile(root, "lib/python3.11/json/__init__.py");
    makeFile(root, "lib/python3.11/site-packages/runtime_dependency/__init__.py");
    makeFile(root, "lib/libpython3.11.so");
    makeFile(root, "lib/libpython3.11.so.1.0");
    makeFile(root, "lib/libpython3.so");
    makeFile(root, "lib/pkgconfig/python3.pc");
    makeFile(root, "build_output.txt");
    makeFile(root, "tools_structure.txt");
    makeFile(root, "bin/python3");

    pruneBundledPortablePythonRuntime(root, "linux");

    for (const gone of [
      "lib/python3.11/config-3.11-x86_64-linux-gnu",
      "lib/python3.11/pydoc_data",
      "lib/python3.11/distutils",
      "lib/libpython3.11.so",
      "lib/pkgconfig",
      "build_output.txt",
      "tools_structure.txt",
    ]) {
      assert.equal(fs.existsSync(path.join(root, gone)), false, gone);
    }
    for (const kept of [
      "lib/libpython3.11.so.1.0",
      "lib/libpython3.so",
      "lib/python3.11/json/__init__.py",
      "lib/python3.11/site-packages/runtime_dependency/__init__.py",
      "bin/python3",
    ]) {
      assert.equal(fs.existsSync(path.join(root, kept)), true, kept);
    }
  });
});

test("unversioned libpython is kept when it is the only copy", () => {
  withTempRuntime((root) => {
    makeFile(root, "lib/libpython3.11.so");
    pruneBundledPortablePythonRuntime(root, "linux");
    assert.equal(fs.existsSync(path.join(root, "lib/libpython3.11.so")), true);
  });
});

test("windows runtime pruning removes import libraries and build-only stdlib parts", () => {
  withTempRuntime((root) => {
    makeFile(root, "libs/python311.lib");
    makeFile(root, "Lib/pydoc_data/topics.py");
    makeFile(root, "Lib/distutils/__init__.py");
    makeFile(root, "Lib/json/__init__.py");
    makeFile(root, "python.exe");
    makeFile(root, "python311.dll");

    pruneBundledPortablePythonRuntime(root, "windows");

    assert.equal(fs.existsSync(path.join(root, "libs")), false);
    assert.equal(fs.existsSync(path.join(root, "Lib/pydoc_data")), false);
    assert.equal(fs.existsSync(path.join(root, "Lib/distutils")), false);
    for (const kept of ["Lib/json/__init__.py", "python.exe", "python311.dll"]) {
      assert.equal(fs.existsSync(path.join(root, kept)), true, kept);
    }
  });
});

test("mac runtime pruning removes the framework static library config and pkgconfig", () => {
  withTempRuntime((root) => {
    const versionRoot = path.join(root, "Frameworks/Python.framework/Versions/3.11");
    fs.mkdirSync(versionRoot, { recursive: true });
    fs.symlinkSync("3.11", path.join(root, "Frameworks/Python.framework/Versions/Current"));
    makeFile(root, "lib/python3.11/site-packages/runtime_dependency/__init__.py");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/lib/python3.11/config-3.11-darwin/libpython3.11.a");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/lib/python3.11/pydoc_data/topics.py");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/lib/python3.11/json/__init__.py");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/lib/pkgconfig/python3.pc");
    makeFile(root, "Frameworks/Python.framework/Versions/3.11/Python");

    pruneBundledMacPythonRuntime(root);

    assert.equal(fs.existsSync(path.join(versionRoot, "lib/python3.11/config-3.11-darwin")), false);
    assert.equal(fs.existsSync(path.join(versionRoot, "lib/python3.11/pydoc_data")), false);
    assert.equal(fs.existsSync(path.join(versionRoot, "lib/pkgconfig")), false);
    assert.equal(fs.existsSync(path.join(versionRoot, "lib/python3.11/json/__init__.py")), true);
    assert.equal(fs.existsSync(path.join(versionRoot, "Python")), true);
    assert.equal(fs.existsSync(path.join(root, "lib/python3.11/site-packages/runtime_dependency")), true);
  });
});
