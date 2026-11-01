import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { ArticleRepository } from './articles/article-repository.mjs';
import { RetainpdfNotes } from './retainpdf-notes.mjs';

async function fixture(t) {
	const blogRoot = await mkdtemp(join(tmpdir(), 'studio-retainpdf-notes-'));
	t.after(() => rm(blogRoot, { recursive: true, force: true }));
	const articles = new ArticleRepository(blogRoot);
	return { articles, notes: new RetainpdfNotes(articles) };
}

test('a book gets one page of notes under 读书笔记, found again by the book however it is named', async (t) => {
	const { articles, notes } = await fixture(t);
	const first = await notes.bookNote({ job_id: 'job-1', document_id: 'doc-1', title: '  Quantum\nChemistry ' });
	assert.equal(first.created, true);
	assert.equal(first.title, 'Quantum Chemistry');
	let all = await articles.list();
	const books = all.find((page) => page.retainpdf?.books);
	assert.equal(books.title, '读书笔记');
	const page = all.find((entry) => entry.slug === first.slug);
	assert.equal(page.parent, books.slug);
	assert.deepEqual(page.retainpdf, { document: 'doc-1', job: 'job-1' });
	assert.match((await articles.read(first.slug)).source, /\nretainpdf: \{ "document": "doc-1", "job": "job-1" \}\n/u);

	// The same book read in another job, its page renamed by the author: the same page.
	const { source, revision } = await articles.read(first.slug);
	await articles.save(first.slug, { source: source.replace(/^title: .*$/mu, 'title: 量子化学笔记'), expectedRevision: revision });
	assert.deepEqual(await notes.bookNote({ job_id: 'job-2', document_id: 'doc-1', title: 'Quantum Chemistry' }), { slug: first.slug, title: '量子化学笔记', created: false });

	// Another book: beside it, under the same 读书笔记.
	const second = await notes.bookNote({ job_id: 'job-3', document_id: 'doc-2', title: 'Molecular Physics' });
	all = await articles.list();
	assert.equal(all.filter((entry) => entry.retainpdf?.books).length, 1);
	assert.equal(all.find((entry) => entry.slug === second.slug).parent, books.slug);
});

test('a job of no book is found by the job; the book known later is kept on its page', async (t) => {
	const { articles, notes } = await fixture(t);
	const made = await notes.bookNote({ job_id: 'job-9', document_id: null, title: null });
	assert.equal(made.title, '无标题的书');
	assert.equal((await notes.bookNote({ job_id: 'job-9' })).slug, made.slug);
	assert.equal((await notes.bookNote({ job_id: 'job-9', document_id: 'doc-9' })).slug, made.slug);
	assert.deepEqual((await articles.list()).find((page) => page.slug === made.slug).retainpdf, { document: 'doc-9', job: 'job-9' });
});

test('asked twice at once, one page; asked without a job, refused', async (t) => {
	const { articles, notes } = await fixture(t);
	const [one, two] = await Promise.all([notes.bookNote({ job_id: 'j', document_id: 'd', title: 'Book' }), notes.bookNote({ job_id: 'j', document_id: 'd', title: 'Book' })]);
	assert.equal(one.slug, two.slug);
	assert.equal((await articles.list()).length, 2);
	await assert.rejects(notes.bookNote({ document_id: 'd' }), (error) => error.statusCode === 400);
});
