import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Which of the project's plugins are turned off in the Studio (插件, in
 * its sidebar): `plugins.disabled` in the Studio's settings, kept out of
 * git. Off, a plugin's studio.ts and server.mjs are not applied; the
 * blog's build and its pages use every plugin all the same.
 */
export class PluginSettings {
	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile) {
		this.settingsFile = settingsFile;
	}

	async #read() {
		try {
			return JSON.parse(await readFile(this.settingsFile, 'utf8'));
		} catch {
			return {};
		}
	}

	/** The plugins turned off, by folder name. */
	async disabled() {
		const list = (await this.#read()).plugins?.disabled;
		return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
	}

	/** Turns a plugin on or off; resolves with the plugins off. */
	async setEnabled(id, enabled) {
		if (typeof id !== 'string' || !/^[\w.-]+$/u.test(id)) throw Object.assign(new Error('插件的名字不对'), { statusCode: 400 });
		if (typeof enabled !== 'boolean') throw Object.assign(new Error('enabled 要是 true 或 false'), { statusCode: 400 });
		const settings = await this.#read();
		const disabled = new Set(Array.isArray(settings.plugins?.disabled) ? settings.plugins.disabled : []);
		if (enabled) disabled.delete(id);
		else disabled.add(id);
		const list = [...disabled].sort();
		await mkdir(dirname(this.settingsFile), { recursive: true });
		await writeFile(this.settingsFile, `${JSON.stringify({ ...settings, plugins: { ...settings.plugins, disabled: list } }, null, '\t')}\n`);
		return list;
	}
}
