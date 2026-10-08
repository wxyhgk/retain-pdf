"use strict";

// retain-pdf-rendering/output/typst-runner
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. Runs the Typst CLI. The binary and the font directories are
// always given by the caller; with ignoreSystemFonts (the default) every
// machine sets text with exactly the given font files.
//
//   const typst = createTypst({ bin: "/usr/local/bin/typst", fontPaths: [dir] });
//   typst.compile("overlay.typ", "overlay.pdf", outDir);

const { spawnSync } = require("node:child_process");

function createTypst({ bin = "typst", fontPaths = [], ignoreSystemFonts = true } = {}) {
  const invocations = [];
  const fontArgs = [...fontPaths.flatMap(dir => ["--font-path", dir]), ...(ignoreSystemFonts ? ["--ignore-system-fonts"] : [])];

  function run(args, cwd) {
    const started = performance.now();
    const result = spawnSync(bin, [...args, ...fontArgs], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    const ms = performance.now() - started;
    invocations.push({ command: args[0], ms: Math.round(ms) });
    if (result.error) throw new Error(`typst ${args[0]} could not run (${bin}): ${result.error.message}`);
    if (result.status !== 0) throw new Error(`typst ${args[0]} failed (${result.status}):\n${result.stderr}`);
    return { stdout: result.stdout, stderr: result.stderr, ms };
  }

  // Evaluates every <rpr-measure> metadata value in `file` (relative to cwd).
  function queryMeasurements(file, cwd) {
    const { stdout, ms } = run(["eval", "query(<rpr-measure>).map(it => it.value)", "--in", file, "--format", "json"], cwd);
    return { values: JSON.parse(stdout), ms };
  }

  function compile(file, output, cwd) {
    return run(["compile", file, output], cwd);
  }

  function version() {
    const result = spawnSync(bin, ["--version"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "";
  }

  return { run, compile, queryMeasurements, version, invocations, bin, fontPaths };
}

module.exports = { createTypst };
