import { registerLocale } from '../index.mjs';

/**
 * The languages besides Chinese (the source, which needs no catalog): each a catalog in this folder, from the Chinese
 * of the code to its own words, registered here. `npm run i18n:strings` lists what there is to translate.
 *
 *     import en from './en.json' with { type: 'json' };
 *     registerLocale('en', 'English', en);
 */
export function registerLocales() {
	void registerLocale;
}
