import { createHash, randomBytes, timingSafeEqual, X509Certificate } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:https';
import { connect } from 'node:net';
import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';

import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * iPad 访问: the Studio opened from another device of the author's (the Studio's iPad app), over the Wi-Fi or
 * Tailscale. The Studio's own server listens on this machine only; this is a door of its own, off unless turned on
 * (设置 › iPad 访问), in front of it:
 *
 * - HTTPS, with a certificate of its own (made once, `.studio-cache/remote/`); the app trusts that one only, by the
 *   fingerprint the pairing code gave it, so no one on the network reads or changes what goes through.
 * - Only a device paired lets in: paired by a code shown on this machine (a QR code, 5 minutes, once), it is given
 *   a key of its own (kept as its hash in the settings), sent with each request (a cookie); removed, it is out.
 * - What it asks is passed on to the Studio as this machine's own page asks it (its address, its origin), marked as
 *   from another device (`x-studio-remote`): what only this machine may do (this door's own settings) refuses it.
 */

export const REMOTE_PORT = 4343;
const COOKIE = 'studio_device';
const CODE_LIFE = 5 * 60_000;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const hash = (text) => createHash('sha256').update(text).digest();
const cookieOf = (header) => /(?:^|;\s*)studio_device=([A-Za-z0-9_-]{20,})/u.exec(header ?? '')?.[1] ?? null;

/** This machine's addresses another device may reach it by: the Wi-Fi's (and the wire's), Tailscale's (100.64.0.0/10). */
export function reachableAddresses(interfaces = networkInterfaces()) {
	const found = [];
	for (const [name, entries] of Object.entries(interfaces)) {
		for (const entry of entries ?? []) {
			if (entry.internal || entry.family !== 'IPv4') continue;
			const [first, second] = entry.address.split('.').map(Number);
			const tailscale = first === 100 && second >= 64 && second <= 127;
			if (tailscale || /^(?:en|eth|bridge)\d/u.test(name)) found.push({ kind: tailscale ? 'tailscale' : 'lan', host: entry.address });
		}
	}
	return found;
}

export class RemoteAccess {
	/**
	 * @param {{ settingsFile: string, folder: string, target(): number | null, port?: number, listenHost?: string }} options
	 *   `folder` keeps the certificate; `target` is the Studio's own server's port (null before it listens).
	 */
	constructor({ settingsFile, folder, target, port, listenHost = '0.0.0.0' }) {
		this.settingsFile = settingsFile;
		this.folder = folder;
		this.target = target;
		this.wanted = port;
		this.listenHost = listenHost;
		this.server = null;
		/** The pairing code shown now: `{ code, expires, tries }`. */
		this.code = null;
		this.seen = new Map();
	}

	async #settings() {
		// Asked at each request (a page is hundreds): read again a few seconds on, or once changed here.
		if (this.kept && Date.now() - this.kept.at < 3000) return this.kept.value;
		const kept = (await readSettings(this.settingsFile)).remote;
		const value = { enabled: kept?.enabled === true, port: Number.isInteger(kept?.port) ? kept.port : REMOTE_PORT, devices: Array.isArray(kept?.devices) ? kept.devices : [] };
		this.kept = { at: Date.now(), value };
		return value;
	}

	async #save(change) {
		this.kept = null;
		await updateSettings(this.settingsFile, (settings) => ({ ...settings, remote: change({ enabled: false, port: REMOTE_PORT, devices: [], ...(settings.remote ?? {}) }) }));
	}

	/** The certificate (made once with the system's openssl) and its fingerprint (`AB:CD:…`, SHA-256). */
	async #certificate() {
		const key = join(this.folder, 'key.pem');
		const cert = join(this.folder, 'cert.pem');
		if (!existsSync(key) || !existsSync(cert)) {
			await mkdir(this.folder, { recursive: true });
			await new Promise((done, failed) => {
				execFile('/usr/bin/openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '3650', '-subj', '/CN=Studio', '-keyout', key, '-out', cert], { timeout: 30_000 }, (error) => (error ? failed(new Error(t('没能生成 iPad 访问的证书：{message}', { message: error.message }))) : done()));
			});
		}
		const [keyText, certText] = await Promise.all([readFile(key, 'utf8'), readFile(cert, 'utf8')]);
		return { key: keyText, cert: certText, fingerprint: new X509Certificate(certText).fingerprint256 };
	}

	/** How it is: on or not, where it can be reached, the devices paired (their keys not given). */
	async shown() {
		const { enabled, devices } = await this.#settings();
		const port = this.server?.address()?.port ?? null;
		return {
			enabled,
			running: Boolean(this.server),
			port,
			addresses: port ? reachableAddresses() : [],
			fingerprint: this.server ? this.fingerprint : null,
			devices: devices.map(({ id, name, added, seen }) => ({ id, name, added, seen: this.seen.get(id) ?? seen ?? null })),
		};
	}

	/** Turned on (it starts, and starts again with the Studio from now on) or off (it stops, the codes with it). */
	async setEnabled(enabled) {
		await this.#save((remote) => ({ ...remote, enabled: Boolean(enabled) }));
		if (enabled) await this.start();
		else await this.stop();
		return this.shown();
	}

	/** Started, if it is turned on (as the Studio starts). */
	async resume() {
		if ((await this.#settings()).enabled) await this.start();
	}

	async start() {
		if (this.server) return;
		const { key, cert, fingerprint } = await this.#certificate();
		this.fingerprint = fingerprint;
		const server = createServer({ key, cert }, (request, response) => void this.#handle(request, response));
		server.on('upgrade', (request, socket, head) => void this.#upgrade(request, socket, head));
		const port = this.wanted ?? (await this.#settings()).port;
		await new Promise((done, failed) => {
			server.once('error', failed);
			server.listen(port, this.listenHost, () => {
				server.off('error', failed);
				done();
			});
		});
		this.server = server;
	}

	async stop() {
		this.code = null;
		const server = this.server;
		this.server = null;
		if (!server) return;
		server.closeAllConnections?.();
		await new Promise((done) => server.close(() => done()));
	}

	/**
	 * A code to pair a device with, for 5 minutes, once: shown as a QR code, with what the app needs to reach this
	 * machine and trust it (its addresses, the port, the certificate's fingerprint).
	 */
	async pairingCode() {
		if (!this.server) throw Object.assign(new Error(t('先打开 iPad 访问')), { statusCode: 409 });
		const code = Array.from(randomBytes(8), (byte) => CODE_LETTERS[byte % CODE_LETTERS.length]).join('');
		this.code = { code, expires: Date.now() + CODE_LIFE, tries: 0 };
		const { port, addresses, fingerprint } = await this.shown();
		const pairing = { v: 1, name: hostname().replace(/\.local$/u, ''), hosts: addresses.map((address) => address.host), port, fp: fingerprint, code };
		return { code, expires: this.code.expires, pairing: JSON.stringify(pairing) };
	}

	async removeDevice(id) {
		await this.#save((remote) => ({ ...remote, devices: (remote.devices ?? []).filter((device) => device.id !== id) }));
		return this.shown();
	}

	/** The device a request comes from, by its key; null for none paired. */
	async #device(request) {
		const key = cookieOf(request.headers.cookie) ?? /^Bearer ([A-Za-z0-9_-]{20,})$/u.exec(request.headers.authorization ?? '')?.[1];
		if (!key) return null;
		const wanted = hash(key);
		const { devices } = await this.#settings();
		const device = devices.find((each) => typeof each.keyHash === 'string' && timingSafeEqual(Buffer.from(each.keyHash, 'hex'), wanted));
		if (device) this.seen.set(device.id, Date.now());
		return device ?? null;
	}

	/** `POST /pair {code, name}`: the code shown here, still good, makes a device and gives it its key. */
	async #pair(request, response) {
		const chunks = [];
		for await (const chunk of request) {
			chunks.push(chunk);
			if (chunks.reduce((sum, each) => sum + each.length, 0) > 4096) return send(response, 413, { error: t('太长了') });
		}
		let asked;
		try {
			asked = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		} catch {
			return send(response, 400, { error: t('配对请求无效') });
		}
		const shown = this.code;
		const typed = String(asked?.code ?? '').toUpperCase().replace(/[^A-Z0-9]/gu, '');
		if (!shown || Date.now() > shown.expires) return send(response, 403, { error: t('配对码过期了：在 Mac 上重新生成一个') });
		if (shown.tries >= 10) {
			this.code = null;
			return send(response, 403, { error: t('试错太多次：在 Mac 上重新生成配对码') });
		}
		if (typed.length !== shown.code.length || !timingSafeEqual(Buffer.from(typed), Buffer.from(shown.code))) {
			shown.tries += 1;
			return send(response, 403, { error: t('配对码不对') });
		}
		this.code = null;
		const key = randomBytes(32).toString('base64url');
		const device = { id: randomBytes(8).toString('hex'), name: String(asked?.name ?? '').trim().slice(0, 60) || t('一台设备'), keyHash: hash(key).toString('hex'), added: Date.now() };
		await this.#save((remote) => ({ ...remote, devices: [...(remote.devices ?? []), device] }));
		response.setHeader('Set-Cookie', `${COOKIE}=${key}; Path=/; Max-Age=315360000; HttpOnly; Secure; SameSite=Strict`);
		return send(response, 200, { id: device.id, key });
	}

	async #handle(request, response) {
		const path = (request.url ?? '/').split('?', 1)[0];
		if (request.method === 'POST' && path === '/pair') return this.#pair(request, response);
		if (!(await this.#device(request))) {
			response.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
			return response.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Studio</title><p style="font:16px -apple-system;margin:40px;color:#555">${t('这台设备还没有配对：在 Mac 上的 Studio 里打开「设置 › iPad 访问」，用 Studio 的 iPad App 扫码配对。')}</p>`);
		}
		const port = this.target();
		if (!port) return send(response, 503, { error: t('Studio 还没有启动完') });
		const upstream = httpRequest({ host: '127.0.0.1', port, method: request.method, path: request.url, headers: passedOn(request.headers, port) }, (answer) => {
			const headers = { ...answer.headers };
			// What the Studio sends to itself (its own address in full): to this door's.
			if (typeof headers.location === 'string') headers.location = headers.location.replace(new RegExp(`^https?://(?:localhost|127\\.0\\.0\\.1):${port}`, 'u'), `https://${request.headers.host}`);
			response.writeHead(answer.statusCode ?? 502, headers);
			answer.pipe(response);
		});
		upstream.on('error', () => {
			if (!response.headersSent) send(response, 502, { error: t('连不上 Studio') });
			else response.destroy();
		});
		request.pipe(upstream);
	}

	/** A WebSocket (the terminal, Vite's line to the page): let through as the Studio's own page's, once the device is known. */
	async #upgrade(request, socket, head) {
		const port = this.target();
		if (!port || !(await this.#device(request))) {
			socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
			return;
		}
		const upstream = connect(port, '127.0.0.1', () => {
			const headers = passedOn(request.headers, port);
			const lines = [`${request.method} ${request.url} HTTP/1.1`, ...Object.entries(headers).flatMap(([name, value]) => [value].flat().map((each) => `${name}: ${each}`))];
			upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
			if (head?.length) upstream.write(head);
			upstream.pipe(socket);
			socket.pipe(upstream);
		});
		const end = () => {
			upstream.destroy();
			socket.destroy();
		};
		// Either end closed (or failed): the other with it.
		for (const side of [upstream, socket]) {
			side.on('error', end);
			side.on('close', end);
		}
	}
}

/** A request's headers as the Studio is to see them: asked of itself (its address, its origin), from another device. */
function passedOn(headers, port) {
	const local = `localhost:${port}`;
	const passed = { ...headers, host: local, 'x-studio-remote': '1' };
	if (passed.origin) passed.origin = `http://${local}`;
	if (passed.referer) passed.referer = passed.referer.replace(/^https?:\/\/[^/]+/u, `http://${local}`);
	// The device's key is this door's, not the Studio's.
	if (passed.cookie) {
		passed.cookie = passed.cookie.split(/;\s*/u).filter((part) => !part.startsWith(`${COOKIE}=`)).join('; ');
		if (!passed.cookie) delete passed.cookie;
	}
	delete passed.authorization;
	return passed;
}

function send(response, status, value) {
	response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
	response.end(JSON.stringify(value));
}
