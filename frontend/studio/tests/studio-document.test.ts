import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStudioDocument, serializeStudioDocument } from '../src/studio/document/index.ts';

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
