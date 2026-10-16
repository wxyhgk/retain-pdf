import assert from 'node:assert/strict';
import test from 'node:test';

import {
	mergeMarkdownBody,
	parseStudioDocument,
	replaceStudioDocumentBody,
	serializeStudioDocument,
	updateStudioFrontmatter,
} from '../src/studio/document/index.ts';
import { ArticleStore } from '../src/studio/state/article-store.ts';

const losslessCases = [
	{
		name: 'CRLF frontmatter, unknown YAML and mixed Markdown',
		source: [
			'---\r\n',
			'title: "保持: 原样"\r\n',
			'x-unknown: &anchor [1, 2, 3]\r\n',
			'copy: *anchor\r\n',
			'---\r\n',
			'# 标题\r\n',
			'\r\n',
			'<chem-card data-x="1 > 0">\r\n',
			'  raw html\r\n',
			'</chem-card>\r\n',
			'\r\n',
			':::future-directive {odd="syntax"}\r\n',
			'content\r\n',
			':::\r\n',
		].join(''),
	},
	{
		name: 'unknown fences and whitespace',
		source: 'Before\n\n```future-lang key=value\n<not markdown>\n```\n\nAfter\n\n',
	},
	{
		name: 'BOM and YAML document-end marker',
		source: '\uFEFF---\ntitle: test\ncustom:\n  nested: yes\n...\nBody without final newline',
	},
	{
		name: 'whitespace-only document',
		source: '\r\n  \n\t',
	},
];

for (const fixture of losslessCases) {
	test(`round-trips ${fixture.name}`, () => {
		const document = parseStudioDocument(fixture.source);
		assert.equal(serializeStudioDocument(document), fixture.source);
		assert.equal(document.body.blocks.map((block) => block.raw).join(''), document.body.raw);
	});
}

test('splits frontmatter from body without parsing or normalizing YAML', () => {
	const source = '---\r\ntitle: A\r\nunknown: !!custom value\r\n---\r\n# Body\r\n';
	const document = parseStudioDocument(source);

	assert.ok(document.frontmatter);
	assert.equal(document.frontmatter.openingRaw, '---\r\n');
	assert.equal(document.frontmatter.yamlRaw, 'title: A\r\nunknown: !!custom value\r\n');
	assert.equal(document.frontmatter.closingRaw, '---\r\n');
	assert.equal(document.body.raw, '# Body\r\n');
});

test('treats an unclosed opening marker as Markdown, not frontmatter', () => {
	const source = '---\nThis is still Markdown\n\n<div>unknown HTML</div>';
	const document = parseStudioDocument(source);

	assert.equal(document.frontmatter, null);
	assert.equal(document.body.raw, source);
	assert.equal(serializeStudioDocument(document), source);
});

test('records contiguous top-level mdast slices with absolute source ranges', () => {
	const source = '---\ntitle: slices\n---\n\n# Heading\nParagraph without a blank line.\n\n- one\n- two\n';
	const document = parseStudioDocument(source);
	const blocks = document.body.blocks;

	assert.deepEqual(blocks.map((block) => block.kind), ['heading', 'paragraph', 'list']);
	assert.equal(blocks[0]?.start, document.body.start);
	assert.equal(blocks.at(-1)?.end, source.length);
	assert.equal(blocks.map((block) => block.raw).join(''), document.body.raw);
	for (const block of blocks) {
		assert.equal(source.slice(block.start, block.end), block.raw);
	}
});

test('restores original bytes when Crepe only normalizes Markdown formatting', () => {
	const original = [
		'\r\nIntro paragraph.\r\n\r\n',
		'- one\r\n- two\r\n\r\n',
		'~~~cube title=orbital\r\n@file ./assets/orbital.cube\r\n~~~\r\n\r\n',
		'$$\r\nE = mc^2\r\n$$\r\n',
	].join('');
	const normalized = [
		'Intro paragraph.\n\n',
		'* one\n* two\n\n',
		'```cube title=orbital\n@file ./assets/orbital.cube\n```\n\n',
		'$$\nE = mc^2\n$$\n',
	].join('');

	const result = mergeMarkdownBody(original, normalized);
	assert.equal(result.body, original);
	assert.equal(result.changedBlocks, 0);
	assert.equal(result.retainedBlocks, 4);
});

