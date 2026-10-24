import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { isPublicAddress, publicFetch } from './public-fetch.mjs';

/** A server of the test's own on `host`, answering with `handle`. */
async function serve(t, host, handle) {
	const server = createServer(handle);
	await new Promise((done) => server.listen(0, host, done));
	t.after(() => server.close());
	const { port } = server.address();
	return `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
}

test('this machine and its network are not the internet', () => {
	for (const address of ['127.0.0.1', '127.8.8.8', '0.0.0.0', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fe80::1', 'fd00::1', '64:ff9b::7f00:1', '2002:7f00:1::']) {
		assert.equal(isPublicAddress(address), false, address);
	}
	for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.equal(isPublicAddress(address), true, address);
	assert.equal(isPublicAddress('localhost'), false);
});

test('the Studio on localhost, written as an address or as a name, is refused', async (t) => {
	let reached = 0;
	const own = await serve(t, '127.0.0.1', (request, response) => {
		reached += 1;
		response.end('{}');
	});
	const port = new URL(own).port;
	for (const url of [`${own}/api/studio/agents`, `http://localhost:${port}/`, `http://[::ffff:127.0.0.1]:${port}/`, `http://0.0.0.0:${port}/`]) {
		await assert.rejects(publicFetch({ url, method: 'PUT', body: '{}' }), (error) => error.statusCode === 403 && /本机或局域网/u.test(error.message), url);
	}
	assert.equal(reached, 0);
	await assert.rejects(publicFetch({ url: 'file:///etc/passwd' }), /只能访问 http/u);
});

test('a redirect is checked like the first address, and is followed as browsers do', async (t) => {
	let landed = 0;
	const inside = await serve(t, '::1', (request, response) => {
		landed += 1;
		response.end('secret');
	});
	const outside = await serve(t, '127.0.0.1', (request, response) => {
		if (request.url === '/away') {
			response.writeHead(302, { location: `${inside}/` });
			return response.end();
		}
		if (request.url === '/moved') {
			response.writeHead(303, { location: '/here' });
			return response.end();
		}
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			response.writeHead(200, { 'content-type': 'text/plain', 'content-encoding': 'gzip', 'set-cookie': ['a=1', 'b=2'] });
			response.end(gzipSync(`${request.method} ${request.url} ${body}`));
		});
	});
	// Only this test's "internet": 127.0.0.1.
	const allowed = (address) => address === '127.0.0.1';
	await assert.rejects(publicFetch({ url: `${outside}/away` }, { allowed }), /::1/u);
	assert.equal(landed, 0);
	const answer = await publicFetch({ url: `${outside}/moved`, method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' }, { allowed });
	assert.deepEqual({ status: answer.status, ok: answer.ok, text: answer.text, cookies: answer.headers['set-cookie'] }, { status: 200, ok: true, text: 'GET /here ', cookies: 'a=1, b=2' });
});

test('a body larger than the limit is refused, not cut', async (t) => {
	const big = await serve(t, '127.0.0.1', (request, response) => response.end('x'.repeat(2048)));
	const allowed = () => true;
	await assert.rejects(publicFetch({ url: big }, { allowed, limit: 1024 }), /超过/u);
	assert.equal((await publicFetch({ url: big }, { allowed, limit: 4096 })).text.length, 2048);
});
