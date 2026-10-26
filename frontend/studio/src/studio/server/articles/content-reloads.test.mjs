import assert from 'node:assert/strict';
import test from 'node:test';
import { markContentReloads } from './content-reloads.mjs';

function fakeServer() {
	const sent = { ssr: [], client: [] };
	const channel = (name) => ({ send: (...args) => { sent[name].push(args); } });
	return { sent, environments: { ssr: { hot: channel('ssr') }, client: { hot: channel('client') } } };
}

test('the reload that follows a content change is marked, and only that one', async () => {
	const server = fakeServer();
	markContentReloads(server);
	const { ssr, client } = server.environments;

	ssr.hot.send('astro:content-changed', {});
	client.hot.send({ type: 'full-reload', path: '*' });
	client.hot.send({ type: 'full-reload', path: '*' });
	ssr.hot.send('astro:content-changed', {});
	await Promise.resolve();
	client.hot.send({ type: 'full-reload', path: '*' });

	assert.deepEqual(server.sent.client.map(([payload]) => payload.studioContentChange ?? false), [true, false, false]);
	assert.deepEqual(server.sent.ssr.map(([event]) => event), ['astro:content-changed', 'astro:content-changed']);
});