test('accepts edited blocks while retaining untouched scientific blocks', () => {
	const original = [
		'Original introduction.\r\n\r\n',
		'```smiles keep=exact\r\nCCO\r\n```\r\n\r\n',
		'$$\r\n\\ce{2 H2 + O2 -> 2 H2O}\r\n$$\r\n',
	].join('');
	const edited = [
		'Updated introduction.\n\n',
		'```smiles keep=exact\nCCO\n```\n\n',
		'$$\n\\ce{2 H2 + O2 -> 2 H2O}\n$$\n',
	].join('');

	const result = mergeMarkdownBody(original, edited);
	// The edited paragraph, followed by the original's blank line, in its line endings.
	assert.match(result.body, /^Updated introduction\.\r\n\r\n/u);
	assert.match(result.body, /```smiles keep=exact\r\nCCO\r\n```\r\n\r\n/u);
	assert.match(result.body, /\$\$\r\n\\ce\{2 H2 \+ O2 -> 2 H2O\}\r\n\$\$\r\n$/u);
	assert.equal(result.changedBlocks, 1);
	assert.equal(result.retainedBlocks, 2);
});

test('a block added after the last one is a block of its own', () => {
	assert.equal(mergeMarkdownBody('开头。\n\n结尾。\n', '开头。\n\n结尾。\n\n新段落\n').body, '开头。\n\n结尾。\n\n新段落\n');
	assert.equal(mergeMarkdownBody('开头。\n\n结尾。', '开头。\n\n结尾。\n\n![图](./img/a.png)\n').body, '开头。\n\n结尾。\n\n![图](./img/a.png)\n');
	assert.equal(mergeMarkdownBody('开头。\r\n\r\n结尾。\r\n', '开头。\n\n结尾。\n\n新段落\n').body, '开头。\r\n\r\n结尾。\r\n\r\n新段落\n');
	// Neighbours keep what was between them, even when it is a single newline.
	assert.equal(mergeMarkdownBody('# 标题\n正文\n\n旧\n', '# 标题\n\n正文\n\n新\n').body, '# 标题\n正文\n\n新\n');
});

test('tables and bare links the editor writes its own way are kept as written', () => {
	const original = '| 方法 | 能量 |\n| :--- | ---: |\n| HF | −10.40 |\n\n见 https://example.com 。\n\n旧\n';
	const edited = '| 方法 |     能量 |\n| :- | -----: |\n| HF | −10.40 |\n\n见 <https://example.com> 。\n\n新\n';
	const result = mergeMarkdownBody(original, edited);
	assert.equal(result.body, original.replace('旧', '新'));
	assert.equal(result.changedBlocks, 1);
});

test('one tilde is text, as the blog reads it, so a formula written with them is kept', () => {
	// Escaped or not, `H~2~O` means the same; `~~` is still strikethrough.
	assert.equal(mergeMarkdownBody('H~2~O 约 ~300 K\n\n旧\n', 'H\\~2\\~O 约 \\~300 K\n\n新\n').body, 'H~2~O 约 ~300 K\n\n新\n');
	assert.equal(mergeMarkdownBody('~~删掉~~\n', '删掉\n').changedBlocks, 1);
});

test('an edited list keeps its bullet, so it does not run into the list after it', () => {
	const original = '- [ ] 待办\n- [x] 完成\n\n* 另一个列表\n';
	// The editor writes its own bullet, and another one for the list right after.
	const edited = '* [ ] 待办\n* [x] 完成了\n\n- 另一个列表\n';
	assert.equal(mergeMarkdownBody(original, edited).body, '- [ ] 待办\n- [x] 完成了\n\n* 另一个列表\n');
});

test('editing the first or last block keeps the blank lines around the body', () => {
	// Between the frontmatter and the body, and after the last block.
	assert.equal(mergeMarkdownBody('\n第一段\n\n第二段\n\n', '第一段改了\n\n第二段\n').body, '\n第一段改了\n\n第二段\n\n');
	assert.equal(mergeMarkdownBody('\n第一段\n\n第二段\n\n', '第一段\n\n第二段改了\n').body, '\n第一段\n\n第二段改了\n\n');
});

test('an edited block keeps the blank lines after it', () => {
	assert.equal(mergeMarkdownBody('一\n\n\n## 二\n', '一改了\n\n## 二\n').body, '一改了\n\n\n## 二\n');
});

test('kept blocks that would read differently next to a change are written the editor’s way', () => {
	// The paragraph between two lists goes: kept as they were, they would be one list.
	const result = mergeMarkdownBody('* 一\n\n中间\n\n* 二\n\n结尾\n', '* 一\n\n- 二\n\n结尾\n');
	assert.equal(result.body, '* 一\n\n- 二\n\n结尾\n');
	assert.equal(result.retainedBlocks, 1);
});

