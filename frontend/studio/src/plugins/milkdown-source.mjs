import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { transformWithOxc } from 'vite';

/**
 * The editor's entries the Studio imports, bundled with the other dependencies when `bundled` (the browser tests'
 * server, STUDIO_MILKDOWN_BUNDLED=1): as source the editor is some 600 modules, each fetched by every page a test
 * opens. The author's own server keeps it as source, to be changed and seen at once.
 */
const ENTRIES = [
	'@milkdown/crepe',
	'@milkdown/crepe/feature/block-edit',
	'@milkdown/ctx',
	'@milkdown/utils',
	'@milkdown/kit/core',
	'@milkdown/kit/ctx',
	'@milkdown/kit/utils',
	'@milkdown/kit/transformer',
	'@milkdown/kit/preset/commonmark',
	'@milkdown/kit/preset/gfm',
	'@milkdown/kit/plugin/block',
	'@milkdown/kit/plugin/diff',
	'@milkdown/kit/component/link-tooltip',
	'@milkdown/kit/component/diff',
	'@milkdown/kit/prose/state',
	'@milkdown/kit/prose/model',
	'@milkdown/prose/state',
	'@milkdown/prose/view',
	'@milkdown/prose/model',
	'@milkdown/prose/transform',
	'@milkdown/prose/keymap',
	'@milkdown/prose/inputrules',
	'@milkdown/prose/history',
	'@milkdown/prose/schema-list',
	'@milkdown/prose/commands',
];

/**
 * The Studio's editor from Milkdown's source in `third_party/milkdown` (a git
 * submodule) instead of the npm packages, so a change to it shows on save.
 * Only the dev server does this; the blog's build never loads the editor, and
 * without the submodule the npm packages are used as before.
 *
 * Every `@milkdown/*` import goes to that package's source, as Milkdown's own
 * workspace resolves it. Anything else the source imports comes from this
 * project's node_modules when it is there, so the editor and the Studio share
 * one ProseMirror, one Vue, one KaTeX.
 * @param {{ root?: string, bundled?: boolean }} [options]
 * @returns {import('vite').Plugin}
 */
export default function milkdownSource({ root = process.cwd(), bundled = process.env.STUDIO_MILKDOWN_BUNDLED === '1' } = {}) {
	// By its real name: Vite names the files it loads so, and third_party/ may be a link (a test server's own root).
	const folder = resolve(root, 'third_party', 'milkdown');
	const milkdown = existsSync(folder) ? realpathSync(folder) : folder;
	const packages = findPackages(join(milkdown, 'packages'));
	const projectImporter = join(root, 'package.json');
	const inMilkdown = (file) => file?.startsWith(milkdown + sep);

	return {
		name: 'milkdown-source',
		apply: 'serve',
		enforce: 'pre',
		config() {
			if (!packages.size) return;
			// Milkdown's docs, demos and build output are not the editor.
			const ignored = ['docs', 'e2e', 'storybook', 'dev', 'packages/**/lib'].map((dir) => `${milkdown}/${dir}/**`);
			// A stylesheet's `@import` is resolved without plugins: the theme's KaTeX styles are the page's own.
			const alias = [{ find: /^katex\/dist\/(.+\.css)$/u, replacement: join(root, 'node_modules', 'katex', 'dist', '$1') }];
			// Bundled: the bundler finds the entries by the aliases alone (not by this plugin), so to their source.
			if (bundled) {
				for (const id of ENTRIES) {
					const [, name, subpath] = /^(@milkdown\/[^/]+)(\/.+)?$/u.exec(id);
					const source = packages.has(name) ? sourceEntry(packages.get(name), subpath ?? '') : null;
					if (source) alias.push({ find: new RegExp(`^${id.replaceAll('/', '\\/')}$`, 'u'), replacement: source });
				}
			}
			return { resolve: { alias }, server: { watch: { ignored } }, ...(bundled ? { optimizeDeps: { include: ENTRIES, rolldownOptions: { plugins: [bundling()] } } } : {}) };
		},
		configResolved(config) {
			if (!packages.size) config.logger.warn('[milkdown-source] third_party/milkdown 没有拉取，Studio 的编辑器需要它：npm run milkdown:setup'); // i18n-ignore: developer log
		},
		resolveId(id, importer, options) {
			return toSource(this, id, importer, options);
		},
		transform: toJs,
	};

	/** An `@milkdown/*` import: that package's source; anything else the source imports, this project's. */
	async function toSource(context, id, importer, options) {
		if (!packages.size) return null;
		const match = /^(@milkdown\/[^/]+)(\/.+)?$/u.exec(id);
		if (match && packages.has(match[1])) return sourceEntry(packages.get(match[1]), match[2] ?? '');
		if (!inMilkdown(importer) || !/^[\w@]/u.test(id)) return null;
		const shared = await context.resolve(id, projectImporter, { ...options, skipSelf: true });
		return shared ?? null;
	}

	/** Milkdown's components are Vue render functions written as JSX: `h(...)`. */
	async function toJs(code, id) {
		if (!inMilkdown(id) || !id.endsWith('.tsx')) return null;
		const result = await transformWithOxc(code, id, {
			lang: 'tsx',
			jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' },
		});
		return { code: result.code, map: result.map };
	}

	/** The same, for the bundler that bundles the dependencies (Rolldown): the editor bundled from its source. */
	function bundling() {
		return {
			name: 'milkdown-source-bundle',
			resolveId(id, importer, options) {
				return toSource(this, id, importer, options);
			},
			transform: toJs,
		};
	}
}

/** Package name → folder, for every package in Milkdown's workspace. */
function findPackages(dir, found = new Map()) {
	if (!existsSync(dir)) return found;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === 'lib') continue;
		const folder = join(dir, entry.name);
		const manifest = join(folder, 'package.json');
		if (existsSync(manifest)) {
			const { name, exports } = JSON.parse(readFileSync(manifest, 'utf8'));
			if (name?.startsWith('@milkdown/') && exports) found.set(name, { folder, exports });
		} else {
			findPackages(folder, found);
		}
	}
	return found;
}

/** The source file a package's `exports` gives for `subpath` (`''` or `/state`). */
function sourceEntry({ folder, exports }, subpath) {
	const key = `.${subpath}`;
	const pick = (target) => (typeof target === 'string' ? target : target?.import ?? target?.default ?? null);
	if (key in exports) {
		const target = pick(exports[key]);
		return target ? join(folder, target) : null;
	}
	for (const [pattern, target] of Object.entries(exports)) {
		if (!pattern.endsWith('/*') || !key.startsWith(pattern.slice(0, -1))) continue;
		const path = pick(target);
		if (path) return join(folder, path.replace('*', key.slice(pattern.length - 1)));
	}
	return null;
}
