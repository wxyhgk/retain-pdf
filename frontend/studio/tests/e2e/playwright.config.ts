import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// With E2E_WORKERS=3, several Studios side by side, each with its own copy of everything a test writes to (the articles,
// the drive, the server's root), the test files shared out among them. One by default: on this machine (10 cores, the
// author's own server running) three took twice as long, the servers and browsers waiting on each other.
const workers = Math.max(1, Number(process.env.E2E_WORKERS ?? 1));
const basePort = Number(process.env.E2E_PORT ?? 4400);
// 20 apart: 4410 is the preview server's (preview-server.mjs).
const portOf = (slot: number) => basePort + 20 * slot;
const retainmolPort = basePort + 599;

// Made once, in the runner (workers inherit them): for each slot, its own folders.
if (!process.env.E2E_SLOTS_READY) {
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
		// The system Chrome, so no browser download is needed.
		channel: process.env.E2E_CHROME_CHANNEL ?? 'chrome',
		viewport: { width: 1400, height: 1000 },
		trace: 'retain-on-failure',
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
				// The AIs the terminal starts with a click: stand-ins that say where they were started (fake-agents/).
				STUDIO_TERMINAL_AGENT_DIR: fileURLToPath(new URL('./fake-agents', import.meta.url)),
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
