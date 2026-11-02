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

	assert.deepEqual(await settings.shown(), { url: DEFAULT_RETAINPDF_URL, default: DEFAULT_RETAINPDF_URL, isDefault: true, apiUrl: '', api: DEFAULT_RETAINPDF_URL, keySet: false });

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

test("RetainPDF's API: where its pages are unless set, its key kept for the server and never shown back", async (t) => {
	const folder = mkdtempSync(join(tmpdir(), 'studio-retainpdf-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	const file = join(folder, '.studio-settings.json');
	const settings = new RetainpdfSettings(file);
	assert.deepEqual(await settings.connection(), { api: DEFAULT_RETAINPDF_URL, key: '' });

	// Its development stack: the API on a port of its own, and its key.
	const shown = await settings.set({ url: '', apiUrl: 'http://127.0.0.1:41000', apiKey: '  secret-key  ' });
	assert.equal(shown.api, 'http://127.0.0.1:41000/');
	assert.equal(shown.keySet, true);
	assert.doesNotMatch(JSON.stringify(shown), /secret-key/u);
	assert.deepEqual(await settings.connection(), { api: 'http://127.0.0.1:41000/', key: 'secret-key' });

	// The page's address saved again (the form as before): the API's and the key kept.
	await settings.set('http://127.0.0.1:40002/');
	await settings.set({ url: 'http://127.0.0.1:40002/', apiUrl: 'http://127.0.0.1:41000/' });
	assert.deepEqual(await settings.connection(), { api: 'http://127.0.0.1:41000/', key: 'secret-key' });

	// The key taken away, the API's address emptied: where the pages are.
	await settings.set({ apiKey: '', apiUrl: '' });
	assert.deepEqual(await settings.connection(), { api: 'http://127.0.0.1:40002/', key: '' });
	assert.deepEqual(saved(file), { retainpdfUrl: 'http://127.0.0.1:40002/' });
	await assert.rejects(settings.set({ apiUrl: 'ftp://127.0.0.1/' }), (error) => error.statusCode === 400);
});
