import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { excerptLines, highlightLines, parseFenceMeta } from '../code-files/highlight.mjs';
import { codeFileLanguage, codeFileLanguageForPath } from '../code-files/languages.mjs';
import { codeFileFigure } from '../code-files/render.mjs';
import remarkCodeFiles from '../plugins/remark-code-files.mjs';

/** A line's tokens as `[name:text]`, plain text bare. */
const show = (language: string, source: string) =>
	highlightLines(language, source).map((line) => (line ?? []).map(([text, name]) => (name ? `[${name}:${text}]` : text)).join(''));

test('Gaussian input: Link 0 and route, title, charge and atoms, then extra sections', () => {
	const lines = show('gaussian', '%mem=16GB\n#p B3LYP/6-31G(d) opt ! fast\n\nwater\n\n0 1\n O  0.0 0.0 0.1\n\nB 1 2 F\n');
	assert.equal(lines[0], '[meta:%mem][punctuation:=][keyword:16GB]');
	assert.equal(lines[1], '[meta:#p] [keyword:B3LYP][punctuation:/][keyword:6-31G][punctuation:(][keyword:d][punctuation:)] [keyword:opt] [comment:! fast]');
	assert.equal(lines[3], '[string:water]');
	assert.equal(lines[5], '[number:0] [number:1]');
	assert.equal(lines[6], ' [typeName:O]  [number:0.0] [number:0.0] [number:0.1]');
	assert.equal(lines[8], '[propertyName:B] [number:1] [number:2] [atom:F]');
	// A line of spaces ends a section as an empty one does.
	assert.equal(show('gaussian', '# hf\n   \ntitle')[2], '[string:title]');
});

test('ORCA, INCAR, POSCAR, KPOINTS and CP2K each read their own way', () => {
	assert.deepEqual(show('orca', '! B3LYP def2-SVP\n%maxcore 4000\n%scf\n  MaxIter 200\nend\n* xyz 0 1\nH 0 0 0\n*\n# done'), [
		'[meta:!] [keyword:B3LYP] [keyword:def2-SVP]',
		'[meta:%maxcore] [number:4000]',
		'[typeName:%scf]',
		'  [propertyName:MaxIter] [number:200]',
		'[typeName:end]',
		'[meta:* xyz] [number:0] [number:1]',
		'[typeName:H] [number:0] [number:0] [number:0]',
		'[meta:*]',
		'[comment:# done]',
	]);
	assert.equal(show('incar', 'ENCUT = 520; LWAVE = .FALSE. # no')[0], '[propertyName:ENCUT] [operator:=] [number:520][punctuation:;] [propertyName:LWAVE] [operator:=] [atom:.FALSE.] [comment:# no]');
	assert.deepEqual(show('poscar', 'Si\n1.0\n5 0 0\n0 5 0\n0 0 5\nSi\n2\nDirect\n0 0 0 T F T'), [
		'[comment:Si]', '[number:1.0]', '[number:5] [number:0] [number:0]', '[number:0] [number:5] [number:0]', '[number:0] [number:0] [number:5]',
		'[typeName:Si]', '[number:2]', '[keyword:Direct]', '[number:0] [number:0] [number:0] [atom:T] [atom:F] [atom:T]',
	]);
	// Without species (VASP 4), line 6 holds the counts.
	assert.equal(show('poscar', 'x\n1\n1 0 0\n0 1 0\n0 0 1\n2\nCartesian')[6], '[keyword:Cartesian]');
	assert.equal(show('kpoints', 'mesh\n0\nGamma\n4 4 4')[2], '[keyword:Gamma]');
	assert.deepEqual(show('cp2k', '&DFT\n  CUTOFF [Ry] 400\n  FILE ${DATA}/B\n&END DFT\n@INCLUDE a.inc'), [
		'[typeName:&DFT]',
		'  [propertyName:CUTOFF] [unit:[Ry]] [number:400]',
		'  [propertyName:FILE] [variableName:${DATA}][punctuation:/][string:B]',
		'[typeName:&END DFT]',
		'[meta:@INCLUDE] [string:a.inc]',
	]);
});

test('output: errors, warnings and normal endings stand out, and so do energies', () => {
	assert.deepEqual(show('out', ' SCF Done:  E(RB3LYP) =  -76.40895  after 10 cycles\n Warning! x\n Error termination\n Normal termination of Gaussian 16\n ----------'), [
		' SCF Done:  E(RB3LYP) =  [number strong:-76.40895]  after [number:10] cycles',
		' [changed:Warning! x]',
		' [invalid:Error termination]',
		' [inserted:Normal termination of Gaussian 16]',
		' [comment:----------]',
	]);
});

