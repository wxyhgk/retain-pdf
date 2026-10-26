/**
 * Astro reloads every open page when a file of a content collection changes,
 * and the articles in blog/ are one. The Studio writes those files all the
 * time (it saves by itself) and follows changes on disk on its own, so it
 * must not be reloaded by them. Here such reloads are marked
 * `studioContentChange`, for the Studio page to let pass; the blog's own
 * pages still reload as before.
 *
 * Astro tells its server side `astro:content-changed` and, in the same tick,
 * sends the browsers a `full-reload`: that is the reload marked.
 */
export function markContentReloads(server) {
	const ssr = server.environments?.ssr?.hot;
	const client = server.environments?.client?.hot;
	if (!ssr || !client) return;
	let contentChanged = false;
	const sendToServer = ssr.send.bind(ssr);
	ssr.send = (...args) => {
		if (args[0] === 'astro:content-changed') {
			contentChanged = true;
			queueMicrotask(() => { contentChanged = false; });
		}
		return sendToServer(...args);
	};
	const sendToBrowsers = client.send.bind(client);
	client.send = (...args) => {
		const [payload] = args;
		if (contentChanged && payload?.type === 'full-reload') {
			contentChanged = false;
			return sendToBrowsers({ ...payload, studioContentChange: true }, ...args.slice(1));
		}
		return sendToBrowsers(...args);
	};
}
