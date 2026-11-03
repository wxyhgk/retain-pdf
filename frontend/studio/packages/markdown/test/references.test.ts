import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { markdownPlugins } from '../pipeline.mjs';
import { authorList, numberRanges, parseBibtex, parseCitation, plainTex, referencePieces } from '../references/bibtex.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins();
const BIB = String.raw`
% Exported by Zotero
@comment{jabref-meta: databaseType:bibtex;}
@article{becke1993,
  author = {Becke, Axel D.},
  title = {Density-functional thermochemistry. {III}. The role of exact exchange},
  journal = {The Journal of Chemical Physics},
  year = 1993,
  volume = {98},
  number = {7},
  pages = {5648--5652},
  doi = {10.1063/1.464913}
}
@article{grimme2010,
  author = "Grimme, Stefan and Antony, Jens and Ehrlich, Stephan and Krieg, Helge",
  title = "A consistent and accurate \textit{ab initio} parametrization of density functional dispersion correction ({DFT-D}) for the 94 elements {H-Pu}",
  journal = {J. Chem. Phys.},
  year = {2010}, volume = {132}, pages = {154104},
  doi = {https://doi.org/10.1063/1.3382344}
}
@book{szabo1996,
  author = {Szabo, Attila and Ostlund, Neil S.},
  title = {Modern Quantum Chemistry},
  publisher = {Dover},
  address = {Mineola, NY},
  year = {1996}
}
@misc{orca, author = {Neese, Frank and others}, title = {{ORCA} 6.0}, howpublished = "Max-Planck-Institut f{\"u}r Kohlenforschung", year = 2024}
`;

test('BibTeX entries are read: braces, quotes, bare numbers, comments skipped', () => {
	const entries = parseBibtex(BIB);
	assert.deepEqual([...entries.keys()], ['becke1993', 'grimme2010', 'szabo1996', 'orca']);
	assert.equal(entries.get('becke1993')?.fields.title, 'Density-functional thermochemistry. {III}. The role of exact exchange');
	assert.equal(entries.get('becke1993')?.fields.year, '1993');
	assert.equal(entries.get('grimme2010')?.fields.author, 'Grimme, Stefan and Antony, Jens and Ehrlich, Stephan and Krieg, Helge');
	assert.equal(parseBibtex('@article{x, title = "a" # {b}}').get('x')?.fields.title, 'ab');
});

test('TeX as text, authors as ACS lists them', () => {
	assert.equal(plainTex(String.raw`Max-Planck-Institut f{\"u}r {ORCA} \textit{ab initio} 5648--5652`), 'Max-Planck-Institut für ORCA ab initio 5648–5652');
	assert.equal(plainTex(String.raw`Erd{\H{o}}s \'{E}cole \c{c}a \o{}`), 'Erdős École ça ø');
	assert.equal(authorList('Becke, Axel D.'), 'Becke, A. D.');
	assert.equal(authorList('Jean-Paul Sartre and Neese, Frank and others'), 'Sartre, J.-P.; Neese, F.; et al.');
	assert.equal(authorList(Array.from({ length: 12 }, (_, at) => `Author${at}, A.`).join(' and ')).split('; ').length, 11);
});

test('an entry as the list shows it', () => {
	const entries = parseBibtex(BIB);
	assert.deepEqual(referencePieces(entries.get('becke1993')!), [
		'Becke, A. D. ',
		'Density-functional thermochemistry. III. The role of exact exchange. ',
		{ em: 'The Journal of Chemical Physics' },
		' ',
		{ strong: '1993' },
		', ',
		{ em: '98' },
		', 5648–5652',
		'.',
		' ',
		{ link: 'https://doi.org/10.1063/1.464913' },
	]);
	assert.deepEqual(referencePieces(entries.get('grimme2010')!).at(-1), { link: 'https://doi.org/10.1063/1.3382344' });
	assert.deepEqual(referencePieces(entries.get('szabo1996')!), ['Szabo, A.; Ostlund, N. S. ', { em: 'Modern Quantum Chemistry' }, '; ', 'Dover: Mineola, NY, 1996.']);
	assert.deepEqual(referencePieces(entries.get('orca')!), ['Neese, F.; et al. ', 'ORCA 6.0. ', 'Max-Planck-Institut für Kohlenforschung, 2024.']);
});

test('citations and their numbers', () => {
	assert.deepEqual(parseCitation('@a; @b, p. 12'), [{ key: 'a', locator: '' }, { key: 'b', locator: 'p. 12' }]);
	assert.equal(parseCitation('see @a'), null);
	assert.equal(numberRanges([3, 1, 2, 5]), '1–3,5');
	assert.equal(numberRanges([2, 1]), '1,2');
});

/** An article in a folder with these files, rendered as the blog renders it. */
async function render(t: { after: (fn: () => void) => void }, markdown: string, files: Record<string, string>) {
	const folder = mkdtempSync(join(tmpdir(), 'cite-article-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(join(folder, path, '..'), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	// The pipeline's plugin lists are typed for Astro's options, which unified does not know.
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path: join(folder, 'index.md') }));
	return { html: String(file), messages: file.messages.map((message) => [message.ruleId, message.reason]) };
}

test('citations are numbered as they come and listed at the end', async (t) => {
	const { html, messages } = await render(
		t,
		'B3LYP [@becke1993] 加色散 [@grimme2010; @becke1993, p. 5649]。`[@becke1993]` 是代码。\n\n$[@x]$\n',
		{ 'assets/refs.bib': BIB },
	);
	assert.deepEqual(messages, []);
	assert.match(html, /B3LYP <sup class="citation"><a href="#ref-1" title="becke1993">\[1\]<\/a><\/sup> 加色散 <sup class="citation"><a href="#ref-1" title="grimme2010; becke1993, p. 5649">\[1,2\]<\/a><\/sup>/u);
	assert.match(html, /<code>\[@becke1993\]<\/code>/u);
	assert.match(html, /<h2>参考文献<\/h2>\n?<ol class="references"><li id="ref-1">Becke, A\. D\. Density-functional/u);
	assert.match(html, /<li id="ref-2">Grimme, S\.; Antony, J\.; Ehrlich, S\.; Krieg, H\. /u);
	assert.match(html, /<a href="https:\/\/doi\.org\/10\.1063\/1\.464913">/u);
});

test('a key the library has not, or citations without one, are reported', async (t) => {
	const missing = await render(t, '见 [@nowhere] 和 [@becke1993]。\n', { 'assets/refs.bib': BIB });
	assert.deepEqual(missing.messages, [['citation', '找不到文献 @nowhere：assets/refs.bib 里没有这个 key']]);
	assert.match(missing.html, /<sup class="citation"><span class="citation-missing" title="@nowhere">\[\?\]<\/span><\/sup>/u);
	const none = await render(t, '见 [@becke1993]。\n', {});
	assert.deepEqual(none.messages, [['citation', '页面引用了文献，但没有 assets/refs.bib']]);
	assert.doesNotMatch(none.html, /参考文献/u);
	// No citations, nothing added.
	assert.doesNotMatch((await render(t, '没有引用 [这个] 和 [@ 不是]。\n', {})).html, /citation|参考文献/u);
});
