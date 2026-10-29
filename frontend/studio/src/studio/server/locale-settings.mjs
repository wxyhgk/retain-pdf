import { resolve } from 'node:path';

import { availableLocales, matchLocale, t } from '@blog/i18n/index.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';
import { notesRoot } from './notes-root.mjs';

/** The Studio's settings (out of git): in the notes' folder beside blog/ (notes-root.mjs), or beside the browser tests' copy of it. */
export function studioSettingsFile(projectRoot) {
	return process.env.STUDIO_BLOG_DIR ? resolve(process.env.STUDIO_BLOG_DIR, '.studio-settings.json') : resolve(notesRoot(projectRoot), '.studio-settings.json');
}

/**
 * The language the Studio speaks: `locale` in its settings, one of the languages there are (@blog/i18n), or `system`
 * (the default): the first of the browser's that there is.
 */
export class LocaleSettings {
	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile) {
		this.settingsFile = settingsFile;
	}

	/** What is chosen: a language's id, or `system`. */
	async chosen() {
		const saved = (await readSettings(this.settingsFile)).locale;
		return typeof saved === 'string' && availableLocales().some((entry) => entry.id === saved) ? saved : 'system';
	}

	/** The language spoken, for a browser asking for these (its Accept-Language, in order). */
	async spoken(asked) {
		const chosen = await this.chosen();
		return chosen === 'system' ? matchLocale(asked) : chosen;
	}

	/** What is chosen and what there is to choose from. */
	async shown() {
		return { chosen: await this.chosen(), locales: availableLocales() };
	}

	async set(choice) {
		if (choice !== 'system' && !availableLocales().some((entry) => entry.id === choice)) throw Object.assign(new Error(t('没有这种语言')), { statusCode: 400 });
		await updateSettings(this.settingsFile, (settings) => {
			const { locale: _, ...rest } = settings;
			return choice === 'system' ? rest : { ...rest, locale: choice };
		});
		return this.shown();
	}
}
