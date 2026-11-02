/**
 * The Studio's words in the language chosen, as gettext has it: what is written in the code is the Chinese itself,
 * `t('已移动到 {path}', { path })`, and a language is a catalog from those words to its own (locales/<id>.json).
 * Chinese is the source: it needs no catalog. Works the same in the page and on the server; the server says, per
 * request, which language that is (server.mjs).
 */

/** The language the words are written in. */
export const SOURCE_LOCALE = 'zh-CN';

/** The languages there are, by id, with the name each is shown by (in itself). */
const locales = new Map([[SOURCE_LOCALE, { name: '中文', messages: /** @type {Record<string, string>} */ ({}) }]]);

let current = SOURCE_LOCALE;
/** @type {(() => string | undefined) | null} */
let resolver = null;

/** A language: its catalog, from the Chinese of the code to its words (a word missing there stays Chinese). */
export function registerLocale(id, name, messages) {
	locales.set(id, { name, messages });
}

/** The languages there are, to choose from. */
export function availableLocales() {
	return [...locales].map(([id, { name }]) => ({ id, name }));
}

/** The language of the words from now on (the page's). */
export function setLocale(id) {
	current = locales.has(id) ? id : SOURCE_LOCALE;
}

/** Where the language is found at each call (the server's: the request's); none, the one set. */
export function setLocaleResolver(find) {
	resolver = find;
}

/** The language the words are given in now. */
export function locale() {
	const found = resolver?.();
	return found && locales.has(found) ? found : current;
}

/**
 * Of the languages asked for, in order (a browser's `navigator.languages`, a request's Accept-Language), the first
 * there is: by its whole id, else by its language alone (en-GB finds en); none, Chinese.
 */
export function matchLocale(wanted) {
	const ids = [...locales.keys()];
	for (const asked of wanted) {
		const lower = String(asked).toLowerCase();
		const whole = ids.find((id) => id.toLowerCase() === lower);
		if (whole) return whole;
		const language = ids.find((id) => id.toLowerCase().split('-')[0] === lower.split('-')[0]);
		if (language) return language;
	}
	return SOURCE_LOCALE;
}

/**
 * `source` (the Chinese written in the code) in the language now, its `{name}`s given by `params`; a `{name}` not in
 * `params` (a command's `{prompt}`) is left as it is.
 */
export function t(source, params) {
	const text = locales.get(locale())?.messages[source] || source;
	if (!params) return text;
	return text.replace(/\{(\w+)\}/gu, (whole, name) => (Object.hasOwn(params, name) ? String(params[name]) : whole));
}
