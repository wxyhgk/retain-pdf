import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const WEB_SOURCE_ROOT = join(REPO_ROOT, "frontend/web/src");
const PACKAGE_BOUNDARIES = [
  {
    name: "job",
    publicEntry: "@retainpdf/domain/job",
    sourceRoot: join(REPO_ROOT, "frontend/packages/domain/src/job"),
    webMirrorRoot: join(REPO_ROOT, "frontend/web/src/js/job"),
    sourceWhiteboxAllowlist: new Map([
      ["architecture/architecture-boundaries.test.mjs", new Set([""])],
      ["contracts/job-status-contract.test.mjs", new Set([
        "normalize.ts",
        "types.ts",
      ])],
    ]),
  },
  {
    name: "job-status",
    publicEntry: "@retainpdf/domain/job-status",
    sourceRoot: join(REPO_ROOT, "frontend/packages/domain/src/job-status"),
    webMirrorRoot: join(REPO_ROOT, "frontend/web/src/js/job-status"),
    sourceWhiteboxAllowlist: new Map([
      ["contracts/job-status-contract.test.mjs", new Set([
        "",
        "types.ts",
        "job-stage-contract-adapter.ts",
        "public-stage-engine.ts",
        "summary/job-status-summary-progress.ts",
      ])],
    ]),
  },
];

function filesUnder(root) {
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    if (statSync(current).isDirectory()) {
      for (const entry of readdirSync(current)) pending.push(join(current, entry));
    } else {
      files.push(current);
    }
  }
  return files.sort();
}

function importSpecifiers(source) {
  const pattern = /\b(?:import\s*(?:\(|(?:type\s+)?(?:[^"'();]*?\s+from\s+)?)|export\s+(?:type\s+)?[^"';]*?\s+from\s+|require\s*\()\s*["']([^"']+)["']/g;
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

function sourcePathLiterals(source) {
  const pattern = /(["'])([^"'\n]*packages\/domain\/src\/(job-status|job)(?:\/[^"'\n]*)?)\1/g;
  return Array.from(source.matchAll(pattern), (match) => ({
    literal: match[2],
    packageName: match[3],
  }));
}

function assertDomainPackageBoundaries() {
  const thisFile = fileURLToPath(import.meta.url);
  const testFiles = filesUnder(TESTS_ROOT)
    .filter((file) => file.endsWith(".mjs"));
  const consumerFiles = [
    ...testFiles,
    ...filesUnder(WEB_SOURCE_ROOT).filter((file) => /\.(?:[cm]?js|tsx?)$/.test(file)),
  ];
  const deepImports = [];
  const sourceWhiteboxes = [];

  for (const file of consumerFiles) {
    const source = readFileSync(file, "utf8");
    for (const specifier of importSpecifiers(source)) {
      for (const boundary of PACKAGE_BOUNDARIES) {
        if (specifier.startsWith(`${boundary.publicEntry}/`)) {
          deepImports.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
        }
        if (specifier.startsWith(".")) {
          const target = resolve(dirname(file), specifier);
          const forbiddenRoots = [boundary.sourceRoot, boundary.webMirrorRoot];
          if (forbiddenRoots.some((root) => (
            target === root || target.startsWith(`${root}${sep}`)
          ))) {
            deepImports.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
          }
        }
      }
    }
  }

  for (const file of testFiles) {
    if (file === thisFile) continue;
    const source = readFileSync(file, "utf8");
    for (const { literal, packageName } of sourcePathLiterals(source)) {
      const marker = `frontend/packages/domain/src/${packageName}`;
      const markerIndex = literal.indexOf(marker);
      const sourcePath = literal.slice(markerIndex + marker.length).replace(/^\//, "");
      sourceWhiteboxes.push([packageName, relative(TESTS_ROOT, file), sourcePath]);
    }
  }

  assert.deepEqual(
    deepImports,
    [],
    "production and tests must use only @retainpdf/domain/job and /job-status root entries",
  );
  for (const [packageName, testFile, sourcePath] of sourceWhiteboxes) {
    const boundary = PACKAGE_BOUNDARIES.find((candidate) => candidate.name === packageName);
    assert.ok(
      boundary?.sourceWhiteboxAllowlist.get(testFile)?.has(sourcePath),
      `unapproved ${packageName} source whitebox: ${testFile} -> ${sourcePath}`,
    );
  }

  const expectedWhiteboxes = PACKAGE_BOUNDARIES.flatMap((boundary) => (
    Array.from(boundary.sourceWhiteboxAllowlist, ([testFile, paths]) => (
      Array.from(paths, (sourcePath) => [boundary.name, testFile, sourcePath])
    )).flat()
  )).sort();
  assert.deepEqual(sourceWhiteboxes.sort(), expectedWhiteboxes);
}

test("test files stay grouped in domain directories", () => {
  const rootTests = readdirSync(TESTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.mjs"))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(
    rootTests,
    [],
    `move root-level tests into a domain directory: ${rootTests.join(", ")}`,
  );
  assertDomainPackageBoundaries();
});
