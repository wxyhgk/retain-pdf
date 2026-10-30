import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { reachableAddresses, RemoteAccess } from './remote-access.mjs';

/** The Studio stand-in: says what it was asked (its headers), and answers a WebSocket's opening by echoing. */
async function studioStandIn(t) {
	const server = createServer((request, response) => {
		if (request.url === '/go') {
			response.writeHead(302, { Location: `http://localhost:${server.address().port}/studio` });
			return response.end();
		}
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.end(JSON.stringify({ url: request.url, headers: request.headers }));
	});
	server.on('upgrade', (request, socket, head) => {
		socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Seen-Host: ${request.headers.host}\r\n\r\n`);
		// What came with the opening (after its headers), and what comes after: back.
		if (head.length) socket.write(head);
		socket.on('data', (data) => socket.write(data));
	});
	// On ::1 only, as the Studio's own server is on macOS (`localhost`): the door must find it there.
	await new Promise((done) => server.listen(0, '::1', done));
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	return server.address().port;
}

async function fixture(t) {
	const folder = await mkdtemp(join(tmpdir(), 'studio-remote-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	const studio = await studioStandIn(t);
	const remote = new RemoteAccess({ settingsFile: join(folder, 'settings.json'), folder: join(folder, 'remote'), target: () => studio, port: 0, listenHost: '127.0.0.1' });
	t.after(() => remote.stop());
	return { remote, studio };
}

/** A request to the door (its certificate its own: not checked here, the app checks it by its fingerprint). */
function ask(remote, { method = 'GET', path = '/', headers = {}, body } = {}) {
	return new Promise((done, failed) => {
		const request = httpsRequest({ host: '127.0.0.1', port: remote.server.address().port, method, path, headers, rejectUnauthorized: false }, (response) => {
			let text = '';
			response.on('data', (chunk) => (text += chunk));
			response.on('end', () => done({ status: response.statusCode, headers: response.headers, text }));
		});
		request.on('error', failed);
		request.end(body);
	});
}

const pair = (remote, code) => ask(remote, { method: 'POST', path: '/pair', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name: '我的 iPad' }) });

test('off until turned on; on, it shows where it is, and its certificate’s fingerprint', async (t) => {
	const { remote } = await fixture(t);
	assert.equal((await remote.shown()).running, false);
	await assert.rejects(remote.pairingCode(), /先打开/u);
	const on = await remote.setEnabled(true);
	assert.equal(on.enabled, true);
	assert.equal(on.running, true);
	assert.match(on.fingerprint, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/u);
	const off = await remote.setEnabled(false);
	assert.equal(off.running, false);
	assert.equal(remote.server, null);
});

test('a device not paired is let in to nothing; paired by the code shown, once, it is', async (t) => {
	const { remote } = await fixture(t);
	await remote.setEnabled(true);
	assert.equal((await ask(remote, { path: '/studio' })).status, 401);
	const { code, pairing } = await remote.pairingCode();
	const told = JSON.parse(pairing);
	assert.equal(told.code, code);
	assert.equal(told.port, remote.server.address().port);
	assert.equal(told.fp, (await remote.shown()).fingerprint);

	assert.equal((await pair(remote, 'WRONGWRO')).status, 403);
	const paired = await pair(remote, code.toLowerCase());
	assert.equal(paired.status, 200);
	const { key } = JSON.parse(paired.text);
	assert.match(paired.headers['set-cookie'][0], /^studio_device=[\w-]+; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Strict$/u);
	// The code is gone once used.
	assert.equal((await pair(remote, code)).status, 403);
	const devices = (await remote.shown()).devices;
	assert.deepEqual(devices.map((device) => [device.name, device.kind]), [['我的 iPad', 'app']]);
	assert.equal(Object.hasOwn(devices[0], 'keyHash'), false);

	// Its key, as a cookie: what it asks is the Studio's to answer, as asked by the Studio's own page, from another device.
	const answer = await ask(remote, { path: '/api/studio/articles?x=1', headers: { Cookie: `theme=dark; studio_device=${key}`, Origin: 'https://192.168.1.5:4343' } });
	assert.equal(answer.status, 200);
	const seen = JSON.parse(answer.text);
	assert.equal(seen.url, '/api/studio/articles?x=1');
	assert.match(seen.headers.host, /^localhost:\d+$/u);
	assert.equal(seen.headers.origin, `http://${seen.headers.host}`);
	assert.equal(seen.headers['x-studio-remote'], '1');
	assert.equal(seen.headers.cookie, 'theme=dark');
	// Where the Studio sends itself (its own address in full): this door's.
	const moved = await ask(remote, { path: '/go', headers: { Cookie: `studio_device=${key}`, Host: 'mac.tail.ts.net:4343' } });
	assert.equal(moved.headers.location, 'https://mac.tail.ts.net:4343/studio');

	// Removed: out.
	await remote.removeDevice(devices[0].id);
	assert.equal((await ask(remote, { path: '/studio', headers: { Cookie: `studio_device=${key}` } })).status, 401);
});

test('a browser not paired is shown a page to type the code into; paired, it is a browser among the devices', async (t) => {
	const { remote } = await fixture(t);
	await remote.setEnabled(true);
	const page = await ask(remote, { path: '/studio?article=a', headers: { Accept: 'text/html,application/xhtml+xml' } });
	assert.equal(page.status, 401);
	assert.match(page.headers['content-type'], /^text\/html/u);
	assert.match(page.text, /<input id="code"/u);
	// Its script by its nonce only; no other site frames it.
	const nonce = /<script nonce="([^"]+)">/u.exec(page.text)?.[1];
	assert.ok(nonce);
	assert.ok(page.headers['content-security-policy'].includes(`script-src 'nonce-${nonce}'`));
	assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/u);
	// What is not a page (a script, a call): refused, no page.
	const call = await ask(remote, { path: '/api/studio/articles', headers: { Accept: '*/*' } });
	assert.equal(call.status, 401);
	assert.match(JSON.parse(call.text).error, /还没有配对/u);

	const { code } = await remote.pairingCode();
	const paired = await ask(remote, { method: 'POST', path: '/pair', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name: 'Chrome（Windows）', kind: 'browser' }) });
	assert.equal(paired.status, 200);
	assert.deepEqual((await remote.shown()).devices.map((device) => [device.name, device.kind]), [['Chrome（Windows）', 'browser']]);
});

