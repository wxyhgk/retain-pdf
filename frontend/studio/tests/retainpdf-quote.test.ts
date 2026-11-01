import assert from 'node:assert/strict';
import test from 'node:test';

import { parseQuote, quoteMarkdown, quoteTarget, type Quote } from '../src/studio/editor/retainpdf-quote.ts';

// A passage quoted from RetainPDF (```retainpdf): written into the note, read back as it was.

const quote: Quote = {
	book: 'Smart Machine Learning\nfor the Schrödinger Equation',
	document: 'doc-1',
	job: '20261101112937-ad912a',
	block: 'p001-b0000',
	page: 1,
	source: 'Smart Machine Learning for Solving\nthe Full Electron-Nuclear Problem',
	translated: '基于量子化学启发波函数拟设的智能机器学习',
};

test('a quote is written as a ```retainpdf block and read back the same', () => {
	const markdown = quoteMarkdown(quote);
	assert.equal(
		markdown,
		[
			'```retainpdf',
			'book: Smart Machine Learning for the Schrödinger Equation',
			'document: doc-1',
			'job: 20261101112937-ad912a',
			'block: p001-b0000',
			'page: 1',
			'---',
			'Smart Machine Learning for Solving',
			'the Full Electron-Nuclear Problem',
			'---',
			'基于量子化学启发波函数拟设的智能机器学习',
			'```',
			'',
		].join('\n'),
	);
	const body = markdown.split('\n').slice(1, -2).join('\n');
	assert.deepEqual(parseQuote(body), { ...quote, book: 'Smart Machine Learning for the Schrödinger Equation' });
	assert.deepEqual(quoteTarget(quote), { job_id: quote.job, block_id: quote.block, page_idx: 0 });
});

test('what a quote lacks stays out; text with backticks gets a longer fence', () => {
	const bare = quoteMarkdown({ ...quote, book: null, document: null, page: null, translated: null, source: 'use ```code``` here' });
	assert.ok(bare.startsWith('````retainpdf\njob: '), bare);
	assert.ok(bare.endsWith('\n````\n'), bare);
	assert.ok(!bare.includes('book:') && !bare.includes('page:'), bare);
	const read = parseQuote(bare.split('\n').slice(1, -2).join('\n'))!;
	assert.equal(read.source, 'use ```code``` here');
	assert.equal(read.translated, null);
	assert.deepEqual(quoteTarget(read), { job_id: quote.job, block_id: quote.block });
});

test('a block that says no job or block is not a quote', () => {
	assert.equal(parseQuote('book: x\n---\ntext'), null);
	assert.equal(parseQuote('job: j\n---\ntext'), null);
	assert.deepEqual(parseQuote('job: j\nblock: b\npage: zero'), { book: null, document: null, job: 'j', block: 'b', page: null, source: null, translated: null });
});
