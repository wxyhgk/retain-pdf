import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { t } from '@blog/i18n/index.mjs';

/**
 * The Studio's settings file (.studio-settings.json, out of git): each part of
 * the Studio keeps its own key in it (the drive's folder, the AI's key, the
 * compute machines, the plugins turned off, the agents). Changed one change at
 * a time (a queue per file), each change a whole new file put in place of the
 * old (never a half-written one to read), readable by the author alone (it
 * holds keys). A file that is there but cannot be read is not written over:
 * that would forget every other part's settings.
 */

const queues = new Map();

export class SettingsFileError extends Error {
	constructor(message) {
		super(message);
		this.name = 'SettingsFileError';
		this.statusCode = 500;
	}
}

/**
 * What the file holds; `{}` when there is no file. A file that cannot be read
 * is `{}` too, unless `strict` (then it throws).
 */
export async function readSettings(file, { strict = false } = {}) {
	let text;
	try {
		text = await readFile(file, 'utf8');
	} catch (error) {
		if (error?.code === 'ENOENT') return {};
		if (strict) throw error;
		return {};
	}
	try {
		const settings = JSON.parse(text);
		if (settings && typeof settings === 'object' && !Array.isArray(settings)) return settings;
	} catch {
		// Below.
	}
	if (strict) throw new SettingsFileError(t('设置文件 {file} 不是有效的 JSON，没有改动它；修好或删掉它再试', { file }));
	return {};
}

/**
 * Changes the settings: `change` is given what the file holds now and returns
 * (or changes in place) what it is to hold. Changes to one file wait for one
 * another. Resolves with what was written.
 * @param {string} file
 * @param {(settings: Record<string, unknown>) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>} change
 */
export function updateSettings(file, change) {
	const before = queues.get(file) ?? Promise.resolve();
	const done = before.catch(() => {}).then(async () => {
		const settings = await readSettings(file, { strict: true });
		const next = (await change(settings)) ?? settings;
		await mkdir(dirname(file), { recursive: true });
		const temporary = `${file}.${randomUUID()}.tmp`;
		try {
			await writeFile(temporary, `${JSON.stringify(next, null, '\t')}\n`, { mode: 0o600 });
			await rename(temporary, file);
		} catch (error) {
			await rm(temporary, { force: true }).catch(() => {});
			throw error;
		}
		return next;
	});
	queues.set(file, done);
	// The queue forgets a file once nothing waits on it.
	void done.finally(() => queues.get(file) === done && queues.delete(file)).catch(() => {});
	return done;
}
