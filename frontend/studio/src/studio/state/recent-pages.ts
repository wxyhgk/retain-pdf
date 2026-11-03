// The pages opened last on this machine, the latest first: what @ in the AI panel offers first (as Notion's 最近).
const RECENT_KEY = 'studio.recentPages';
const KEPT = 30;

export function recentPages(): string[] {
	try {
		const kept: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
		return Array.isArray(kept) ? kept.filter((slug): slug is string => typeof slug === 'string' && !!slug) : [];
	} catch {
		return [];
	}
}

/** `slug` opened: first now. */
export function rememberRecent(slug: string): void {
	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify([slug, ...recentPages().filter((kept) => kept !== slug)].slice(0, KEPT)));
	} catch {
		// Storage refused (a private window): @ offers the pages changed last instead.
	}
}
