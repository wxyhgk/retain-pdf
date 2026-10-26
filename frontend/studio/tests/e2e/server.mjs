// The Studio for browser tests: a dev server of its own, on a copy of the
// fixture articles (STUDIO_BLOG_DIR), so a test can save without touching blog/.
//
// With E2E_ISOLATED=1 it also runs from a folder of its own (src/ and the
// configuration copied, the rest linked), so that beside the author's own
// dev server it keeps to its own .astro/: two servers on one root both
// write .astro/data-store.json, and break each other's writes.
import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dev } from 'astro';

const repository = fileURLToPath(new URL('../..', import.meta.url));
const articles = process.env.STUDIO_BLOG_DIR ?? mkdtempSync(join(tmpdir(), 'studio-e2e-'));
cpSync(fileURLToPath(new URL('./fixtures/blog', import.meta.url)), articles, { recursive: true });
process.env.STUDIO_BLOG_DIR = articles;

/** A root of its own: what Astro reads as the project's own is copied, the rest linked to the repository. */
function isolatedRoot() {
	// The folder by its real name: on macOS the temporary ones are under a link (/var → /private/var), which Astro would see as two places.
	// Named as the repository is: the terminal shows its folder's name.
	const parent = process.env.E2E_ROOT_PARENT || mkdtempSync(join(tmpdir(), 'studio-e2e-root-'));
	const root = join(realpathSync(parent), basename(repository));
	mkdirSync(root);
	// Copied: what the server reads and the tests may write in (a 小程序 of apps/ made by a test stays in the copy).
	for (const name of ['src', 'plugins', 'apps', 'astro.config.mjs', 'package.json', 'tsconfig.json']) if (existsSync(join(repository, name))) cpSync(join(repository, name), join(root, name), { recursive: true });
	for (const name of ['bin', 'node_modules', 'packages', 'public', 'third_party', 'tools', 'vendor']) symlinkSync(join(repository, name), join(root, name));
	mkdirSync(join(root, 'blog'));
	return root;
}

const isolated = process.env.E2E_ISOLATED === '1';
const root = isolated ? isolatedRoot() : repository;
if (isolated) process.chdir(root);

const port = Number(process.env.E2E_PORT ?? 4400);
// The editor bundled as the other dependencies are (milkdown-source.mjs): a page loads in some 400 requests, not 1000.
process.env.STUDIO_MILKDOWN_BUNDLED = '1';
// The terminal's shell without the author's own startup files (ZDOTDIR, for zsh): a conda or a prompt theme there took
// it ten seconds and more to start with other test servers beside it, and the tests are the same on every machine.
process.env.ZDOTDIR = mkdtempSync(join(tmpdir(), 'studio-e2e-zsh-'));
const server = await dev({
	root,
	logLevel: 'warn',
	server: { port },
	// Its own Vite cache too, kept between runs so that only the first one waits for the dependencies to be bundled.
	// One per port: servers run side by side (playwright.config.ts), and two bundling into one cache would clash.
	...(isolated ? { vite: { cacheDir: join(repository, 'node_modules', `.vite-e2e-${port}`), server: { fs: { allow: [root, repository] } } } } : {}),
});
console.log(`studio e2e server on http://localhost:${port}, articles in ${articles}${isolated ? `, root ${root}` : ''}`);

const stop = async () => {
	await server.stop();
	rmSync(articles, { recursive: true, force: true });
	if (isolated) rmSync(join(root, '..'), { recursive: true, force: true });
	process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