test('updates article properties without rewriting unknown YAML or comments', () => {
	const source = [
		'---\r\n',
		'# project metadata\r\n',
		'title: old # visible title\r\n',
		'description: old\r\n',
		'custom: &settings\r\n',
		'  basis: def2-SVP\r\n',
		'copy: *settings\r\n',
		'pubDate: 2026-08-09\r\n',
		'tags:\r\n',
		'  - old\r\n',
		'# publication state\r\n',
		'draft: true\r\n',
		'---\r\n',
		'Body remains byte exact.\r\n',
	].join('');

	const updated = updateStudioFrontmatter(source, {
		title: 'New: title',
		description: 'A # literal value',
		pubDate: '2026-08-10',
		tags: ['HF', '量子化学'],
		draft: false,
	});

	assert.match(updated, /# project metadata\r\n/u);
	assert.match(updated, /title: "New: title" # visible title\r\n/u);
	assert.match(updated, /description: "A # literal value"\r\n/u);
	assert.match(updated, /custom: &settings\r\n  basis: def2-SVP\r\ncopy: \*settings\r\n/u);
	assert.match(updated, /tags: \["HF", "量子化学"\]\r\n# publication state\r\n/u);
	assert.match(updated, /draft: false\r\n---\r\nBody remains byte exact\.\r\n$/u);
});

test('replacing the body keeps the frontmatter bytes exactly', () => {
	const source = '\uFEFF---\r\ntitle: original\r\nunknown: !!tag raw\r\n---\r\nOld body\r\n';
	const document = parseStudioDocument(source);
	const result = replaceStudioDocumentBody(document, 'New body\n');

	assert.equal(result, '\uFEFF---\r\ntitle: original\r\nunknown: !!tag raw\r\n---\r\nNew body\n');
});

test('ArticleStore holds the source and its revision state', () => {
	const store = new ArticleStore();
	store.load({
		slug: 'example',
		source: 'Original',
		revision: 'rev-1',
		properties: { title: 'Example', description: '', pubDate: '2026-08-09', tags: [], draft: true },
		chemistryViews: {},
	});
	store.updateSource('Changed');

	assert.equal(store.current.source, 'Changed');
	assert.equal(store.current.revision, 'rev-1');
	assert.equal(store.current.dirty, true);

	store.markSaved('rev-2', 'Changed');
	assert.equal(store.current.article?.source, 'Changed');
	assert.equal(store.current.revision, 'rev-2');
	assert.equal(store.current.dirty, false);
});

test('what is typed while a save is under way stays unsaved', () => {
	const store = new ArticleStore();
	store.load({
		slug: 'example',
		source: 'Original',
		revision: 'rev-1',
		properties: { title: 'Example', description: '', pubDate: '2026-08-09', tags: [], draft: true },
		chemistryViews: {},
	});
	store.updateSource('Changed');
	const saving = store.current.source;
	store.updateSource('Changed further');
	store.markSaved('rev-2', saving);

	assert.equal(store.current.article?.source, 'Changed');
	assert.equal(store.current.source, 'Changed further');
	assert.equal(store.current.revision, 'rev-2');
	assert.equal(store.current.dirty, true);
});

test('a page goes without the properties it may lack: set, they are written; emptied, taken out', () => {
	const base = { title: 'T', description: '', pubDate: '2026-10-17', tags: [], draft: true };
	const source = "---\ntitle: T\ndescription: ''\npubDate: 2026-10-17\ntags: []\ndraft: true\nheroImage: ./img/old.png # 封面\nkind: wiki\nmacros:\n  Ha: \\hat{H}\n---\nBody\n";

	const set = updateStudioFrontmatter(source, { ...base, icon: '🧪', cover: './img/cover.jpg', kind: 'post' });
	assert.match(set, /^icon: "🧪"$/mu);
	assert.match(set, /^heroImage: "\.\/img\/cover\.jpg" # 封面$/mu);
	assert.match(set, /^kind: "post"$/mu, 'a kind written stays written');
	assert.match(set, /macros:\n  Ha: \\hat\{H\}\n/u);
	assert.match(set, /\n---\nBody\n$/u);

	const emptied = updateStudioFrontmatter(set, { ...base, icon: '', cover: '' });
	assert.doesNotMatch(emptied, /icon:|heroImage:/u);
	assert.match(emptied, /^kind: "post"$/mu, 'not given: left as it is');

	const plain = updateStudioFrontmatter('---\ntitle: T\n---\n', { ...base, kind: 'post' });
	assert.doesNotMatch(plain, /kind:/u, 'no kind: post where none was');
});
