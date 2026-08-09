import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStudioDocument, replaceStudioDocumentBody } from '../src/studio/document/index.ts';
import { parseVisualMarkdownBody, serializeVisualMarkdownBody } from '../src/studio/editor/prosemirror-markdown.ts';
import { analyzeVisualSafety } from '../src/studio/editor/visual-safety.ts';
import { ArticleStore } from '../src/studio/state/article-store.ts';

test('ProseMirror handles the v0.1 visual block set', () => {
	const body = [
		'# Heading',
		'',
		'Paragraph with **bold** and *emphasis*.',
		'',
		'> quote',
		'',
		'- bullet',
		'- list',
		'',
		'1. ordered',
		'2. list',
		'',
		'```js',
		'const answer = 42;',
		'```',
		'',
		'---',
		'',
	].join('\n');

	const normalized = serializeVisualMarkdownBody(parseVisualMarkdownBody(body));
	assert.match(normalized, /^# Heading/mu);
	assert.match(normalized, /^> quote/mu);
	assert.match(normalized, /^\* bullet/mu);
	assert.match(normalized, /^1\. ordered/mu);
	assert.match(normalized, /```js\nconst answer = 42;\n```/u);
	assert.equal(analyzeVisualSafety(body).safe, true);
});

test('visual safety blocks unsupported HTML and reference definitions', () => {
	const html = analyzeVisualSafety('<widget data-raw="yes">content</widget>\n');
	const definitions = analyzeVisualSafety('[target]: https://example.com\n\n[link][target]\n');

	assert.equal(html.safe, false);
	assert.match(html.reason ?? '', /html/u);
	assert.equal(definitions.safe, false);
	assert.match(definitions.reason ?? '', /definition/u);
});

test('inline and block math use native ProseMirror nodes and retain dollar delimiters', () => {
	const source = [
		'Orbital energy $\\varepsilon_p$ and reaction $\\ce{H2O -> H+ + OH-}$.',
		'',
		'$$',
		'\\hat{f}(i)\\,\\phi_p(i)=\\varepsilon_p\\,\\phi_p(i),',
		'$$',
		'',
	].join('\n');
	const document = parseVisualMarkdownBody(source);
	const mathNodes: Array<{ type: string; latex: string }> = [];
	document.descendants((node) => {
		if (node.type.name.startsWith('math_')) mathNodes.push({ type: node.type.name, latex: String(node.attrs.latex) });
	});

	assert.deepEqual(mathNodes, [
		{ type: 'math_inline', latex: '\\varepsilon_p' },
		{ type: 'math_inline', latex: '\\ce{H2O -> H+ + OH-}' },
		{ type: 'math_block', latex: '\\hat{f}(i)\\,\\phi_p(i)=\\varepsilon_p\\,\\phi_p(i),' },
	]);
	const serialized = serializeVisualMarkdownBody(document);
	assert.match(serialized, /\$\\varepsilon_p\$/u);
	assert.match(serialized, /\$\\ce\{H2O -> H\+ \+ OH-\}\$/u);
	assert.match(serialized, /\$\$\n\\hat\{f\}\(i\).*\n\$\$/u);
	assert.equal(analyzeVisualSafety(source).safe, true);
});

test('invalid LaTeX remains editable source instead of failing Markdown conversion', () => {
	const source = 'Keep $\\notARealCommand{x}$ unchanged.\n';
	const document = parseVisualMarkdownBody(source);
	assert.match(serializeVisualMarkdownBody(document), /\$\\notARealCommand\{x\}\$/u);
	assert.equal(analyzeVisualSafety(source).safe, true);
});

test('visual body replacement retains frontmatter bytes exactly', () => {
	const source = '\uFEFF---\r\ntitle: original\r\nunknown: !!tag raw\r\n---\r\nOld body\r\n';
	const document = parseStudioDocument(source);
	const result = replaceStudioDocumentBody(document, 'New body\n');

	assert.equal(result, '\uFEFF---\r\ntitle: original\r\nunknown: !!tag raw\r\n---\r\nNew body\n');
});

test('ArticleStore is the single source and revision state for both editor modes', () => {
	const store = new ArticleStore();
	store.load({
		slug: 'example',
		source: 'Original',
		revision: 'rev-1',
		files: { img: [], assets: [], ai: [] },
		chemistryViews: {},
	});
	store.updateSource('Changed');

	assert.equal(store.current.source, 'Changed');
	assert.equal(store.current.revision, 'rev-1');
	assert.equal(store.current.dirty, true);

	store.markSaved('rev-2');
	assert.equal(store.current.article?.source, 'Changed');
	assert.equal(store.current.revision, 'rev-2');
	assert.equal(store.current.dirty, false);
});
