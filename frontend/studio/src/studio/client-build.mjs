#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { setPriority } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGES } from './page/page-styles.mjs';

/**
 * The Studio built, for other devices (其他设备访问). On this machine the Studio is served as its sources are (Vite's
 * dev server: a change seen at once), which is hundreds of modules and tens of megabytes, React's and Vue's checking
 * builds, every icon there is; another device, over a network, is given it built instead: bundled, made small, what a
 * page does not use until later (a molecule's viewer, the terminal) in parts of its own, fetched when it is used.
 *
 * Built in a process of its own (`node src/studio/client-build.mjs`), into `.studio-cache/client/`, when a device
 * first asks, and again after the Studio's code changes; until it is ready, a device is given the Studio as it is
 * here. Its files keep their names for good (each named by what it holds), so a device keeps them.
 */

/** Where the built Studio's files are asked for. */
export const CLIENT_BASE = '/studio-client/';
/** The blog's address (astro.config.mjs's `site`): links to its articles written in full count as theirs. */
export const SITE = 'https://wxyhgk.github.io';

/** The Studio's code, by the folders it is in: a change there, and the built one is out of date. */
const SOURCES = ['src', 'packages', 'plugins', join('third_party', 'milkdown', 'packages'), 'package-lock.json'];
const SKIPPED = new Set(['node_modules', 'lib', 'dist', '.git', 'test', 'tests', 'e2e', '__tests__']);
/** Files of earlier builds are kept this long (a page opened before may still fetch its parts), then removed. */
const KEPT = 24 * 3600_000;

/** What the built Studio's files are, by their ending. */
export const CLIENT_TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

/**
 * A page as the built Studio's (client-build.mjs): its stylesheets and scripts the built ones, the scripts it imports
 * asked for at once, KaTeX's fonts asked for by the names the build gave them; nothing of Vite's own (no
 * reloading on a change: another device reloads when it wants).
 */
export function builtPage(html, { styles, script, imports }, { stylesMark, entry, assets }) {
	const href = (file) => `${CLIENT_BASE}${file}`.replaceAll('"', '&quot;');
	const links = styles.map((css) => `<link rel="stylesheet" href="${href(css)}" />`).join('\n\t\t');
	const scripts = [...imports.map((file) => `<link rel="modulepreload" href="${href(file)}" />`), `<script type="module" src="${href(script)}"></script>`].join('\n\t\t');
	return html
		.replace(stylesMark, () => links)
		.replace(`<script type="module" src="${entry}"></script>`, () => scripts)
		.replace(/(<link rel="preload" href=")[^"]*\/(KaTeX_[\w-]+)\.woff2("[^>]*>)/gu, (whole, before, font, after) => {
			const built = assets.find((file) => file.startsWith(`${font}-`) && file.endsWith('.woff2'));
			return built ? `${before}${href(`assets/${built}`)}${after}` : '';
		});
}

