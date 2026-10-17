import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { parseBibtex } from '../../references/bibtex.mjs';
import { ArticleLibrary, doiOf, shortKey } from './article-library.mjs';
import { ArticleRepository } from './article-repository.mjs';

const BECKE = '@article{Becke_1993, title={Density-functional thermochemistry. III.}, volume={98}, DOI={10.1063/1.464913}, journal={The Journal of Chemical Physics}, author={Becke, Axel D.}, year={1993}, pages={5648–5652} }';

/** doi.org, as far as these tests ask it. */
function fakeDoiOrg(answers) {
	const asked = [];
	const fetch = async (url, options) => {
		asked.push([url, options.headers.Accept]);
		const answer = answers[url];
		if (!answer) return new Response('not found', { status: 404 });
		return new Response(answer, { status: 200 });
	};
	return { fetch, asked };
}

async function library(t, answers) {
	const root = await mkdtemp(join(tmpdir(), 'studio-library-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const articles = new ArticleRepository(root);
	await articles.create({ slug: 'note', title: 'Note' });
	const doiOrg = fakeDoiOrg(answers);
	return { root, doiOrg, library: new ArticleLibrary(root, articles, doiOrg.fetch), bib: () => readFile(join(root, 'note', 'assets', 'refs.bib'), 'utf8') };
}

test('a DOI, however pasted', () => {
	assert.equal(doiOf('10.1063/1.464913'), '10.1063/1.464913');
	assert.equal(doiOf('https://doi.org/10.1021/acs.jctc.0c00001.'), '10.1021/acs.jctc.0c00001');
	assert.equal(doiOf('doi: 10.1063/1.464913'), '10.1063/1.464913');
	assert.equal(doiOf('becke1993'), null);
	assert.equal(shortKey(parseBibtex(BECKE).get('Becke_1993')), 'becke1993');
	assert.equal(shortKey({ type: 'misc', key: 'x', fields: { author: 'Erd{\\H{o}}s, Paul', year: '1950' } }), 'erdos1950');
});

test('a work is added to refs.bib by its DOI under a short key, once', async (t) => {
	const { library: books, doiOrg, bib } = await library(t, { 'https://doi.org/10.1063/1.464913': BECKE });
	assert.deepEqual(await books.addDoi('note', 'https://doi.org/10.1063/1.464913'), { key: 'becke1993', added: true });
	assert.deepEqual(doiOrg.asked, [['https://doi.org/10.1063/1.464913', 'application/x-bibtex; charset=utf-8']]);
	assert.match(await bib(), /^@article\{becke1993, title=\{Density-functional/u);
	// The same work again: its key, nothing asked or written.
	assert.deepEqual(await books.addDoi('note', '10.1063/1.464913'), { key: 'becke1993', added: false });
	assert.equal(doiOrg.asked.length, 1);
	assert.equal([...parseBibtex(await bib()).keys()].length, 1);
});

test('a key taken gets a letter; what was in the file stays', async (t) => {
	const other = BECKE.replace('Becke_1993', 'x').replace('10.1063/1.464913', '10.1063/1.999');
	const { root, library: books, bib } = await library(t, { 'https://doi.org/10.1063/1.999': other });
	await writeFile(join(root, 'note', 'assets', 'refs.bib'), '% mine\n@book{becke1993, title={Earlier}, year={1993}}\n');
	assert.deepEqual(await books.addDoi('note', '10.1063/1.999'), { key: 'becke1993a', added: true });
	const text = await bib();
	assert.match(text, /^% mine\n@book\{becke1993, title=\{Earlier\}, year=\{1993\}\}\n\n@article\{becke1993a,/u);
});

test('what doi.org does not have, or is not a DOI, is said', async (t) => {
	const { library: books } = await library(t, {});
	await assert.rejects(books.addDoi('note', '10.1000/missing'), { statusCode: 404, message: 'doi.org 上没有 10.1000/missing' });
	await assert.rejects(books.addDoi('note', 'not a doi'), { statusCode: 400 });
});
