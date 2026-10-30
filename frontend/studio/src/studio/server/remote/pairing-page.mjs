import { randomBytes } from 'node:crypto';

import { t } from '@blog/i18n/index.mjs';

const escape = (text) => String(text).replace(/[&<>"']/gu, (letter) => `&#${letter.charCodeAt(0)};`);
/** A value for the page's script: JSON, never ending its <script>. */
const scriptValue = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

/**
 * What a browser not paired yet is shown at the door (remote-access.mjs): the code the Mac shows, typed in, pairs it
 * (`POST /pair`, its key then its cookie) and the page asked for opens. Its own page, nothing of the Studio's in it;
 * its script runs by its nonce only, and no other site may frame it.
 * @param {{ mac: string }} options the Mac's name, to say whose Studio this is
 * @returns {{ html: string, headers: Record<string, string> }}
 */
export function pairingPage({ mac }) {
	const nonce = randomBytes(16).toString('base64');
	const said = {
		pairing: t('正在配对…'),
		failed: t('没能配对'),
		unreachable: t('连不上这台 Mac'),
		browser: t('浏览器'),
	};
	const html = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Studio</title>
<style>
	:root { --fg: #1f1f1f; --muted: #73726e; --line: #e3e2de; --field: #fff; --bg: #fbfbfa; --error: #d44c47; }
	@media (prefers-color-scheme: dark) { :root { --fg: #e6e6e4; --muted: #9b9a97; --line: #3a3a3a; --field: #252525; --bg: #191919; --error: #ff7369; } }
	* { box-sizing: border-box; }
	body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
	form { width: min(360px, 100%); display: grid; gap: 14px; }
	h1 { margin: 0; font-size: 20px; font-weight: 600; }
	p { margin: 0; color: var(--muted); font-size: 13px; }
	label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
	input { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--field); color: var(--fg); font: inherit; font-size: 14px; }
	input:focus { outline: 2px solid var(--fg); outline-offset: -1px; }
	#code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; }
	button { padding: 8px 12px; border: 0; border-radius: 6px; background: var(--fg); color: var(--bg); font: inherit; font-weight: 500; cursor: pointer; }
	button:disabled { opacity: 0.5; cursor: default; }
	#said { min-height: 1.5em; font-size: 13px; color: var(--muted); }
	#said.error { color: var(--error); }
</style>
<form id="pair" autocomplete="off">
	<h1>Studio</h1>
	<p>${escape(t('这个浏览器还没有配对。在 Mac（{mac}）上的 Studio 里打开「设置 › 其他设备访问」，点「配对一台设备」，把显示的 8 位配对码输进来。', { mac }))}</p>
	<label>${escape(t('配对码'))}<input id="code" name="code" required maxlength="12" autocapitalize="characters" spellcheck="false" autofocus></label>
	<label>${escape(t('这台设备叫'))}<input id="name" name="name" maxlength="60"></label>
	<button id="go" type="submit">${escape(t('配对'))}</button>
	<div id="said" role="status"></div>
</form>
<script nonce="${nonce}">
	const said = ${scriptValue(said)};
	const agent = navigator.userAgent;
	const browser = /Edg\\//.test(agent) ? 'Edge' : /Firefox\\//.test(agent) ? 'Firefox' : /Chrome\\//.test(agent) ? 'Chrome' : /Safari\\//.test(agent) ? 'Safari' : said.browser;
	const system = /Windows/.test(agent) ? 'Windows' : /iPad|iPhone/.test(agent) ? 'iOS' : /Mac OS X/.test(agent) ? 'macOS' : /Android/.test(agent) ? 'Android' : /Linux/.test(agent) ? 'Linux' : '';
	const form = document.getElementById('pair');
	const status = document.getElementById('said');
	document.getElementById('name').value = system ? browser + '（' + system + '）' : browser;
	const say = (text, error) => {
		status.textContent = text;
		status.className = error ? 'error' : '';
	};
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const go = document.getElementById('go');
		go.disabled = true;
		say(said.pairing, false);
		try {
			const answer = await fetch('/pair', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: document.getElementById('code').value, name: document.getElementById('name').value, kind: 'browser' }),
			});
			if (answer.ok) {
				// Paired (its cookie set): the page asked for, the Studio's if none.
				location.replace(location.pathname === '/' ? '/studio' : location.href);
				return;
			}
			say((await answer.json().catch(() => null))?.error || said.failed, true);
		} catch {
			say(said.unreachable, true);
		}
		go.disabled = false;
	});
</script>
</html>
`;
	return {
		html,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store',
			'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
			'X-Frame-Options': 'DENY',
			'Referrer-Policy': 'no-referrer',
		},
	};
}
