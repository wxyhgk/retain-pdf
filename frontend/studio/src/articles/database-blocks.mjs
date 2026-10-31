/**
 * The Studio's 数据库, as Notion's: a database is a page of its own (`type: database` among its properties), the pages
 * under it its rows. What columns it has and how it is shown are a ```database block in it, its definition (its
 * columns in its JSON). Any other page shows it with a ```database block that only names it — `{"source": "<its
 * folder>"}` — as many pages as like, the rows the same everywhere. A block from before databases were pages (its
 * columns in it, in an ordinary page, its rows the pages under that page saying its `id`) is made one when it is met
 * (Databases.detach), the block then naming it.
 */

const FENCES = /^(```+|~~~+)[ \t]*database[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/gmu;

/** What the id of a block from before may be: a few letters and digits (a database made from one keeps it). */
export const DATABASE_ID = /^[a-z0-9]{4,16}$/u;

/** A new id: 8 letters and digits. */
export function newDatabaseId() {
	return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => 'abcdefghijklmnopqrstuvwxyz0123456789'[byte % 36]).join('');
}

/** A block's JSON as far as it reads (`{}` when it does not). */
export function settingsOf(text) {
	try {
		const parsed = JSON.parse(text || '{}');
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/** The database a block's text names (its folder), or null: the block is a definition. */
export function sourceOf(text) {
	const { source } = settingsOf(text);
	return typeof source === 'string' && source.trim() ? source.trim() : null;
}

/** A block's text that shows the database `slug`. */
export function referenceText(slug) {
	return JSON.stringify({ source: slug });
}

/**
 * The page's database blocks, in order: the database each names (null: a definition), its id (one from before), its
 * title (one from before), its text.
 * @param {string} source
 * @returns {Array<{ source: string | null, id: string | null, title: string, text: string }>}
 */
export function databaseBlocks(source) {
	return [...String(source ?? '').matchAll(FENCES)].map((match) => {
		const settings = settingsOf(match[2]);
		return {
			source: sourceOf(match[2]),
			id: typeof settings.id === 'string' && DATABASE_ID.test(settings.id) ? settings.id : null,
			title: typeof settings.title === 'string' ? settings.title : '',
			text: match[2],
		};
	});
}

/** A database page's definition (its first block naming none), or null. */
export function definitionText(source) {
	return databaseBlocks(source).find((block) => !block.source)?.text ?? null;
}

/**
 * The page with each database block's text as `change` gives it (its text, its place among the page's blocks;
 * undefined: as it is).
 * @param {string} source
 * @param {(text: string, at: number) => string | undefined} change
 */
export function mapDatabaseBlocks(source, change) {
	let at = -1;
	return String(source).replace(FENCES, (whole, fence, inner) => {
		at += 1;
		const next = change(inner, at);
		return next === undefined ? whole : `${fence}database\n${next}\n${fence}`;
	});
}

/** A database page with its definition written anew (put at the end of its text when it has none). */
export function withDefinitionText(source, text) {
	let found = false;
	const next = mapDatabaseBlocks(source, (inner) => {
		if (found || sourceOf(inner)) return undefined;
		found = true;
		return text;
	});
	return found ? next : `${next.replace(/\s*$/u, '')}\n\n\`\`\`database\n${text}\n\`\`\`\n`;
}

/** The page with its blocks that name the database `from` naming `to` (its folder renamed). */
export function relinkDatabases(source, from, to) {
	return mapDatabaseBlocks(source, (inner) => (sourceOf(inner) === from ? JSON.stringify({ ...settingsOf(inner), source: to }) : undefined));
}
