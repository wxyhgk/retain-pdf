/**
 * 常用: the pages starred (☆ in the bar, in a page's menu), shown at the top of the left column. Kept on this machine
 * (the page's storage), not in the articles: a matter of how the author works, not of what they write.
 */

const KEY = 'studio.favorites';

/** The pages starred, in the order they were. */
export function favoriteSlugs(): string[] {
	try {
		const kept = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
		return Array.isArray(kept) ? kept.filter((slug): slug is string => typeof slug === 'string') : [];
	} catch {
		return [];
	}
}

function keep(slugs: string[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(slugs));
	} catch {
		// Storage refused (a private window): starred for this visit only.
	}
}

/** Starred, or no longer: the pages starred now. */
export function toggleFavorite(slug: string): string[] {
	const now = favoriteSlugs();
	const next = now.includes(slug) ? now.filter((entry) => entry !== slug) : [...now, slug];
	keep(next);
	return next;
}

/** A page renamed (its folder): still starred, by its new name. */
export function renameFavorite(from: string, to: string): void {
	const now = favoriteSlugs();
	if (now.includes(from)) keep(now.map((slug) => (slug === from ? to : slug)));
}
