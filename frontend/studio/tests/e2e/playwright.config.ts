import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4400);
// Made once in the runner; workers inherit it, so the server and the tests share one copy.
process.env.STUDIO_BLOG_DIR ??= mkdtempSync(join(tmpdir(), 'studio-e2e-'));

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
	webServer: {
		command: 'node tests/e2e/server.mjs',
		cwd: fileURLToPath(new URL('../..', import.meta.url)),
		url: `http://localhost:${port}/studio`,
		env: { E2E_PORT: String(port), STUDIO_BLOG_DIR: process.env.STUDIO_BLOG_DIR },
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
