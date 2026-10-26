import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { translatable, untranslated } from './scan.mjs';

/** Where the Studio's words are: its page and server, the plugins, the shared packages. */
const ROOTS = ['src/studio', 'src/plugins', 'plugins', 'packages'];
const CODE = /\.(?:ts|tsx|mjs|astro)$/u;
/** Not for the author to read in the Studio: tests and their data, types, the words' own package. */
const SKIPPED = /(?:^|\/)(?:node_modules|test|tests|test-data|fixtures)\/|\.test\.|\.d\.m?ts$|^packages\/i18n\//u;

/** The Studio's source files, relative to `projectRoot`, sorted. */
export async function studioSources(projectRoot) {
	const found = [];
	for (const root of ROOTS) {
		const entries = await readdir(join(projectRoot, root), { recursive: true, withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			if (!entry.isFile() || !CODE.test(entry.name)) continue;
			const path = relative(projectRoot, join(entry.parentPath, entry.name));
			if (!SKIPPED.test(path)) found.push(path);
		}
	}
	return found.sort();
}

/** What a file gives to t(), and the Chinese it leaves outside it. */
export async function readWords(projectRoot, path) {
	const source = await readFile(join(projectRoot, path), 'utf8');
	const jsx = /\.(?:tsx|astro)$/u.test(path);
	return { translatable: translatable(source, { jsx }), untranslated: untranslated(source, { jsx }) };
}