/** What the Studio's server and its build share of Vite's configuration. */
export function sharedConfig({ root, site = SITE }) {
	return {
		// What the Studio's code reads of its build (the blog's address, as Astro gave it).
		define: {
			'import.meta.env.SITE': JSON.stringify(site),
			// The editor's menus are Vue's (Crepe): its build's switches, as its own build sets them.
			__VUE_OPTIONS_API__: 'true',
			__VUE_PROD_DEVTOOLS__: 'false',
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
		},
		resolve: { alias: [{ find: /^@studio\//u, replacement: `${resolve(root, 'src', 'studio')}/` }] },
	};
}

/** The Studio's code as it is now, in a word: its files, how many, the last changed when (a build is of one such). */
export function sourceStamp(root) {
	let count = 0;
	let latest = 0;
	let bytes = 0;
	const walk = (path) => {
		let stats;
		try {
			stats = statSync(path);
		} catch {
			return;
		}
		if (stats.isDirectory()) {
			for (const entry of readdirSync(path)) if (!SKIPPED.has(entry) && !entry.startsWith('.')) walk(join(path, entry));
			return;
		}
		count += 1;
		bytes += stats.size;
		latest = Math.max(latest, stats.mtimeMs);
	};
	for (const source of SOURCES) walk(resolve(root, source));
	return `${count}-${bytes}-${Math.round(latest)}`;
}

/** Whether a file is the Studio's code (a change to it makes the built one out of date). */
export function isSource(root, file) {
	return SOURCES.some((source) => file === resolve(root, source) || file.startsWith(resolve(root, source) + sep));
}

/**
 * Builds the Studio into `outDir`: each page (page-styles.mjs) one entry, its stylesheets first and in their order,
 * then its script; `built.json` says which files each page is and the code's `stamp` it was built from.
 */
export async function buildClient({ root, outDir, stamp = sourceStamp(root), site = SITE }) {
	const { build } = await import('vite');
	const { default: react } = await import('@vitejs/plugin-react');
	const { default: tailwindcss } = await import('@tailwindcss/vite');
	const { default: milkdownSource } = await import('../plugins/milkdown-source.mjs');
	const pageFolder = resolve(root, 'src', 'studio', 'page');
	const PREFIX = '\0studio-page:';
	const HAD = '\0studio-page-had.css';
	/**
	 * A page's entry: its stylesheets, in order, then its script. A stylesheet the page has, imported by a script too,
	 * is had already (as on this machine, where the page's own is that one): in the page's place, not moved after it.
	 */
	const pageEntry = (name) => {
		const page = PAGES[name];
		const imports = [...page.styles.map((css) => (css.startsWith('.') ? resolve(pageFolder, css) : css)), resolve(root, page.entry.slice(1))];
		let had = new Set();
		return {
			name: 'studio-page-built',
			enforce: 'pre',
			async buildStart() {
				const found = await Promise.all(page.styles.map((css) => this.resolve(css.startsWith('.') ? resolve(pageFolder, css) : css, resolve(pageFolder, 'render.tsx'))));
				had = new Set(found.flatMap((each) => (each ? [each.id] : [])));
			},
			async resolveId(id, importer, options) {
				if (id === `${PREFIX}${name}` || id === HAD) return id;
				if (!importer || importer.startsWith(PREFIX) || !/\.css(?:$|\?)/u.test(id)) return null;
				const found = await this.resolve(id, importer, { ...options, skipSelf: true });
				return found && had.has(found.id) ? HAD : null;
			},
			load(id) {
				if (id === HAD) return '';
				return id === `${PREFIX}${name}` ? imports.map((imported) => `import ${JSON.stringify(imported)};`).join('\n') : null;
			},
		};
	};
	const shared = sharedConfig({ root, site });
	const built = { stamp, at: Date.now(), pages: {} };
	const named = new Set();
	// Each page built by itself: what a page imports, stylesheets with it, all in its one stylesheet, in the order it is
	// imported in, as on this machine (two pages built together would share some, in a file of their own, after it).
	for (const name of Object.keys(PAGES)) {
		const manifestFile = `manifest-${name}.json`;
		await build({
			root,
			configFile: false,
			logLevel: 'warn',
			base: CLIENT_BASE,
			publicDir: false,
			...shared,
			plugins: [react({ include: /\/src\/studio\/.*\.tsx$/u }), tailwindcss(), milkdownSource({ root, build: true }), pageEntry(name)],
			build: {
				outDir,
				emptyOutDir: false,
				manifest: manifestFile,
				sourcemap: false,
				chunkSizeWarningLimit: 100_000,
				rolldownOptions: { input: { [name]: `${PREFIX}${name}` } },
			},
		});
		const manifest = JSON.parse(readFileSync(join(outDir, manifestFile), 'utf8'));
		for (const chunk of Object.values(manifest)) for (const file of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) named.add(file);
		const key = Object.keys(manifest).find((each) => manifest[each].isEntry);
		// What the page fetches at once: its script, the scripts that one imports (to ask for together), their styles.
		const imports = new Set();
		const styles = new Set(manifest[key].css ?? []);
		const walk = (each) => {
			for (const imported of manifest[each]?.imports ?? []) {
				if (imports.has(manifest[imported].file)) continue;
				imports.add(manifest[imported].file);
				for (const css of manifest[imported].css ?? []) styles.add(css);
				walk(imported);
			}
		};
		walk(key);
		// A stylesheet emptied (all of it the page's own, had already): not asked for.
		built.pages[name] = { script: manifest[key].file, imports: [...imports], styles: [...styles].filter((css) => statSync(join(outDir, css)).size > 1) };
	}
	writeFileSync(join(outDir, 'built.json'), JSON.stringify(built));
	// Files no build of today names: gone.
	const assets = join(outDir, 'assets');
	for (const file of existsSync(assets) ? readdirSync(assets) : []) {
		const path = join(assets, file);
		if (!named.has(`assets/${file}`) && Date.now() - statSync(path).mtimeMs > KEPT) rmSync(path, { force: true });
	}
	return built;
}

/**
 * The built Studio of a server: the one there, if it is of the code as it is now; built (again) in the background
 * when a device wants it and it is not. `folder` given (the browser tests' one, built before they start) is used as it is.
 */
export class ClientBuilds {
	/**
	 * @param {{ root: string, folder?: string, fixed?: boolean, warn?: (message: string) => void }} options
	 */
	constructor({ root, folder = resolve(root, '.studio-cache', 'client'), fixed = false, warn = (message) => console.warn(message) }) {
		this.root = root;
		this.folder = folder;
		this.fixed = fixed;
		this.warn = warn;
		this.wanted = false;
		this.building = null;
		this.again = false;
		this.stamp = null;
		this.timer = null;
		this.built = this.#read();
	}

	#read() {
		try {
			return JSON.parse(readFileSync(join(this.folder, 'built.json'), 'utf8'));
		} catch {
			return null;
		}
	}

	#fresh() {
		if (!this.built) return false;
		if (this.fixed) return true;
		this.stamp ??= sourceStamp(this.root);
		return this.built.stamp === this.stamp;
	}

	/** The built Studio's pages (built.json's), if it is of the code as it is now; null, and it is built, if not. */
	current() {
		this.want();
		return this.#fresh() ? this.built : null;
	}

	/** The names of the built Studio's files (assets/), read once a build. */
	assetNames() {
		if (this.assets?.at !== this.built?.at) {
			const folder = join(this.folder, 'assets');
			this.assets = { at: this.built?.at, files: existsSync(folder) ? readdirSync(folder) : [] };
		}
		return this.assets.files;
	}

	/** A device wants the built Studio: built now if it is out of date, and from now on after the code changes. */
	want() {
		if (this.fixed) return;
		this.wanted = true;
		if (!this.#fresh()) this.#start();
	}

	/** A file changed (the server's watcher): the Studio's code, and the built one is out of date; built again soon. */
	changed(file) {
		if (this.fixed || !isSource(this.root, file)) return;
		this.stamp = null;
		if (!this.wanted) return;
		clearTimeout(this.timer);
		// Saved a few at a time (an AI's edit): built once they are.
		this.timer = setTimeout(() => this.#start(), 3000);
		this.timer.unref?.();
	}

	#start() {
		if (this.building) {
			this.again = true;
			return;
		}
		const stamp = (this.stamp ??= sourceStamp(this.root));
		mkdirSync(this.folder, { recursive: true });
		const started = Date.now();
		const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', this.root, '--out', this.folder, '--stamp', stamp], { cwd: this.root, stdio: ['ignore', 'ignore', 'pipe'] });
		// Behind the Studio itself: the author's typing first.
		try {
			setPriority(child.pid, 10);
		} catch {
			// Not allowed: as it is.
		}
		let said = '';
		child.stderr.on('data', (data) => (said = `${said}${data}`.slice(-4000)));
		this.building = new Promise((done) => {
			child.once('exit', (code) => {
				this.building = null;
				if (code === 0) this.built = this.#read();
				else this.warn(`[studio] 给其他设备的 Studio 没能构建（${code}）：${said.trim().split('\n').slice(-5).join(' ')}`); // i18n-ignore: developer log
				if (code === 0 && process.env.STUDIO_CLIENT_LOG) this.warn(`[studio] built for other devices in ${Date.now() - started} ms`); // i18n-ignore: developer log
				if (this.again) {
					this.again = false;
					if (!this.#fresh()) this.#start();
				}
				done();
			});
		});
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const asked = (name) => {
		const at = process.argv.indexOf(`--${name}`);
		return at > 0 ? process.argv[at + 1] : undefined;
	};
	const root = resolve(asked('root') ?? process.cwd());
	const outDir = resolve(asked('out') ?? join(root, '.studio-cache', 'client'));
	mkdirSync(outDir, { recursive: true });
	const built = await buildClient({ root, outDir, stamp: asked('stamp') });
	console.log(JSON.stringify({ outDir, stamp: built.stamp }));
}
