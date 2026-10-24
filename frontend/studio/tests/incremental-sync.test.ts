import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { parseMarkdownBodyBlocks, parseStudioDocument } from '../src/studio/document/index.ts';
import { reparseBodyBlocks } from '../src/studio/document/parse.ts';

// A body's blocks cut again only round an edit (what the Studio does at every edit of a long article)
// are the blocks of the whole cut again, whatever the edit: tried on every article, at many places.

const articles = readdirSync(new URL('../blog', import.meta.url), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.flatMap((entry) => {
		try {
			return [parseStudioDocument(readFileSync(new URL(`../blog/${entry.name}/index.md`, import.meta.url), 'utf8')).body.raw];
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

test('the files an article names, read a block at a time, are those read from the whole, as it is edited', async () => {
	const { referencedPaths } = await import('@blog/markdown/articles/article-references.mjs');
	const { referencedFilesReader } = await import('../src/studio/workspace/referenced-files.ts');
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
