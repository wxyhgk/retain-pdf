import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/** This machine's own settings of the Studio's code (out of git): where the notes are. */
export const LOCAL_FILE = '.studio-local.json';

/**
 * Where the author's notes are, the Studio's code being elsewhere: their articles (blog/), 小程序 (apps/), chats/,
 * repos/, page templates (templates/), the trash, the Studio's settings and its private files. Said by
 * STUDIO_NOTES_DIR, else by `notes` in the code's .studio-local.json (`{ "notes": "../my-notes" }`, a path from the
 * code's folder or a whole one), else the code's own folder (notes and code in one repository, as they once were).
 * @param {string} codeRoot the Studio's code (where package.json is)
 */
export function notesRoot(codeRoot) {
	if (process.env.STUDIO_NOTES_DIR) return resolve(process.env.STUDIO_NOTES_DIR);
	try {
		const { notes } = JSON.parse(readFileSync(resolve(codeRoot, LOCAL_FILE), 'utf8'));
		if (typeof notes === 'string' && notes.trim()) return isAbsolute(notes) ? notes : resolve(codeRoot, notes);
	} catch {
		// None, or not readable: the code's own folder.
	}
	return resolve(codeRoot);
}
