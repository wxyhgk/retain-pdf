import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { NotesIndex, readNote } from './notes-index.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const OTHER_PNG = Buffer.concat([PNG, Buffer.from([0])]);

async function blog(t) {
	const root = await mkdtemp(join(tmpdir(), 'notes-index-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const write = async (path, data) => {
		await mkdir(join(root, path, '..'), { recursive: true });
		await writeFile(join(root, path), data);
	};
	await write(
		'note-a/index.md',
		[
			'---',
			'title: 优化算法',
			'pubDate: 2026-10-28',
			'---',
			'',
			'## 复现',
			'',
			'```python title="RFO 一步"',
			'import numpy as np',
			'print(np.pi)',
			'```',
			'',
			'```xyz',
			'1',
			'',
			'H 0 0 0',
			'```',
			'',
			'```output title="运行结果"',
			'3.14',
			'```',
			'',
			'```xyz',
			'@file ./assets/h.xyz',
			'```',
			'',
			'![能量曲线](./img/curve.png)',
			'',
			'<img src="./img/inline.png" alt="嵌入的">',
			'',
			'![网上的](https://example.com/pic/web.png)',
		].join('\n'),
	);
	await write('note-a/img/curve.png', PNG);
	await write('note-a/img/inline.png', OTHER_PNG);
	await write('note-a/ai/work/opt.py', 'def step():\n    return 1\n');
	// The same plot, kept by the AI as well as shown: one picture, two places.
	await write('note-a/ai/work/curve.png', PNG);
	await write('note-a/ai/history/old.py', 'print("old version")\n');
	await write('note-a/ai/work/run.log', 'not code\n');
	await write('note-b/index.md', '---\ntitle: 另一篇\npubDate: 2026-10-01\n---\n\n# 记一下\n\n```python\nimport numpy as np\nprint(np.pi)\n```\n');
	return root;
}

test('a note read: its fences with their lines and headings, plugin blocks and run results marked, @file lines left out; its pictures', () => {
	const note = readNote('---\ntitle: x\n---\n\n## 一\n\n```py\na = 1\n```\n\n```smiles\nCCO\n```\n\n![图](./a.png)\n', new Set(['smiles']));
	assert.deepEqual(
		note.code.map(({ kind, language, line, heading }) => ({ kind, language, line, heading })),
		[
			{ kind: 'block', language: 'py', line: 7, heading: '一' },
			{ kind: 'plugin', language: 'smiles', line: 11, heading: '一' },
		],
	);
	assert.deepEqual(note.pictures, [{ url: './a.png', alt: '图', line: 15, heading: '一' }]);
	assert.ok(note.referenced.has('a.png'));
});

test('all the code of the notes: fences and the scripts in their folders, the same code once with each place, history left out', async (t) => {
	const index = new NotesIndex(await blog(t), { fences: () => ['xyz'] });
	const items = await index.code();
	const python = items.find((item) => item.kind === 'block' && item.language === 'python');
	assert.equal(python.title, 'RFO 一步');
	assert.deepEqual(
		python.places.map(({ slug, title, heading, line }) => ({ slug, title, heading, line })).sort((a, b) => a.slug.localeCompare(b.slug)),
		[
			{ slug: 'note-a', title: '优化算法', heading: '复现', line: 8 },
			{ slug: 'note-b', title: '另一篇', heading: '记一下', line: 8 },
		],
	);
	const script = items.find((item) => item.kind === 'file');
	assert.deepEqual({ language: script.language, title: script.title, path: script.places[0].path, lines: script.lines }, { language: 'python', title: 'opt.py', path: 'ai/work/opt.py', lines: 3 });
	assert.ok(items.some((item) => item.kind === 'plugin' && item.language === 'xyz'));
	assert.ok(items.some((item) => item.kind === 'output'));
	assert.ok(!items.some((item) => item.text.includes('old version')), 'the article’s history is not its code');
	assert.ok(!items.some((item) => item.text.includes('@file')));
});

test('all the pictures: shown or only kept, the same picture once with each place, those on the web too', async (t) => {
	const root = await blog(t);
	const index = new NotesIndex(root);
	const items = await index.images();
	const curve = items.find((item) => item.name === 'curve.png');
	assert.equal(curve.referenced, true);
	assert.equal(curve.alt, '能量曲线');
	assert.equal(curve.url, '/api/studio/notes/pictures/note-a/img/curve.png');
	assert.deepEqual(
		curve.places.map(({ path, referenced, line }) => ({ path, referenced, line })).sort((a, b) => a.path.localeCompare(b.path)),
		[
			{ path: 'ai/work/curve.png', referenced: false, line: null },
			{ path: 'img/curve.png', referenced: true, line: 27 },
		],
	);
	const inline = items.find((item) => item.name === 'inline.png');
	assert.deepEqual({ referenced: inline.referenced, alt: inline.alt }, { referenced: true, alt: '嵌入的' });
	const web = items.find((item) => item.remote);
	assert.deepEqual({ url: web.url, name: web.name, alt: web.alt }, { url: 'https://example.com/pic/web.png', name: 'web.png', alt: '网上的' });

	// A picture changed is read again: now the same as the inline one, it is one with that.
	await writeFile(join(root, 'note-a/ai/work/curve.png'), OTHER_PNG);
	const later = new Date(Date.now() + 5000);
	await utimes(join(root, 'note-a/ai/work/curve.png'), later, later);
	const again = await index.images();
	assert.deepEqual(again.find((item) => item.places.some((place) => place.path === 'img/curve.png')).places.length, 1);
	assert.deepEqual(again.find((item) => item.places.some((place) => place.path === 'img/inline.png')).places.map((place) => place.path).sort(), ['ai/work/curve.png', 'img/inline.png']);
});

test('a picture of a note is sent from anywhere in its folder; nothing else is, not through a link or out of it', async (t) => {
	const root = await blog(t);
	const index = new NotesIndex(root);
	const sent = await index.picture('note-a', 'ai/work/curve.png');
	assert.equal(sent.contentType, 'image/png');
	assert.equal(sent.size, PNG.length);
	sent.body.destroy();
	const { symlink } = await import('node:fs/promises');
	await symlink(join(root, 'note-a/img/curve.png'), join(root, 'note-a/img/linked.png'));
	for (const [slug, path] of [['note-a', '../note-b/index.md'], ['note-a', 'ai/work/opt.py'], ['note-a', 'img/linked.png'], ['note-a', 'img/missing.png'], ['../x', 'a.png'], ['note-a', 'ai/history/old.png']]) {
		await assert.rejects(index.picture(slug, path), { statusCode: 404 }, `${slug}/${path}`);
	}
});
