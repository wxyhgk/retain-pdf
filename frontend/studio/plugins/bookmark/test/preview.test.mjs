import assert from 'node:assert/strict';
import test from 'node:test';

import { describePage, previewPage } from '../preview.mjs';

/** A fetch that answers each address with this response (a function of the request, or the body to send). */
function fakeFetch(answers) {
	const asked = [];
	const fetch = async (url, init) => {
		asked.push({ url, init });
		const answer = answers[url];
		if (!answer) throw new TypeError('fetch failed');
		return typeof answer === 'function' ? answer(init) : answer;
	};
	return { fetch, asked };
}

test('a page tells its title, description, picture and site in its <meta>; the picture is made absolute', () => {
	const html = `<html><head><title>Plain &amp; title</title>
		<meta property="og:title" content="OG &quot;title&quot;">
		<meta name="description" content="  what
		it is ">
		<meta property="og:image" content="/img/cover.png">
		<meta property="og:site_name" content="Site">
		</head><body><meta property="og:title" content="not this"></body></html>`;
	assert.deepEqual(describePage(html, 'https://www.example.com/a/b'), {
		title: 'OG "title"',
		description: 'what it is',
		image: 'https://www.example.com/img/cover.png',
		site: 'Site',
	});
	// Without Open Graph: <title>, and the site's name from its address.
	assert.deepEqual(describePage('<title>Only &#x4E2D;&#25991;</title>', 'https://www.example.com/'), { title: 'Only 中文', description: '', image: '', site: 'example.com' });
	// A picture that is not http(s) is not kept.
	assert.equal(describePage('<meta property="og:image" content="javascript:x">', 'https://a.org/').image, '');
});

test('a page is read in the charset it says it is in', async () => {
	const gbk = new Uint8Array([0x3c, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e, 0xd6, 0xd0, 0xce, 0xc4, 0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e]);
	const { fetch } = fakeFetch({ 'https://gbk.example/': () => new Response(gbk, { headers: { 'content-type': 'text/html; charset=gbk' } }) });
	assert.equal((await previewPage('https://gbk.example/', fetch)).title, '中文');
});

test('a DOI is asked of doi.org: title, first authors, journal and year', async () => {
	const paper = { title: 'Fast <i>xtb</i> methods', author: [{ family: 'Bannwarth' }, { family: 'Ehlert' }, { family: 'Grimme' }], 'container-title': 'J. Chem. Theory Comput.', issued: { 'date-parts': [[2019, 3]] } };
	const { fetch, asked } = fakeFetch({ 'https://doi.org/10.1021/acs.jctc.8b01176': () => Response.json(paper) });
	assert.deepEqual(await previewPage('https://doi.org/10.1021/acs.jctc.8b01176', fetch), {
		url: 'https://doi.org/10.1021/acs.jctc.8b01176',
		title: 'Fast xtb methods',
		description: 'Bannwarth 等 · J. Chem. Theory Comput. 2019',
		image: '',
		site: 'J. Chem. Theory Comput.',
	});
	assert.equal(asked[0].init.headers.Accept, 'application/vnd.citationstyles.csl+json');
});

test('what goes wrong is said, with the status a route answers', async () => {
	const { fetch } = fakeFetch({ 'https://shut.example/': () => new Response('no', { status: 403 }) });
	await assert.rejects(previewPage('https://shut.example/', fetch), { message: 'shut.example 没有给出这个页面（403）', statusCode: 502 });
	await assert.rejects(previewPage('https://gone.example/', fetch), { message: '连不上 gone.example，检查一下网络' });
	await assert.rejects(previewPage('file:///etc/passwd', fetch), { statusCode: 400 });
	// Not a page: only its address and site.
	const pdf = fakeFetch({ 'https://a.org/p.pdf': () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }) });
	assert.deepEqual(await previewPage('https://a.org/p.pdf', pdf.fetch), { url: 'https://a.org/p.pdf', title: '', description: '', image: '', site: 'a.org' });
});
