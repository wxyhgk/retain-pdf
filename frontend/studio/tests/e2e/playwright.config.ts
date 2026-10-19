import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4400);
const retainmolPort = port + 599;
// Made once in the runner; workers inherit it, so the server and the tests share one copy.
process.env.STUDIO_BLOG_DIR ??= mkdtempSync(join(tmpdir(), 'studio-e2e-'));
// The drive (资料库) the Studio shows: a folder of its own, filled by the tests.
process.env.STUDIO_DRIVE_DIR ??= mkdtempSync(join(tmpdir(), 'studio-drive-'));
// With E2E_ISOLATED=1, where the server's own root is made (server.mjs): the tests write plugins into its copy, never into the repository.
if (process.env.E2E_ISOLATED === '1') process.env.E2E_ROOT_PARENT ??= mkdtempSync(join(tmpdir(), 'studio-e2e-root-'));

export default defineConfig({
	testDir: '.',
	testMatch: '*.spec.ts',
	// One Studio and one copy of the fixtures: tests take turns.
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${port}`,
		// The system Chrome, so no browser download is needed.
		channel: process.env.E2E_CHROME_CHANNEL ?? 'chrome',
		viewport: { width: 1400, height: 1000 },
		trace: 'retain-on-failure',
	},
	webServer: [
		{
			command: 'node tests/e2e/server.mjs',
			cwd: fileURLToPath(new URL('../..', import.meta.url)),
			url: `http://localhost:${port}/studio`,
			env: {
				E2E_PORT: String(port),
				STUDIO_BLOG_DIR: process.env.STUDIO_BLOG_DIR,
				STUDIO_DRIVE_DIR: process.env.STUDIO_DRIVE_DIR,
				E2E_ISOLATED: process.env.E2E_ISOLATED ?? '',
				E2E_ROOT_PARENT: process.env.E2E_ROOT_PARENT ?? '',
				// RetainMol is its stand-in, below.
				STUDIO_RETAINMOL_URL: `http://127.0.0.1:${retainmolPort}`,
			},
			reuseExistingServer: false,
			timeout: 120_000,
		},
		{
			command: 'node tests/e2e/fake-retainmol.mjs',
			cwd: fileURLToPath(new URL('../..', import.meta.url)),
			url: `http://127.0.0.1:${retainmolPort}/`,
			env: { FAKE_RETAINMOL_PORT: String(retainmolPort) },
			reuseExistingServer: false,
		},
	],
});
