// The Studio for browser tests: a dev server of its own, on a copy of the
// fixture articles (STUDIO_BLOG_DIR), so a test can save without touching blog/.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dev } from 'astro';

const root = fileURLToPath(new URL('../..', import.meta.url));
const articles = process.env.STUDIO_BLOG_DIR ?? mkdtempSync(join(tmpdir(), 'studio-e2e-'));
cpSync(fileURLToPath(new URL('./fixtures/blog', import.meta.url)), articles, { recursive: true });
process.env.STUDIO_BLOG_DIR = articles;

const port = Number(process.env.E2E_PORT ?? 4400);
const server = await dev({ root, logLevel: 'warn', server: { port } });
console.log(`studio e2e server on http://localhost:${port}, articles in ${articles}`);

const stop = async () => {
	await server.stop();
	rmSync(articles, { recursive: true, force: true });
	process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
