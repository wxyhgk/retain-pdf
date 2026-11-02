
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';
import { t } from '@blog/i18n/index.mjs';

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

	#read() {
		return readSettings(this.settingsFile);
	}

	/** The plugins turned off, by folder name. */
	async disabled() {
		const list = (await this.#read()).plugins?.disabled;
		return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
	}

	/** Turns a plugin on or off; resolves with the plugins off. */
	async setEnabled(id, enabled) {
		if (typeof id !== 'string' || !/^[\w.-]+$/u.test(id)) throw Object.assign(new Error(t('插件的名字不对')), { statusCode: 400 });
		if (typeof enabled !== 'boolean') throw Object.assign(new Error(t('enabled 要是 true 或 false')), { statusCode: 400 });
		let list = [];
		await updateSettings(this.settingsFile, (settings) => {
			const disabled = new Set(Array.isArray(settings.plugins?.disabled) ? settings.plugins.disabled : []);
			if (enabled) disabled.delete(id);
			else disabled.add(id);
			list = [...disabled].sort();
			return { ...settings, plugins: { ...settings.plugins, disabled: list } };
		});
		return list;
	}
}
