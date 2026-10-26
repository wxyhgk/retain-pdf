import { AsyncLocalStorage } from 'node:async_hooks';

import { matchLocale, setLocaleResolver } from './index.mjs';
import { registerLocales } from './locales/index.mjs';

registerLocales();

/** The language of the request being answered (the page says it: its cookie, studio-locale), for what the server says. */
const requests = new AsyncLocalStorage();
setLocaleResolver(() => requests.getStore());

/** A request's Accept-Language as a list, most wanted first. */
export function askedLocales(header) {
	return String(header ?? '').split(',').map((part) => part.split(';')[0].trim()).filter(Boolean);
}

/** The cookie the page says its language by (every request it makes carries it: fetch, uploads, event streams). */
export const LOCALE_COOKIE = 'studio-locale';

/** Answers `request` (by `answer`) with what the server says in its language: the page's, else its Accept-Language. */
export function inRequestLocale(request, answer) {
	const said = /(?:^|;\s*)studio-locale=([\w-]+)/u.exec(String(request.headers.cookie ?? ''))?.[1];
	return requests.run(matchLocale(said ? [said] : askedLocales(request.headers['accept-language'])), answer);
}
