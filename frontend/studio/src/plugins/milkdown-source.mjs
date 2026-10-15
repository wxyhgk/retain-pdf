import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { transformWithOxc } from 'vite';

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
 * @param {{ root?: string }} [options]
 * @returns {import('vite').Plugin}
 */
export default function milkdownSource({ root = process.cwd() } = {}) {
	const milkdown = resolve(root, 'third_party', 'milkdown');
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
			return { resolve: { alias }, server: { watch: { ignored } } };
		},
		configResolved(config) {
			if (!packages.size) config.logger.warn('[milkdown-source] third_party/milkdown 没有拉取，Studio 的编辑器需要它：npm run milkdown:setup');
		},
		async resolveId(id, importer, options) {
			if (!packages.size) return null;
			const match = /^(@milkdown\/[^/]+)(\/.+)?$/u.exec(id);
			if (match && packages.has(match[1])) return sourceEntry(packages.get(match[1]), match[2] ?? '');
			if (!inMilkdown(importer) || !/^[\w@]/u.test(id)) return null;
			const shared = await this.resolve(id, projectImporter, { ...options, skipSelf: true });
			return shared ?? null;
		},
		async transform(code, id) {
			// Milkdown's components are Vue render functions written as JSX: `h(...)`.
			if (!inMilkdown(id) || !id.endsWith('.tsx')) return null;
			const result = await transformWithOxc(code, id, {
				lang: 'tsx',
				jsx: { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' },
			});
			return { code: result.code, map: result.map };
		},
	};
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
