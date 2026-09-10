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