test('a code tried too often is gone; one waited too long for is no good', async (t) => {
	const { remote } = await fixture(t);
	await remote.setEnabled(true);
	const { code } = await remote.pairingCode();
	for (let attempt = 0; attempt < 10; attempt += 1) await pair(remote, 'AAAAAAAA');
	assert.equal((await pair(remote, code)).status, 403);
	const again = await remote.pairingCode();
	remote.code.expires = Date.now() - 1;
	assert.match((await pair(remote, again.code)).text, /过期/u);
});

test('a WebSocket (the terminal, Vite’s) of a device paired is let through to the Studio; of one not, refused', async (t) => {
	const { remote } = await fixture(t);
	await remote.setEnabled(true);
	const { code } = await remote.pairingCode();
	const { key } = JSON.parse((await pair(remote, code)).text);
	const open = (cookie) =>
		new Promise((done, failed) => {
			const socket = tlsConnect({ host: '127.0.0.1', port: remote.server.address().port, rejectUnauthorized: false }, () => {
				socket.write(`GET /ws HTTP/1.1\r\nHost: 192.168.1.5:4343\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n${cookie ? `Cookie: studio_device=${cookie}\r\n` : ''}\r\nhello`);
			});
			let said = '';
			socket.on('data', (data) => {
				said += data;
				if (said.includes('hello') || said.includes('401')) {
					socket.destroy();
					done(said);
				}
			});
			socket.on('error', failed);
		});
	const through = await open(key);
	assert.match(through, /^HTTP\/1\.1 101/u);
	assert.match(through, /X-Seen-Host: localhost:\d+/u);
	assert.match(through, /hello$/u);
	assert.match(await open(null), /^HTTP\/1\.1 401/u);
});

test('the addresses another device may come by: the Wi-Fi’s and Tailscale’s, not this machine’s own', () => {
	const found = reachableAddresses({
		lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
		en0: [{ address: '192.168.1.5', family: 'IPv4', internal: false }, { address: 'fe80::1', family: 'IPv6', internal: false }],
		utun4: [{ address: '100.101.102.103', family: 'IPv4', internal: false }],
		utun2: [{ address: '10.8.0.2', family: 'IPv4', internal: false }],
	});
	assert.deepEqual(found, [{ kind: 'lan', host: '192.168.1.5' }, { kind: 'tailscale', host: '100.101.102.103' }]);
});
