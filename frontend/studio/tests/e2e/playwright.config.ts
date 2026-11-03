import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism, homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// Several Studios side by side, each with its own copy of everything a test writes to (the articles, the drive, the
// server's root), the test files shared out among them: each has its own dev server and browser, so a few less than the
// cores (6 on this machine of 10: the whole suite in 4½ minutes, against 15 or more one at a time). E2E_WORKERS=n to choose.
const workers = Math.max(1, Number(process.env.E2E_WORKERS ?? Math.min(6, Math.floor(availableParallelism() * 0.6))));
const basePort = Number(process.env.E2E_PORT ?? 4400);
// 20 apart: 4410 is the preview server's (preview-server.mjs).
const portOf = (slot: number) => basePort + 20 * slot;
const retainmolPort = basePort + 599;

/**
 * The browser for Chromium: Playwright's own headless one, not the system's Chrome (E2E_CHROME_CHANNEL=chrome for that).
 * Google Chrome starts its updater and its crash reporter, which keep the browser's output open for minutes after it is
 * closed; a worker waits for that before it ends, and three took 16 minutes for 90 seconds of tests. Nothing is
 * downloaded here: when the one this Playwright asks for is not installed, the nearest one in its cache stands in.
 */
function headlessShell(): string | undefined {
	const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright') : join(homedir(), '.cache', 'ms-playwright'));
	const browsers = JSON.parse(readFileSync(join(dirname(createRequire(import.meta.url).resolve('playwright-core/package.json')), 'browsers.json'), 'utf8'));
	const wanted = Number(browsers.browsers.find((browser: { name: string }) => browser.name === 'chromium-headless-shell')?.revision);
	const cached = existsSync(cache) ? readdirSync(cache).flatMap((name) => /^chromium_headless_shell-(\d+)$/u.exec(name)?.[1] ?? []).map(Number) : [];
	if (!cached.length || cached.includes(wanted)) return undefined;
	const nearest = cached.sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0];
	const folder = join(cache, `chromium_headless_shell-${nearest}`);
	for (const build of readdirSync(folder)) {
		const executable = join(folder, build, 'chrome-headless-shell');
		if (existsSync(executable)) return executable;
	}
	return undefined;
}

// Made once, in the runner (workers inherit them): for each slot, its own folders.
if (!process.env.E2E_SLOTS_READY) {
	// One run at a time on these ports: a second one would empty the first one's folders under it.
	for (let slot = 0; slot < workers; slot += 1) {
		const lock = join(tmpdir(), `studio-e2e-${portOf(slot)}.lock`);
		const holder = existsSync(lock) ? Number(readFileSync(lock, 'utf8')) : 0;
		let alive = false;
		try {
			alive = holder > 0 && process.kill(holder, 0);
		} catch {
			alive = false;
		}
		if (alive) throw new Error(`Another browser test run (process ${holder}) is using port ${portOf(slot)}: wait for it, or set E2E_PORT.`);
		writeFileSync(lock, String(process.pid));
		process.on('exit', () => rmSync(lock, { force: true }));
	}
	// Which browser the run is for (--browser webkit), told to the workers, which are not given the command line.
	const named = process.argv.findIndex((arg) => arg === '--browser' || arg.startsWith('--browser='));
	process.env.E2E_BROWSER = named < 0 ? 'chromium' : process.argv[named].includes('=') ? process.argv[named].split('=')[1] : process.argv[named + 1];
	for (let slot = 0; slot < workers; slot += 1) {
		process.env[`STUDIO_BLOG_DIR_${slot}`] = mkdtempSync(join(tmpdir(), 'studio-e2e-'));
		// The drive (资料库) the Studio shows: a folder of its own, filled by the tests.
		process.env[`STUDIO_DRIVE_DIR_${slot}`] = mkdtempSync(join(tmpdir(), 'studio-drive-'));
		// With E2E_ISOLATED=1, where the server's own root is made (server.mjs): the tests write plugins into its copy,
		// never into the repository. The same place at every run (one per port), emptied first: Vite keys its cache of
		// bundled dependencies on the root's path, so a new one each run bundled them all again.
		if (process.env.E2E_ISOLATED === '1') {
			const parent = join(tmpdir(), `studio-e2e-root-${portOf(slot)}`);
			rmSync(parent, { recursive: true, force: true });
			mkdirSync(parent, { recursive: true });
			process.env[`E2E_ROOT_PARENT_${slot}`] = parent;
		}
	}
	process.env.E2E_SLOTS_READY = '1';
}

