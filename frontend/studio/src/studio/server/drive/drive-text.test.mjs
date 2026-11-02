import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DriveText, extractText, findPdftotext, TEXT_FOLDER } from './drive-text.mjs';

const fixture = (name) => new URL(`../../../../tests/e2e/fixtures/office/${name}`, import.meta.url);

test('the words of Word, PowerPoint, Excel and plain files; a PDF through pdftotext', async () => {
	assert.equal(await extractText(fixture('report.docx').pathname), '水分子的几何优化报告\n\n收敛四项都达标。');
	assert.equal(await extractText(fixture('slides.pptx').pathname), '## 第 1 张\n水分子几何优化\n\n## 第 2 张\n收敛四项都达标');
	assert.equal(await extractText(fixture('energies.xlsx').pathname), '## 工作表 energies\n结构,E / kcal/mol\nRC2,-0.45\nTS2,-0.21\nPC2,-41.7');
	assert.equal(await extractText(fixture('report.pdf').pathname), null, 'no PDF without pdftotext');
	assert.equal(await extractText('/nowhere/movie.mp4'), null);
});

test('a PDF read by pdftotext', { skip: !findPdftotext() && 'pdftotext is not installed' }, async () => {
	assert.equal(await extractText(fixture('report.pdf').pathname, { pdftotext: findPdftotext() }), '水分子的几何优化报告\n\n收敛四项都达标。');
});

test('the drive kept as text, read again only when changed, searched by name and words', async (t) => {
	const root = mkdtempSync(join(tmpdir(), 'drive-text-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, '组会'));
	mkdirSync(join(root, '.hidden'));
	copyFileSync(fixture('slides.pptx'), join(root, '组会', '第 3 次.pptx'));
	copyFileSync(fixture('report.docx'), join(root, '优化报告.docx'));
	writeFileSync(join(root, '组会', 'water opt.log'), 'Step 1\n SCF Done:  E(RB3LYP) =  -76.4089 A.U.\nNormal termination\n');
	writeFileSync(join(root, '.hidden', 'secret.txt'), '水分子');
	writeFileSync(join(root, 'photo.png'), 'png');
	const text = new DriveText({ root: async () => root }, { pdftotext: null });

	const found = await text.search('水分子');
	assert.equal(found.indexing, false);
	assert.deepEqual(found.results, [
		{ path: '优化报告.docx', inName: false, snippet: '水分子的几何优化报告' },
		{ path: '组会/第 3 次.pptx', inName: false, snippet: '水分子几何优化' },
	]);
	assert.equal(readFileSync(join(root, TEXT_FOLDER, '组会', 'water opt.log.txt'), 'utf8').includes('SCF Done'), true);
	assert.equal(existsSync(join(root, TEXT_FOLDER, 'photo.png.txt')), false);
	assert.deepEqual((await text.search('scf done')).results, [{ path: '组会/water opt.log', inName: false, snippet: 'SCF Done: E(RB3LYP) = -76.4089 A.U.' }]);
	assert.deepEqual((await text.search('PNG')).results, [{ path: 'photo.png', inName: true }]);
	assert.deepEqual((await text.search('第 3')).results.map((result) => [result.path, result.inName]), [['组会/第 3 次.pptx', true]]);

	// Changed and removed: read again, and forgotten.
	writeFileSync(join(root, '组会', 'water opt.log'), 'Error termination\n');
	utimesSync(join(root, '组会', 'water opt.log'), new Date(), new Date(Date.now() + 5000));
	rmSync(join(root, '优化报告.docx'));
	await text.refresh();
	assert.deepEqual((await text.search('termination')).results.map((result) => result.snippet), ['Error termination']);
	assert.deepEqual((await text.search('水分子')).results.map((result) => result.path), ['组会/第 3 次.pptx']);
	assert.equal(existsSync(join(root, TEXT_FOLDER, '优化报告.docx.txt')), false);
	const manifest = JSON.parse(readFileSync(join(root, TEXT_FOLDER, 'index.json'), 'utf8'));
	assert.deepEqual(Object.keys(manifest.files).sort(), ['组会/water opt.log', '组会/第 3 次.pptx', 'photo.png'].sort());
});

test('an index written by someone else names nothing outside the drive: nothing there is removed or read', async (t) => {
	const base = mkdtempSync(join(tmpdir(), 'drive-text-'));
	t.after(() => rmSync(base, { recursive: true, force: true }));
	const root = join(base, 'drive');
	mkdirSync(join(root, TEXT_FOLDER), { recursive: true });
	writeFileSync(join(base, 'notes.txt'), '外面的文字');
	writeFileSync(join(root, TEXT_FOLDER, 'index.json'), JSON.stringify({ version: 1, files: { '../../notes': { size: 1, modified: 1, text: true } } }));
	const text = new DriveText({ root: async () => root }, { pdftotext: null });
	assert.deepEqual((await text.search('外面')).results, []);
	await text.refresh();
	assert.equal(readFileSync(join(base, 'notes.txt'), 'utf8'), '外面的文字');
});
