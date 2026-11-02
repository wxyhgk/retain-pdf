import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';

import { appDocument } from './mini-apps.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * A project app's pages, from its own development server (project-apps.mjs) at the Studio's address
 * (`/studio-apps/<id>/…`, its base, so nothing is rewritten): what it answers, as it answers it, its pages with
 * `studio` and the notes' colors first in their head; and its development server's live line (HMR's websocket), passed
 * through both ways.
 */

/** Passes `request` to the app's server at `port`, its answer back to `response`. */
export function proxyToApp(request, response, port) {
	const headers = { ...request.headers, host: `localhost:${port}` };
	// Pages are read to be added to: not compressed.
	delete headers['accept-encoding'];
	const upstream = httpRequest({ host: 'localhost', port, method: request.method, path: request.url, headers }, (answer) => {
		const type = String(answer.headers['content-type'] ?? '');
		if (!type.includes('text/html')) {
			response.writeHead(answer.statusCode ?? 502, answer.headers);
			answer.pipe(response);
			return;
		}
		const chunks = [];
		answer.on('data', (chunk) => chunks.push(chunk));
		answer.on('end', () => {
			const body = Buffer.from(appDocument(Buffer.concat(chunks).toString('utf8'), { project: true }));
			const { 'content-length': _length, ...kept } = answer.headers;
			response.writeHead(answer.statusCode ?? 200, { ...kept, 'content-length': body.length, 'cache-control': 'no-store' });
			response.end(body);
		});
		answer.on('error', () => response.destroy());
	});
	upstream.on('error', (error) => {
		if (response.headersSent) return response.destroy();
		response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
		response.end(t('连不上这个应用的开发服务器：{error}', { error: error.message }));
	});
	request.pipe(upstream);
}

/** Passes a websocket's opening (`upgrade`) to the app's server at `port`, then everything both ways. */
export function forwardUpgrade(request, socket, head, port) {
	const upstream = connect({ host: 'localhost', port }, () => {
		const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
		for (let index = 0; index < request.rawHeaders.length; index += 2) {
			const name = request.rawHeaders[index];
			lines.push(`${name}: ${name.toLowerCase() === 'host' ? `localhost:${port}` : request.rawHeaders[index + 1]}`);
		}
		upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
		if (head?.length) upstream.write(head);
		socket.pipe(upstream).pipe(socket);
	});
	const close = () => {
		upstream.destroy();
		socket.destroy();
	};
	upstream.on('error', close);
	socket.on('error', close);
	upstream.on('close', () => socket.destroy());
	socket.on('close', () => upstream.destroy());
}
