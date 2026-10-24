import { lookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

/**
 * A request the Studio makes for a 小程序 (`studio.fetch`): to the internet
 * only. Never to this machine or its network (the Studio's own API on
 * localhost, a router, Jupyter, Ollama…): every address a name stands for is
 * checked as it is connected to (a name that changes what it points to between
 * a check and the connection gains nothing), and so is every redirect.
 */

const PRIVATE = new BlockList();
for (const [network, prefix] of [
	['0.0.0.0', 8], // this network
	['10.0.0.0', 8],
	['100.64.0.0', 10], // carrier-grade NAT
	['127.0.0.0', 8],
	['169.254.0.0', 16], // link-local (cloud metadata)
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15], // benchmarking
	['224.0.0.0', 4], // multicast
	['240.0.0.0', 4], // reserved, broadcast
]) {
	PRIVATE.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
	['::', 127], // unspecified, loopback
	['64:ff9b::', 96], // IPv4 through NAT64
	['2002::', 16], // 6to4: an IPv4 inside
	['fc00::', 7], // unique local
	['fe80::', 10], // link-local
	['ff00::', 8], // multicast
]) {
	PRIVATE.addSubnet(network, prefix, 'ipv6');
}

/** Whether `address` (an IP) is out on the internet. */
export function isPublicAddress(address) {
	const family = isIP(address);
	if (!family) return false;
	// An IPv4 written as IPv6 (::ffff:7f00:1) is checked by the IPv4 subnets.
	return !PRIVATE.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

function refused(where) {
	return Object.assign(new Error(`小程序不能访问本机或局域网的地址（${where}）`), { statusCode: 403, code: 'STUDIO_PRIVATE_ADDRESS' });
}

const MAX_REDIRECTS = 5;
const TEXT_LIMIT = 20 * 1024 * 1024;

/**
 * Fetches `url` for an app: `{ status, ok, headers, text }`. Redirects are
 * followed (each one checked), up to five; the body is read up to `limit`.
 * @param {{ url: unknown, method?: string, headers?: Record<string, string>, body?: unknown }} asked
 * @param {{ allowed?: (address: string) => boolean, limit?: number, timeout?: number }} [options] `allowed`: tests reach their own servers
 */
export async function publicFetch({ url, method = 'GET', headers = {}, body }, { allowed = isPublicAddress, limit = TEXT_LIMIT, timeout = 60_000 } = {}) {
	let address = new URL(String(url));
	let asked = { method: String(method).toUpperCase(), headers: { ...headers }, body: body === undefined ? undefined : String(body) };
	const signal = AbortSignal.timeout(timeout);
	for (let hop = 0; ; hop += 1) {
		if (!['http:', 'https:'].includes(address.protocol)) throw Object.assign(new Error('只能访问 http 和 https 的地址'), { statusCode: 400 });
		const response = await send(address, asked, { allowed, signal });
		const location = response.headers.location;
		if (response.statusCode >= 300 && response.statusCode < 400 && location) {
			response.resume();
			if (hop >= MAX_REDIRECTS) throw Object.assign(new Error('重定向太多次'), { statusCode: 502 });
			address = new URL(location, address);
			// 301, 302, 303: what was sent is not sent again (as browsers do).
			if (response.statusCode !== 307 && response.statusCode !== 308) asked = { method: asked.method === 'HEAD' ? 'HEAD' : 'GET', headers: withoutBody(asked.headers), body: undefined };
			continue;
		}
		const text = await read(response, limit);
		const status = response.statusCode ?? 0;
		const shown = {};
		for (const [name, value] of Object.entries(response.headers)) shown[name] = Array.isArray(value) ? value.join(', ') : String(value);
		return { status, ok: status >= 200 && status < 300, headers: shown, text };
	}
}

function withoutBody(headers) {
	return Object.fromEntries(Object.entries(headers).filter(([name]) => !/^content-/iu.test(name)));
}

/** One request, to an address `allowed` lets through, whatever the name stands for when connecting. */
function send(address, { method, headers, body }, { allowed, signal }) {
	const host = address.hostname.replace(/^\[|\]$/gu, '');
	// An address written out is connected to as it is, without looking it up.
	if (isIP(host) && !allowed(host)) return Promise.reject(refused(host));
	const checkedLookup = (hostname, options, callback) => {
		lookup(hostname, { ...options, all: true }, (error, addresses) => {
			if (error) return callback(error);
			const blocked = addresses.find((found) => !allowed(found.address));
			if (blocked) return callback(refused(`${hostname} → ${blocked.address}`));
			if (options.all) return callback(null, addresses);
			return callback(null, addresses[0].address, addresses[0].family);
		});
	};
	return new Promise((resolve, reject) => {
		const request = (address.protocol === 'https:' ? httpsRequest : httpRequest)(
			address,
			{ method, headers: { 'accept-encoding': 'gzip, deflate, br', ...headers }, lookup: checkedLookup, signal },
			resolve,
		);
		request.on('error', (error) => reject(error?.code === 'STUDIO_PRIVATE_ADDRESS' ? error : Object.assign(new Error(`请求失败：${error.message}`), { statusCode: 502 })));
		request.end(body);
	});
}

/** The body as text, unpacked, up to `limit` bytes (more: refused, not cut). */
function read(response, limit) {
	const encoding = String(response.headers['content-encoding'] ?? '').trim().toLowerCase();
	const unpack = { gzip: createGunzip, 'x-gzip': createGunzip, deflate: createInflate, br: createBrotliDecompress }[encoding];
	const stream = unpack ? response.pipe(unpack()) : response;
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		stream.on('data', (chunk) => {
			size += chunk.length;
			if (size > limit) {
				response.destroy();
				stream.destroy();
				reject(Object.assign(new Error(`返回的内容超过 ${Math.round(limit / 1024 / 1024)} MB`), { statusCode: 502 }));
				return;
			}
			chunks.push(chunk);
		});
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		stream.on('error', (error) => reject(Object.assign(new Error(`读取返回内容失败：${error.message}`), { statusCode: 502 })));
	});
}
