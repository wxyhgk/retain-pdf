import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const fixtureRoot = mkdtempSync(join(tmpdir(), 'retainpdf-domain-pack-'))

try {
  const packResult = JSON.parse(execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', fixtureRoot],
    { cwd: packageRoot, encoding: 'utf8' },
  ))
  const packedFiles = new Set(packResult[0].files.map(({ path }) => path))

  assert.equal(
    Object.keys(packageJson.exports).some((subpath) => subpath.includes('*')),
    false,
    'public exports must be explicit rather than wildcard-based',
  )

  for (const [subpath, conditions] of Object.entries(packageJson.exports)) {
    for (const condition of ['types', 'import']) {
      const target = conditions[condition]
      assert.equal(typeof target, 'string', `${subpath} must define a ${condition} target`)
      assert.match(target, /^\.\/dist\//, `${subpath} ${condition} must target dist`)
      assert.ok(
        packedFiles.has(target.slice(2)),
        `${subpath} ${condition} target is missing from the package: ${target}`,
      )
    }
  }

  assert.equal(
    [...packedFiles].some((path) => path === 'src' || path.startsWith('src/')),
    false,
    'source files must not be published as deep-import escape hatches',
  )

  const consumerRoot = join(fixtureRoot, 'consumer')
  mkdirSync(consumerRoot)
  writeFileSync(
    join(consumerRoot, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  )
  const tarballPath = join(fixtureRoot, packResult[0].filename)
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-package-lock', '--no-audit', '--no-fund', tarballPath],
    { cwd: consumerRoot, stdio: 'pipe' },
  )
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "await Promise.all([import('@retainpdf/domain'), import('@retainpdf/domain/job'), import('@retainpdf/domain/job-status'), import('@retainpdf/domain/library')])",
    ],
    { cwd: consumerRoot, stdio: 'pipe' },
  )

  console.log(`verified installed ${packResult[0].filename}: ${packedFiles.size} files`)
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true })
}
