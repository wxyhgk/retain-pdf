/**
 * A page's ```database blocks (the Studio's 数据库), as text: each has an `id` in its JSON, and the pages that are its
 * rows say it (`database: <id>` among their properties), so a page may hold several, and pages under it that are not
 * rows of one stay pages. A block from before ids (none in its JSON) is the page's first; its rows the pages under the
 * page that name no database (the Studio gives it an id, and them, when it is shown: Databases.adopt).
 */

const FENCES = /^(```+|~~~+)[ \t]*database[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/gmu;

/** What an id may be: a few letters and digits. */
export const DATABASE_ID = /^[a-z0-9]{4,16}$/u;

/** A new id for a database: 8 letters and digits. */
export function newDatabaseId() {
	return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => 'abcdefghijklmnopqrstuvwxyz0123456789'[byte % 36]).join('');
}

/** A block's JSON as far as it reads (`{}` when it does not). */
function settingsOf(text) {
	try {
		const parsed = JSON.parse(text || '{}');
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * The page's database blocks, in order: each its id (null for one from before ids), its title, its text.
 * @param {string} source
 * @returns {Array<{ id: string | null, title: string, text: string }>}
 */
export function databaseBlocks(source) {
	return [...String(source ?? '').matchAll(FENCES)].map((match) => {
		const settings = settingsOf(match[2]);
		return { id: typeof settings.id === 'string' && DATABASE_ID.test(settings.id) ? settings.id : null, title: typeof settings.title === 'string' ? settings.title : '', text: match[2] };
	});
}

/**
 * The block whose id is `id` (null: the first, of one from before ids); its text, or null when there is none.
 * @param {string} source
 * @param {string | null} [id]
 * @returns {string | null}
 */
export function databaseText(source, id = null) {
	const blocks = databaseBlocks(source);
	const block = id ? blocks.find((each) => each.id === id) : blocks.find((each) => !each.id);
	return block?.text ?? null;
}

/**
 * The page with that block's text written anew (as it was when there is none).
 * @param {string} source
 * @param {string | null} id
 * @param {string} text
 */
export function withDatabaseText(source, id, text) {
	let found = false;
	return String(source).replace(FENCES, (whole, fence, inner) => {
		if (found) return whole;
		const ownId = settingsOf(inner).id;
		const mine = id ? ownId === id : !(typeof ownId === 'string' && DATABASE_ID.test(ownId));
		if (!mine) return whole;
		found = true;
		return `${fence}database\n${text}\n${fence}`;
	});
}
