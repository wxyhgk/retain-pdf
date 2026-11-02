import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DEFAULT_RETAINPDF_URL, RetainpdfSettings, runtimeConfig } from './retainpdf-settings.mjs';

const saved = (file) => JSON.parse(readFileSync(file, 'utf8'));
/** No RetainPDF answering (not the one maybe running on this machine): nothing found. */
const nowhere = async () => {
	throw new TypeError('fetch failed');
};
const notFound = { api: null, key: false };

test('RetainPDF is at the default address until another is set; empty or the default sets it back', async (t) => {
	const folder = mkdtempSync(join(tmpdir(), 'studio-retainpdf-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	const file = join(folder, '.studio-settings.json');
	writeFileSync(file, JSON.stringify({ locale: 'zh-CN' }));
	const settings = new RetainpdfSettings(file, { fetch: nowhere });

	assert.deepEqual(await settings.shown(), { url: DEFAULT_RETAINPDF_URL, default: DEFAULT_RETAINPDF_URL, isDefault: true, apiUrl: '', api: DEFAULT_RETAINPDF_URL, keySet: false, found: notFound });

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
	const settings = new RetainpdfSettings(join(folder, '.studio-settings.json'), { fetch: nowhere });
	for (const url of ['127.0.0.1:40001', 'not an address', 'file:///Applications/RetainPDF.app', 'javascript:alert(1)']) {
		await assert.rejects(settings.set(url), (error) => error.statusCode === 400, url);
	}
	assert.equal((await settings.shown()).url, DEFAULT_RETAINPDF_URL);
});

test("RetainPDF's API: where its pages are unless set, its key kept for the server and never shown back", async (t) => {
	const folder = mkdtempSync(join(tmpdir(), 'studio-retainpdf-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	const file = join(folder, '.studio-settings.json');
	const settings = new RetainpdfSettings(file, { fetch: nowhere });
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

test("RetainPDF's runtime config read as written: in an object, set after, in JSON; the last that says something", () => {
	const objects = 'window.__FRONT_RUNTIME_CONFIG__ = {\n  apiBase: "",\n  xApiKey: "",\n};\n';
	const local = 'window.__FRONT_RUNTIME_CONFIG__ = { ...(window.__FRONT_RUNTIME_CONFIG__ || {}), apiBase: "http://127.0.0.1:41000", model: "m" };\n';
	const patched = '(function () {\n  var c = window.__FRONT_RUNTIME_CONFIG__ = window.__FRONT_RUNTIME_CONFIG__ || {};\n  if (!c.xApiKey) c.xApiKey = "dev-key";\n})();\n';
	assert.deepEqual(runtimeConfig(objects), { apiBase: '', xApiKey: '' });
	assert.deepEqual(runtimeConfig(objects + local + patched), { apiBase: 'http://127.0.0.1:41000', xApiKey: 'dev-key' });
	// The desktop app's, written into its pages.
	const desktop = '<script>window.__FRONT_RUNTIME_CONFIG__=Object.assign({},window.__FRONT_RUNTIME_CONFIG__||{},{"apiBase":"http://127.0.0.1:41010","xApiKey":"app-key"});</script>';
	assert.deepEqual(runtimeConfig(objects + desktop), { apiBase: 'http://127.0.0.1:41010', xApiKey: 'app-key' });
	assert.deepEqual(runtimeConfig("const apiBase = compute(); x.xApiKey = 'single';"), { apiBase: '', xApiKey: 'single' });
});

test("RetainPDF's API and key found from its pages, nothing filled in; what is set is used instead; asked again after a while", async (t) => {
	const folder = mkdtempSync(join(tmpdir(), 'studio-retainpdf-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	const file = join(folder, '.studio-settings.json');
	// Its development stack: the pages on 40001, its runtime config saying where the API is and its key.
	const served = {
		'http://127.0.0.1:40001/runtime-config.js': 'window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "", xApiKey: "" };',
		'http://127.0.0.1:40001/runtime-config.local.js': 'window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://127.0.0.1:41000" };\nif (!c.xApiKey) c.xApiKey = "found-key";',
		'http://127.0.0.1:40001/': '<!doctype html><script src="./runtime-config.js"></script>',
	};
	const asked = [];
	let now = 0;
	const settings = new RetainpdfSettings(file, {
		now: () => now,
		fetch: async (url) => {
			asked.push(String(url));
			const text = served[String(url)];
			return { ok: text !== undefined, text: async () => text ?? '' };
		},
	});
	assert.deepEqual(await settings.connection(), { api: 'http://127.0.0.1:41000/', key: 'found-key' });
	const shown = await settings.shown();
	assert.equal(shown.api, 'http://127.0.0.1:41000/');
	assert.deepEqual(shown.found, { api: 'http://127.0.0.1:41000/', key: true });
	assert.equal(shown.keySet, false);
	assert.doesNotMatch(JSON.stringify(shown), /found-key/u);
	assert.equal(asked.length, 3, 'asked once, kept for a while');

	// Set in the settings: those, not what was found.
	await settings.set({ apiUrl: 'http://127.0.0.1:42000', apiKey: 'own-key' });
	assert.deepEqual(await settings.connection(), { api: 'http://127.0.0.1:42000/', key: 'own-key' });
	await settings.set({ apiUrl: '', apiKey: '' });

	// A while later, RetainPDF gone: nothing found, its pages' address as before.
	now += 60_000;
	for (const url of Object.keys(served)) delete served[url];
	assert.deepEqual(await settings.connection(), { api: DEFAULT_RETAINPDF_URL, key: '' });
});

test("RetainPDF's pages not saying where its API is (or saying it in code): where they look then, port 41000 of their host", async () => {
	const served = {
		'http://127.0.0.1:40001/runtime-config.js': 'window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "", xApiKey: "" };',
		'http://127.0.0.1:40001/runtime-config.local.js': 'window.__FRONT_RUNTIME_CONFIG__ = { apiBase: `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:41000` };',
	};
	const settings = new RetainpdfSettings('/nonexistent/.studio-settings.json', { fetch: async (url) => ({ ok: String(url) in served, text: async () => served[String(url)] ?? '' }) });
	assert.equal((await settings.findApi('http://127.0.0.1:40001/')).api, 'http://127.0.0.1:41000/');
	assert.equal((await settings.findApi('https://pdf.example.org/')).api, '', 'nothing answered there: nothing found');
});
