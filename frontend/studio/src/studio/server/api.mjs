import { pipeline } from 'node:stream/promises';
import { inRequestLocale } from '@blog/i18n/server.mjs';
import { StudioPathError } from '../../articles/bundle-paths.mjs';

/**
 * The Studio's API, `/api/studio/…`: each part of the Studio registers its
 * routes (server/routes/), and every request is checked here, once, before
 * any of them runs:
 * - from this machine;
 * - from the Studio's own pages (`fromStudio`);
 * - a change (POST, PUT) declares its body's type, JSON unless the route says
 *   it takes a file (`body: 'application/octet-stream'`). A page elsewhere
 *   can post a form to localhost, but cannot set these types without the
 *   browser asking first.
 * A route answers with what its handler returns, as JSON (`reply(status, …)`
 * for another status than 200); an error's `statusCode` (500 when it has
 * none) and message become the answer instead. A handler with `streams` writes
 * the answer itself (a file, events).
 *
 *     api.get('/articles/:slug', ({ params }) => articles.read(params.slug));
 *     api.post('/articles/:slug/files', upload, { body: 'application/octet-stream' });
 *
 * Paths are matched as the browser sent them (a `..` is not resolved away);
 * `:name` takes one segment, `*name` the rest; both come decoded.
 */
export class StudioApi {
	/** @type {Array<{ method: string, pattern: RegExp, names: string[], handler: Function, body: string, streams: boolean }>} */
	#routes = [];

	/**
	 * @param {string} method
	 * @param {string} path under /api/studio
	 * @param {(context: ApiContext) => unknown} handler
	 * @param {{ body?: string, streams?: boolean }} [options]
	 */
	route(method, path, handler, { body = 'application/json', streams = false } = {}) {
		const names = [];
		const pattern = new RegExp(`^${path.replace(/[.]/gu, '\\.').replace(/([:*])(\w+)/gu, (_, kind, name) => {
			names.push(name);
			return kind === ':' ? '([^/]+)' : '(.+)';
		})}$`, 'u');
		this.#routes.push({ method, pattern, names, handler, body, streams });
	}

	get(path, handler, options) {
		this.route('GET', path, handler, options);
	}

	post(path, handler, options) {
		this.route('POST', path, handler, options);
	}

	put(path, handler, options) {
		this.route('PUT', path, handler, options);
	}

	delete(path, handler, options) {
		this.route('DELETE', path, handler, options);
	}

	/** Answers `request` if it is to the API (true), after the checks; false for any other address. */
	async handle(request, response) {
		const raw = (request.url ?? '/').split('?', 1)[0];
		if (!raw.startsWith('/api/studio/')) return false;
		// What is said back (errors, notes) in the page's language.
		await inRequestLocale(request, () => this.#answer(request, response, raw));
		return true;
	}

	async #answer(request, response, raw) {
		const remoteAddress = request.socket.remoteAddress ?? '';
		const isLoopback = remoteAddress === '::1' || remoteAddress === '127.0.0.1' || remoteAddress.startsWith('::ffff:127.');
		try {
			if (!isLoopback) throw refuse(403, 'Studio 只允许本机访问');
			if (!fromStudio(request)) throw refuse(403, '只有 Studio 自己的页面能访问 Studio 的接口');
			const path = raw.slice('/api/studio'.length);
			const method = request.method ?? 'GET';
			const found = this.#match(method, path);
			if (!found) throw refuse(404, 'Studio API 不存在');
			const { route, params } = found;
			if (method === 'POST' || method === 'PUT') assertContentType(request, route.body);
			const answer = await route.handler({
				params,
				query: new URL(request.url ?? '/', 'http://localhost').searchParams,
				path,
				request,
				response,
				json: () => readJson(request),
			});
			if (route.streams) return true;
			const { status, value } = readReply(answer);
			sendJson(response, status, value);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Studio 操作失败';
			const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
			sendJson(response, status, { error: message });
		}
	}

	#match(method, path) {
		for (const route of this.#routes) {
			if (route.method !== method) continue;
			const found = route.pattern.exec(path);
			if (!found) continue;
			const params = {};
			route.names.forEach((name, index) => {
				params[name] = decodePathComponent(found[index + 1]);
			});
			return { route, params };
		}
		return null;
	}
}

