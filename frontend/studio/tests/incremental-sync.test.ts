import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { parseMarkdownBodyBlocks, parseStudioDocument } from '@blog/document/index.ts';
import { bodyParts, reparseBodyBlocks } from '@blog/document/parse.ts';

// A body's blocks cut again only round an edit (what the Studio does at every edit of a long article)
// are the blocks of the whole cut again, whatever the edit: tried on every article of tests/fixtures/articles (the
// demo articles: formulas, molecules, widgets, code files, tables), at many places.

const articles = readdirSync(new URL('./fixtures/articles', import.meta.url), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.flatMap((entry) => {
		try {
			return [parseStudioDocument(readFileSync(new URL(`./fixtures/articles/${entry.name}/index.md`, import.meta.url), 'utf8')).body.raw];
		} catch {
			return [];
		}
	});

/** Small edits that change how far a block reaches, and plain typing. */
const INSERTS = ['x', '\n', '\n\n', '```', '\n```\n', '$$', '\n$$\n', '- ', '# ', '> ', '|', '\n---\n', '<div>', '\n===\n', '    ', '[^1]: ', '1. '];

/** A small random number generator, the same each run. */
function random(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};
}

test('cutting again round an edit gives the blocks of cutting the whole again', () => {
	const next = random(7);
	let tried = 0;
	for (const body of articles) {
		if (!body.trim()) continue;
		const before = { body, blocks: parseMarkdownBodyBlocks(body) };
		for (let round = 0; round < 300; round += 1) {
			const at = Math.floor(next() * body.length);
			const removed = next() < 0.3 ? Math.floor(next() * 40) : 0;
			const insert = INSERTS[Math.floor(next() * INSERTS.length)]!;
			const edited = body.slice(0, at) + insert + body.slice(at + removed);
			assert.deepEqual(reparseBodyBlocks(before, edited), parseMarkdownBodyBlocks(edited), `${JSON.stringify(insert)} at ${at} in ${JSON.stringify(body.slice(0, 40))}`);
			tried += 1;
		}
	}
	assert.ok(tried >= 1000);
});

test('edit after edit, each cut from the last, still gives the whole cut again', () => {
	const next = random(11);
	for (const body of articles) {
		let before = { body, blocks: parseMarkdownBodyBlocks(body) };
		for (let round = 0; round < 60; round += 1) {
			const at = Math.floor(next() * before.body.length);
			const removed = next() < 0.4 ? Math.floor(next() * 20) : 0;
			const edited = before.body.slice(0, at) + INSERTS[Math.floor(next() * INSERTS.length)]! + before.body.slice(at + removed);
			const blocks = reparseBodyBlocks(before, edited);
			assert.deepEqual(blocks, parseMarkdownBodyBlocks(edited));
			before = { body: edited, blocks };
		}
	}
});

/** What the editor makes one block of though it is cut as several, lists and fences round the edges of parts, a setext heading, a table. */
const TRICKY = [
	'<details>\n<summary>开</summary>\n\n里面\n\n- 甲\n\n</details>',
	'<div class="columns">\n<div>\n\n左\n\n</div>\n<div>\n\n右\n\n</div>\n</div>',
	'- 一\n\n  续\n\n- 二\n  - 里\n',
	'标题\n===',
	'```js\na\n\nb\n```',
	'$$\nx\n\ny\n$$',
	'| a | b |\n|---|---|\n| 1 | 2 |',
	'    缩进的代码\n\n    还是',
	'> 引用\n续上\n\n> 又一段',
	'<div>\n未闭合',
].join('\n\n');

test('a body cut a part at a time gives the blocks of cutting it whole, and each part reads the same by itself', () => {
	const bodies = [...articles, TRICKY.repeat(20), `${TRICKY}\n\n[a]: https://x.y\n`];
	for (const body of bodies) {
		if (!body.trim()) continue;
		const whole = parseMarkdownBodyBlocks(body);
		for (const length of [1, 40, 700, 9000]) {
			const parts = [...bodyParts(body, length, length * 2)];
			assert.deepEqual(parts.flat(), whole, `parts of ${length} in ${JSON.stringify(body.slice(0, 40))}`);
			for (const part of parts) {
				const start = part[0]!.start;
				const alone = parseMarkdownBodyBlocks(body.slice(start, part.at(-1)!.end)).map((block) => ({ ...block, start: block.start + start, end: block.end + start }));
				assert.deepEqual(alone, part);
			}
		}
	}
	// With a definition, one part: the link before it is defined by it.
	assert.equal([...bodyParts(`${TRICKY}\n\n[a]: https://x.y\n`, 10, 10)].length, 1);
});

test('the files an article names, read a block at a time, are those read from the whole, as it is edited', async () => {
	const { referencedPaths } = await import('@blog/markdown/articles/article-references.mjs');
	const { referencedFilesReader } = await import('../src/studio/files/referenced-files.ts');
	const next = random(13);
	const names = ['\n\n![图](img/a.png)\n\n', '[x](assets/b.pdf)', '\n\n[r]: ./c.txt\n\n', '<img src="img/d.png">', '\n\n```xyz\n@file ./assets/e.xyz\n```\n\n', '```', 'x'];
	for (const body of articles) {
		const read = referencedFilesReader();
		let source = `---\ntitle: t\nheroImage: ./img/hero.png\n---\n${body}`;
		for (let round = 0; round < 30; round += 1) {
			assert.deepEqual([...read(source)].sort(), [...referencedPaths(source)].sort());
			const at = 30 + Math.floor(next() * (source.length - 30));
			source = source.slice(0, at) + names[Math.floor(next() * names.length)]! + source.slice(at + (next() < 0.3 ? 15 : 0));
		}
	}
});
