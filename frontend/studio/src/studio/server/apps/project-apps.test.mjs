import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { forwardUpgrade, proxyToApp } from './app-proxy.mjs';
import { ProjectApps } from './project-apps.mjs';

// A development server of a few lines: it answers under its base, says what it was asked, and ends when told to.
const SERVER = `
import { createServer } from 'node:http';
const [port, base] = process.argv.slice(2);
console.log('listening on', port, base);
createServer((request, response) => {
	if (request.url === base + 'quit') process.exit(3);
	response.setHeader('content-type', request.url.endsWith('.js') ? 'text/javascript' : 'text/html');
	response.end(request.url.endsWith('.js') ? 'export const x = 1' : '<html><head><title>app</title></head><body>' + request.url + '</body></html>');
}).listen(Number(port), 'localhost');
`;

async function project(t) {
	const folder = await mkdtemp(join(tmpdir(), 'studio-project-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	await writeFile(join(folder, 'server.mjs'), SERVER);
	const apps = new ProjectApps({ shell: '/bin/sh', patience: 15_000 });
	t.after(() => apps.closeAll());
	return { apps, dev: { cwd: folder, command: [process.execPath, 'server.mjs', '{port}', '{base}'], backend: null } };
}

const get = (port, path) => fetch(`http://localhost:${port}${path}`).then((response) => response.text());

test('a project app is started once on a port of its own, under its base; it stops, and one that ends by itself has stopped', async (t) => {
	const { apps, dev } = await project(t);
	const changes = [];
	apps.subscribe((id) => changes.push(`${id}:${apps.status(id).state}`));
	const [port, again] = await Promise.all([apps.start('demo', dev), apps.start('demo', dev)]);
	assert.equal(port, again);
	assert.equal(apps.port('demo'), port);
	assert.deepEqual(apps.status('demo'), { state: 'running', port, error: null });
	assert.match(await get(port, '/studio-apps/demo/x'), /\/studio-apps\/demo\/x/u);
	assert.match(apps.log('demo'), /listening on \d+ \/studio-apps\/demo\//u);
	assert.deepEqual(changes, ['demo:starting', 'demo:running']);

	// It ends by itself: stopped, and why.
	await get(port, '/studio-apps/demo/quit').catch(() => {});
	await new Promise((resolve) => setTimeout(resolve, 300));
	assert.equal(apps.status('demo').state, 'stopped');
	assert.match(apps.status('demo').error, /退出了（3）/u);
	assert.equal(apps.port('demo'), null);

	// Started again when asked; stopped when told.
	const next = await apps.start('demo', dev);
	assert.equal(apps.status('demo').state, 'running');
	apps.stop('demo');
	assert.equal(apps.status('demo').state, 'stopped');
	await new Promise((resolve) => setTimeout(resolve, 300));
	await assert.rejects(get(next, '/studio-apps/demo/'));
});

test('a project app that cannot start has failed, and says why', async (t) => {
	const { apps, dev } = await project(t);
	await assert.rejects(apps.start('broken', { ...dev, command: [process.execPath, '-e', 'console.error("no such module"); process.exit(1)'] }), /退出了/u);
	assert.equal(apps.status('broken').state, 'failed');
	assert.match(apps.log('broken'), /no such module/u);
});

test('its pages through the Studio: as it answers, a page with `studio` first; its websocket passed both ways', async (t) => {
	const { apps, dev } = await project(t);
	const port = await apps.start('demo', dev);
	const studio = createServer((asked, answer) => proxyToApp(asked, answer, port));
	studio.on('upgrade', (asked, socket, head) => forwardUpgrade(asked, socket, head, port));
	await new Promise((resolve) => studio.listen(0, '127.0.0.1', resolve));
	t.after(() => studio.close());
	const at = studio.address().port;
	const page = await fetch(`http://127.0.0.1:${at}/studio-apps/demo/`);
	const html = await page.text();
	assert.equal(page.headers.get('cache-control'), 'no-store');
	assert.match(html, /^<html><head><style>[\s\S]*window\.studio = studio[\s\S]*<\/script><title>app<\/title>/u);
	assert.equal(Number(page.headers.get('content-length')), Buffer.byteLength(html));
	assert.equal(await (await fetch(`http://127.0.0.1:${at}/studio-apps/demo/main.js`)).text(), 'export const x = 1');

	// An upgrade reaches the app's server as asked, its Host its own.
	const asked = new Promise((resolve) => {
		const upstream = createServer();
		upstream.on('upgrade', (incoming, socket) => {
			socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\nhello');
			resolve(incoming);
		});
		upstream.listen(0, 'localhost', () => {
			const relay = createServer();
			relay.on('upgrade', (incoming, socket, head) => forwardUpgrade(incoming, socket, head, upstream.address().port));
			relay.listen(0, '127.0.0.1', () => {
				const client = connect(relay.address().port, '127.0.0.1', () => client.write('GET /studio-apps/demo/?token=1 HTTP/1.1\r\nHost: studio\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Protocol: vite-hmr\r\n\r\n'));
				let heard = '';
				client.on('data', (chunk) => (heard += chunk));
				client.on('close', () => {
					t.diagnostic(heard.split('\r\n')[0]);
					relay.close();
					upstream.close();
				});
			});
		});
	});
	const incoming = await asked;
	assert.equal(incoming.url, '/studio-apps/demo/?token=1');
	assert.equal(incoming.headers.host, `localhost:${incoming.socket.localPort}`);
	assert.equal(incoming.headers['sec-websocket-protocol'], 'vite-hmr');
});