/**
 * @typedef {object} ApiContext
 * @property {Record<string, string>} params the path's named segments, decoded
 * @property {URLSearchParams} query
 * @property {string} path the path under /api/studio, as sent
 * @property {import('node:http').IncomingMessage} request
 * @property {import('node:http').ServerResponse} response
 * @property {() => Promise<any>} json the body, read as JSON (up to 5 MB)
 */

const REPLY = Symbol('studio.reply');

/** An answer with another status than 200 (201 made, 202 begun, 404…). */
export function reply(status, value) {
	return { [REPLY]: status, value };
}

/** An error the API answers with `status`. */
export function refuse(status, message) {
	return Object.assign(new Error(message), { statusCode: status });
}

function readReply(answer) {
	return answer && typeof answer === 'object' && REPLY in answer ? { status: answer[REPLY], value: answer.value } : { status: 200, value: answer };
}

export function sendJson(response, status, data) {
	// A file was being sent when it failed (the page went away): nothing more can be said.
	if (response.headersSent) {
		response.destroy?.();
		return;
	}
	response.statusCode = status;
	response.setHeader('Content-Type', 'application/json; charset=utf-8');
	response.setHeader('Cache-Control', 'no-store');
	response.end(JSON.stringify(data));
}

async function readJson(request) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > 5 * 1024 * 1024) throw new Error('请求内容超过 5 MB');
		chunks.push(chunk);
	}
	return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function assertContentType(request, expected) {
	const type = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
	if (type !== expected) throw refuse(415, `请求类型必须是 ${expected}`);
}

export function decodePathComponent(component) {
	try {
		return decodeURIComponent(component);
	} catch {
		throw new StudioPathError('资源 URL 编码无效');
	}
}

/**
 * Whether a request to the API comes from the Studio's own pages. Its `Origin`, if it has one, is this server's
 * (scheme, host, port: the Host it was asked by, which Vite has checked), so a page of another local server (another
 * port) is refused; and the browser does not say it came from another site (`Sec-Fetch-Site`, which comes with
 * requests that have no Origin, an image's say). Programs on this machine (no Origin) are let through: they could
 * read the files anyway, and what the Studio itself fetches for an app never reaches here (mini-apps.mjs).
 */
function fromStudio(request) {
	const origin = request.headers.origin;
	const host = request.headers.host;
	if (origin !== undefined && origin !== `http://${host}` && origin !== `https://${host}`) return false;
	const site = request.headers['sec-fetch-site'];
	return site === undefined || site === 'same-origin' || site === 'none';
}

/** Streams a file (of an article, of the drive): a log of hundreds of megabytes is served like a picture. */
export async function sendFile(response, resource) {
	// Asked in part (a video's player seeking; WebKit plays nothing it cannot ask in part): those bytes.
	response.setHeader('Accept-Ranges', 'bytes');
	if (resource.range === 'unsatisfiable') {
		response.statusCode = 416;
		response.setHeader('Content-Range', `bytes */${resource.size}`);
		response.end();
		return;
	}
	const { range } = resource;
	response.statusCode = range ? 206 : 200;
	response.setHeader('Content-Type', resource.contentType);
	response.setHeader('Content-Length', range ? range.end - range.start + 1 : resource.size);
	if (range) response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${resource.size}`);
	response.setHeader('Cache-Control', 'no-store');
	response.setHeader('X-Content-Type-Options', 'nosniff');
	// Chrome's PDF viewer does not open in a sandboxed page; a PDF is not a page that could run the Studio's API.
	if (!String(resource.contentType).startsWith('application/pdf')) response.setHeader('Content-Security-Policy', 'sandbox');
	await pipeline(resource.body, response);
}

/** Server-sent events to `response` until the page goes away: `subscribe(send)` returns how to stop. */
export function sendEvents(request, response, subscribe) {
	response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
	response.write('retry: 2000\n\n');
	const stop = subscribe((data) => response.write(`data: ${JSON.stringify(data)}\n\n`));
	// A comment now and then keeps the connection from looking idle.
	const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 25_000);
	request.on('close', () => {
		clearInterval(keepAlive);
		stop();
	});
}
