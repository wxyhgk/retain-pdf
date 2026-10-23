import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveShortLink } from '../server.mjs';

const redirect = (location) => new Response(null, { status: 302, headers: location ? { location } : {} });

test('a Bilibili short link is opened to the video it stands for, following short links only', async () => {
	const asked = [];
	const fetchPage = async (url) => {
		asked.push(url);
		return url === 'https://b23.tv/abc' ? redirect('https://b23.tv/def') : redirect('https://www.bilibili.com/video/BV1GJ411x7h7?share_source=copy');
	};
	assert.equal(await resolveShortLink('https://b23.tv/abc', fetchPage), 'https://www.bilibili.com/video/BV1GJ411x7h7?share_source=copy');
	assert.deepEqual(asked, ['https://b23.tv/abc', 'https://b23.tv/def']);
});

test('a short link that leads to no video, or nowhere, is said so', async () => {
	await assert.rejects(resolveShortLink('https://b23.tv/abc', async () => redirect('https://www.bilibili.com/')), /不是 B 站的视频/u);
	await assert.rejects(resolveShortLink('https://b23.tv/abc', async () => redirect('')), /没有指向别处/u);
	await assert.rejects(resolveShortLink('不是网址', async () => redirect('')), /不是网址/u);
});