test('languages are found by fence name, alias, or file name', () => {
	assert.equal(codeFileLanguage('G16')?.name, 'gaussian');
	assert.equal(codeFileLanguage('python'), undefined);
	assert.equal(codeFileLanguageForPath('assets/run/OUTCAR'), 'output');
	assert.equal(codeFileLanguageForPath('assets/opt.log'), 'output');
	assert.equal(codeFileLanguageForPath('assets/INCAR'), 'incar');
	assert.equal(codeFileLanguageForPath('assets/a.inp'), undefined);
});

test('fence meta: title, a range of lines, open and fold', () => {
	assert.deepEqual(parseFenceMeta('title="opt 1.log" lines=10-20 open'), {
		title: 'opt 1.log',
		lines: { start: 10, end: 20 },
		open: true,
		fold: false,
		match: null,
		context: 0,
		from: null,
		to: null,
		last: false,
		highlight: [],
		mark: null,
	});
	assert.deepEqual(parseFenceMeta("title='a' lines=5- fold").lines, { start: 5, end: Infinity });
	assert.equal(parseFenceMeta('lines=20-10').lines, null);
	const long = Array.from({ length: 1000 }, (_, index) => `line ${index + 1}`).join('\n');
	const { parts, total } = excerptLines(long, null);
	assert.equal(total, 1000);
	assert.deepEqual(parts.map((part) => [part.start, part.lines.length]), [[1, 200], [901, 100]]);
	assert.deepEqual(excerptLines(long, { start: 998, end: Infinity }).parts[0].lines, ['line 998', 'line 999', 'line 1000']);
});

