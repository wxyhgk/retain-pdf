#!/usr/bin/env node
/**
 * npm run i18n:strings              what there is to translate: every t('…') of the Studio, once each
 * npm run i18n:strings -- --left    the Chinese not yet given to t(), by file and line
 * npm run i18n:strings -- --locale en
 *                                   locales/en.json brought up to date: the words new since kept empty (to translate),
 *                                   those gone dropped, the translations there kept
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readWords, studioSources } from './sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '../..');
const args = process.argv.slice(2);

const words = new Set();
const left = [];
for (const path of await studioSources(projectRoot)) {
	const read = await readWords(projectRoot, path);
	for (const word of read.translatable) words.add(word);
	for (const piece of read.untranslated) left.push(`${path}:${piece.line}  ${piece.text}`);
}

const localeAt = args.indexOf('--locale');
if (args.includes('--left')) {
	console.log(left.join('\n'));
	console.error(`${left.length} 处中文还没有交给 t()`);
} else if (localeAt >= 0) {
	const id = args[localeAt + 1];
	if (!id || !/^[\w-]+$/u.test(id)) throw new Error('--locale 后面要写语言，如 en');
	const file = join(here, 'locales', `${id}.json`);
	const before = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
	const after = Object.fromEntries([...words].sort().map((word) => [word, before[word] ?? '']));
	await writeFile(file, `${JSON.stringify(after, null, '\t')}\n`);
	const empty = Object.values(after).filter((text) => !text).length;
	const gone = Object.keys(before).filter((word) => !(word in after)).length;
	console.error(`locales/${id}.json：${words.size} 条，${empty} 条待翻译，去掉 ${gone} 条不再用的`);
} else {
	console.log(JSON.stringify([...words].sort(), null, '\t'));
	console.error(`${words.size} 条要翻译的文字；还有 ${left.length} 处中文没有交给 t()（--left 列出）`);
}
