import { setLocale } from './index.mjs';
import { registerLocales } from './locales/index.mjs';

/**
 * The page's language, as the server drew it (`<html data-studio-locale>`, the Studio's setting or the browser's):
 * the words from now on, and the cookie each request carries for the server to answer in it.
 */
export function usePageLocale(): string {
	registerLocales();
	const spoken = document.documentElement.dataset.studioLocale || document.documentElement.lang || 'zh-CN';
	setLocale(spoken);
	document.cookie = `studio-locale=${encodeURIComponent(spoken)}; path=/; SameSite=Strict`;
	return spoken;
}