test('on the blog: highlighted figures, @file read from the article, long blocks fold', async () => {
	const article = join(mkdtempSync(join(tmpdir(), 'code-files-')), 'water');
	mkdirSync(join(article, 'assets'), { recursive: true });
	const log = Array.from({ length: 500 }, (_, index) => (index === 499 ? ' Normal termination of Gaussian 16' : ` step ${index + 1}`)).join('\n');
	writeFileSync(join(article, 'assets', 'opt.log'), `${log}\n`);
	const markdown = [
		'```orca title="opt.inp"\n! B3LYP\n```',
		'```output\n@file ./assets/opt.log\n```',
		'```output lines=499-500\n@file ./assets/opt.log\n```',
		'```output\n@file ./assets/missing.log\n```',
		'```python\nprint(1)\n```',
		`\`\`\`python\n${'x = 1\n'.repeat(40)}\`\`\``,
		'```xyz\n@file ./assets/a.xyz\n```',
	].join('\n\n');
	const processor = unified()
		.use(remarkParse)
		.use(remarkCodeFiles, { skip: ['xyz'] })
		.use(remarkRehype)
		.use(rehypeStringify);
	const file = new VFile({ value: markdown, path: join(article, 'index.md') });
	const html = String(await processor.process(file));
	const figures = html.split('<figure').slice(1);
	assert.equal(figures.length, 5);

	assert.match(figures[0], /class="code-file" data-language="orca"/);
	assert.match(figures[0], /<span class="code-file-name">opt\.inp<\/span><span class="code-file-kind">ORCA 输入<\/span>/);
	assert.match(figures[0], /data-code-action="download" data-file-name="opt\.inp"/);
	assert.match(figures[0], /<span style="color:#ffab70">!<\/span>/);

	// The file: its head and tail, numbered as in the file, and a link to it.
	assert.match(figures[1], /has-line-numbers/);
	assert.match(figures[1], /<span class="code-file-size">500 行<\/span>/);
	assert.match(figures[1], /href="\/article-assets\/water\/assets\/opt\.log" download="opt\.log"/);
	assert.match(figures[1], /⋯ 省略第 201–400 行，下载可看完整文件 ⋯/);
	assert.match(figures[1], /data-line="500"> <span style="color:#85e89d;font-weight:600">Normal termination of Gaussian 16/);
	assert.match(figures[1], /data-fold="15"/);
	assert.equal(figures[2].match(/data-line="/g)?.length, 2);
	assert.doesNotMatch(figures[2], /data-fold/);
	assert.match(figures[3], /is-problem/);
	assert.match(figures[3], /找不到文件 \.\/assets\/missing\.log/);
	assert.equal(file.messages.length, 1);

	// Other languages are left to Shiki; a long one is framed only to fold.
	assert.match(html, /<pre><code class="language-python">print\(1\)\n<\/code><\/pre>/);
	assert.match(figures[4], /class="code-file is-bare" data-language="python" data-fold="15"/);
	assert.match(html, /<pre><code class="language-xyz">@file \.\/assets\/a\.xyz\n<\/code><\/pre>/);
});

/** A short Gaussian optimization: two steps, then the end. */
const OPT_LOG = [
	' Berny optimization.  Step number 1',
	'                         Standard orientation:',
	'      1          8           0        0.000000    0.000000    0.127800',
	' Rotational constants (GHZ):    800.0    430.0    280.0',
	' SCF Done:  E(RB3LYP) =  -76.409600000     A.U. after   11 cycles',
	' Maximum Force            0.012300     0.000450     NO ',
	' Berny optimization.  Step number 2',
	'                         Standard orientation:',
	'      1          8           0        0.000000    0.000000    0.119229',
	' Rotational constants (GHZ):    810.0    432.0    281.0',
	' SCF Done:  E(RB3LYP) =  -76.412400000     A.U. after   11 cycles',
	' Maximum Force            0.000192     0.000450     YES',
	' Normal termination of Gaussian 16.',
].join('\n');

/** A figure as HTML. */
const toHtml = (figure: never) => unified().use(rehypeStringify).stringify({ type: 'root', children: [figure] } as never);

test('lines picked by what they say, as written, with context and the last only', () => {
	const meta = parseFenceMeta('match="SCF Done|Normal termination"');
	assert.deepEqual(meta.match, ['SCF Done', 'Normal termination']);
	const { parts, picked } = excerptLines(OPT_LOG, meta);
	assert.equal(picked, true);
	assert.deepEqual(parts.map((part) => [part.start, part.lines.length]), [[5, 1], [11, 1], [13, 1]]);

	const around = excerptLines(OPT_LOG, parseFenceMeta('match="SCF Done" context=1'));
	assert.deepEqual(around.parts.map((part) => [part.start, part.lines.length]), [[4, 3], [10, 3]]);

	const last = excerptLines(OPT_LOG, parseFenceMeta('match="SCF Done" last'));
	assert.deepEqual(last.parts, [{ start: 11, lines: [' SCF Done:  E(RB3LYP) =  -76.412400000     A.U. after   11 cycles'] }]);
	// Brackets and dots are text, not a pattern.
	assert.equal(excerptLines(OPT_LOG, parseFenceMeta('match="E(RB3LYP)"')).parts.length, 2);
});

test('stretches from one line to another, and the last of them', () => {
	const all = excerptLines(OPT_LOG, parseFenceMeta('from="Standard orientation" to="Rotational constants"'));
	assert.deepEqual(all.parts.map((part) => [part.start, part.lines.length]), [[2, 3], [8, 3]]);
	const last = excerptLines(OPT_LOG, parseFenceMeta('from="Standard orientation" to="Rotational constants" last'));
	assert.deepEqual(last.parts.map((part) => [part.start, part.lines.length]), [[8, 3]]);
	// Without `to=`, a stretch runs to the next `from=`, the last one to the end.
	const steps = excerptLines(OPT_LOG, parseFenceMeta('from="Step number"'));
	assert.deepEqual(steps.parts.map((part) => [part.start, part.lines.length]), [[1, 13]]);
	// Within a stretch, the lines that match.
	const force = excerptLines(OPT_LOG, parseFenceMeta('from="Step number 2" match="Maximum Force"'));
	assert.deepEqual(force.parts.map((part) => part.start), [12]);
});

test('what is looked for and not there is named', () => {
	assert.deepEqual(excerptLines(OPT_LOG, parseFenceMeta('match="imaginary|虚频"')), { parts: [], total: 13, picked: true, missing: 'imaginary」或「虚频' });
	assert.equal(excerptLines(OPT_LOG, parseFenceMeta('from="Input orientation"')).missing, 'Input orientation');
});

test('picked lines are drawn with their numbers, what is left out, and the lines that stand out', () => {
	const figure = codeFileFigure({
		language: 'output',
		meta: parseFenceMeta('match="SCF Done" mark="-76.4124" hl=13'),
		source: '@file ./assets/opt.log',
		file: { path: './assets/opt.log', text: OPT_LOG, href: '/article-assets/x/assets/opt.log' },
	});
	const html = toHtml(figure as never);
	assert.match(html, /⋯ 省略第 1–4 行 ⋯/u);
	assert.match(html, /⋯ 省略第 6–10 行 ⋯/u);
	assert.match(html, /⋯ 省略第 12–13 行 ⋯/u);
	assert.match(html, /<span class="line" data-line="5">/u);
	assert.match(html, /<span class="line is-marked" data-line="11">/u);

	const missing = toHtml(codeFileFigure({
		language: 'output',
		meta: parseFenceMeta('match="虚频"'),
		source: '',
		file: { path: './assets/opt.log', text: OPT_LOG, href: '' },
	}) as never);
	assert.match(missing, /⋯ 没有找到「虚频」 ⋯/u);
});
