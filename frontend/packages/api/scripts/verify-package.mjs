import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const packedTargets = new Set();

for (const [subpath, conditions] of Object.entries(manifest.exports)) {
  assert.equal(typeof conditions, "object", `${subpath} must use conditional exports`);
  assert.match(conditions.types, /^\.\/dist\/.+\.d\.ts$/, `${subpath} must export declarations from dist`);
  assert.match(conditions.import, /^\.\/dist\/.+\.js$/, `${subpath} must export ESM from dist`);
  assert.ok(!conditions.types.includes("/src/") && !conditions.import.includes("/src/"), `${subpath} must not expose source files`);

  await access(resolve(packageRoot, conditions.types));
  await access(resolve(packageRoot, conditions.import));
  packedTargets.add(conditions.types.slice(2));
  packedTargets.add(conditions.import.slice(2));

  const specifier = subpath === "." ? manifest.name : `${manifest.name}${subpath.slice(1)}`;
  await import(specifier);
}

const runtime = await import(`${manifest.name}/runtime`);
for (const exportName of ["API_PREFIX", "buildApiHeaders", "buildApiUrl", "getRuntimeConfig"]) {
  assert.ok(exportName in runtime, `runtime entrypoint must export ${exportName}`);
}

const packOutput = execFileSync(
  "npm",
  ["pack", "--dry-run", "--ignore-scripts", "--json"],
  { cwd: packageRoot, encoding: "utf8" },
);
const [packResult] = JSON.parse(packOutput);
const packedFiles = new Set(packResult.files.map(({ path }) => path));

for (const target of packedTargets) {
  assert.ok(packedFiles.has(target), `packed tarball is missing ${target}`);
}
assert.ok([...packedFiles].every((path) => !path.startsWith("src/")), "packed tarball must not contain TypeScript sources");

// Keep stdout clean so `npm pack --json` remains machine-readable when this
// verifier runs through the prepack lifecycle.
console.error(`verified ${Object.keys(manifest.exports).length} public entrypoints and ${packedFiles.size} packed files`);
