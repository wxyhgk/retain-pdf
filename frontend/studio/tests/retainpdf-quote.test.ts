import assert from 'node:assert/strict';
import test from 'node:test';

import { parseQuote, parseSourceHref, quoteMarkdown, quoteTarget, sourceHref, sourceLabel, type Quote } from '../src/studio/editor/retainpdf-quote.ts';

// A passage quoted from RetainPDF: its translation as the note's own text, after a link to where it is
// (`retainpdf:<job>/<block>?page&document`); a block quoted before (```retainpdf) still read.

const quote: Quote = {
	book: 'Smart Machine Learning\nfor the Schrödinger [Equation]',
	document: 'doc-1',
	job: '20261101112937-ad912a',
	block: 'p001-b0000',
	page: 1,
	source: 'Smart Machine Learning for Solving\nthe Full Electron-Nuclear Problem',
	translated: '基于量子化学启发波函数拟设的智能机器学习',
};

test('a quote is its translation after a link to where it is, the book and page its words', () => {
	assert.equal(
		quoteMarkdown(quote),
		'[Smart Machine Learning for the Schrödinger \\[Equation\\] · 第 1 页](retainpdf:20261101112937-ad912a/p001-b0000?page=1&document=doc-1) 基于量子化学启发波函数拟设的智能机器学习\n',
	);
	assert.deepEqual(parseSourceHref(sourceHref(quote)), { job: quote.job, block: quote.block, page: 1, document: 'doc-1' });
	assert.deepEqual(quoteTarget(quote), { job_id: quote.job, block_id: quote.block, page_idx: 0 });
});

test('no translation: the original; text that starts a block of its own: the link on a line before it', () => {
	assert.equal(quoteMarkdown({ ...quote, book: null, document: null, page: null, translated: null }), '[RetainPDF](retainpdf:20261101112937-ad912a/p001-b0000) Smart Machine Learning for Solving\nthe Full Electron-Nuclear Problem\n');
	assert.equal(quoteMarkdown({ ...quote, translated: '$$E = mc^2$$\n\n能量。' }).split('\n').slice(1).join('\n'), '\n$$E = mc^2$$\n\n能量。\n');
	assert.equal(quoteMarkdown({ ...quote, translated: '', source: null }), `[${sourceLabel(quote.book, 1).replace(/[[\]]/gu, '\\$&')}](${sourceHref(quote)})\n`);
});

test('a retainpdf: address read back; others, and ones without a job and block, are not', () => {
	assert.deepEqual(parseSourceHref('retainpdf:j%2F1/p002-b0003'), { job: 'j/1', block: 'p002-b0003', page: null, document: null });
	assert.deepEqual(parseSourceHref('retainpdf:j/b?page=zero'), { job: 'j', block: 'b', page: null, document: null });
	assert.equal(parseSourceHref('retainpdf:j'), null);
	assert.equal(parseSourceHref('https://example.com/j/b'), null);
});

test('a block quoted before (```retainpdf) is read; one that says no job or block is not a quote', () => {
	assert.deepEqual(parseQuote('book: x\njob: j\nblock: b\npage: 3\n---\nThe original\n---\n译文'), { book: 'x', document: null, job: 'j', block: 'b', page: 3, source: 'The original', translated: '译文' });
	assert.equal(parseQuote('book: x\n---\ntext'), null);
	assert.equal(parseQuote('job: j\n---\ntext'), null);
	assert.deepEqual(parseQuote('job: j\nblock: b\npage: zero'), { book: null, document: null, job: 'j', block: 'b', page: null, source: null, translated: null });
});