// In a worker, its slot's (Playwright numbers them from 0, and a worker started again after a failure keeps its
// number): what the tests read (studio.ts, the specs) is that slot's.
const slot = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
process.env.STUDIO_BLOG_DIR = process.env[`STUDIO_BLOG_DIR_${slot}`];
process.env.STUDIO_DRIVE_DIR = process.env[`STUDIO_DRIVE_DIR_${slot}`];
if (process.env.E2E_ISOLATED === '1') process.env.E2E_ROOT_PARENT = process.env[`E2E_ROOT_PARENT_${slot}`];

export default defineConfig({
	testDir: '.',
	testMatch: '*.spec.ts',
	// A test file runs in one worker, its tests in turn; the files are shared out.
	workers,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${portOf(slot)}`,
		channel: process.env.E2E_CHROME_CHANNEL || undefined,
		...(process.env.E2E_CHROME_CHANNEL || process.env.E2E_BROWSER !== 'chromium' ? {} : { launchOptions: { executablePath: headlessShell() } }),
		viewport: { width: 1400, height: 1000 },
		// A failure's trace holds every module the page loaded and takes a minute to write: kept with E2E_TRACE=1.
		trace: process.env.E2E_TRACE ? 'retain-on-failure' : 'off',
		screenshot: 'only-on-failure',
	},
	webServer: [
		...Array.from({ length: workers }, (_, slot) => ({
			command: 'node tests/e2e/server.mjs',
			cwd: fileURLToPath(new URL('../..', import.meta.url)),
			url: `http://localhost:${portOf(slot)}/studio`,
			env: {
				E2E_PORT: String(portOf(slot)),
				STUDIO_BLOG_DIR: process.env[`STUDIO_BLOG_DIR_${slot}`] ?? '',
				STUDIO_DRIVE_DIR: process.env[`STUDIO_DRIVE_DIR_${slot}`] ?? '',
				E2E_ISOLATED: process.env.E2E_ISOLATED ?? '',
				E2E_ROOT_PARENT: process.env[`E2E_ROOT_PARENT_${slot}`] ?? '',
				// RetainMol is its stand-in, below (it keeps nothing: one serves them all).
				STUDIO_RETAINMOL_URL: `http://127.0.0.1:${retainmolPort}`,
				// The AI panel's adapters: stand-ins (fake-agents/: Claude Code's, pi's).
				STUDIO_TERMINAL_AGENT_DIR: fileURLToPath(new URL('./fake-agents', import.meta.url)),
				// Claude Code and Codex on (设置 › AI › 高级) while the settings say nothing, Claude's stand-in the one talked to
				// first: the tests were written so.
				STUDIO_AGENTS_ON: 'claude,codex',
				// OCR 成子页面: a stand-in for `paddleocr api` (fake-agents/paddleocr).
				STUDIO_OCR_COMMAND: fileURLToPath(new URL('./fake-agents/paddleocr', import.meta.url)),
			},
			reuseExistingServer: false,
			timeout: 120_000,
		})),
		{
			command: 'node tests/e2e/fake-retainmol.mjs',
			cwd: fileURLToPath(new URL('../..', import.meta.url)),
			url: `http://127.0.0.1:${retainmolPort}/`,
			env: { FAKE_RETAINMOL_PORT: String(retainmolPort) },
			reuseExistingServer: false,
		},
	],
});
