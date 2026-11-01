import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DEFAULT_RETAINPDF_URL, RetainpdfSettings } from './retainpdf-settings.mjs';

const saved = (file) => JSON.parse(readFileSync(file, 'utf8'));

test('RetainPDF is at the default address until another is set; empty or the default sets it back', async (t) => {
	const folder = mkdtempSync(join(tmpdir(), 'studio-retainpdf-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	const file = join(folder, '.studio-settings.json');
	writeFileSync(file, JSON.stringify({ locale: 'zh-CN' }));
	const settings = new RetainpdfSettings(file);

	assert.deepEqual(await settings.shown(), { url: DEFAULT_RETAINPDF_URL, default: DEFAULT_RETAINPDF_URL, isDefault: true });

	// Another port (the desktop app's moved on), written as a whole address.
	assert.equal((await settings.set('  http://127.0.0.1:40002  ')).url, 'http://127.0.0.1:40002/');
	assert.deepEqual(saved(file), { locale: 'zh-CN', retainpdfUrl: 'http://127.0.0.1:40002/' });

	// Empty, or the default written out: nothing kept, the other settings left as they are.
	await settings.set('');
	assert.deepEqual(saved(file), { locale: 'zh-CN' });
	await settings.set('https://pdf.example.org/');
	await settings.set(DEFAULT_RETAINPDF_URL);
	assert.deepEqual(saved(file), { locale: 'zh-CN' });
	assert.equal((await settings.shown()).isDefault, true);
});

test('only an http(s) address is taken for RetainPDF', async (t) => {
	const folder = mkdtempSync(join(tmpdir(), 'studio-retainpdf-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	const settings = new RetainpdfSettings(join(folder, '.studio-settings.json'));
	for (const url of ['127.0.0.1:40001', 'not an address', 'file:///Applications/RetainPDF.app', 'javascript:alert(1)']) {
		await assert.rejects(settings.set(url), (error) => error.statusCode === 400, url);
	}
	assert.equal((await settings.shown()).url, DEFAULT_RETAINPDF_URL);
});
