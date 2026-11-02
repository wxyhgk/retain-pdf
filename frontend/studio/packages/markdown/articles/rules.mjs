/**
 * What makes an article an article, in one place: its folder's name, its
 * folders, which of them are published with it, and its address on the
 * blog. The blog's build, the Studio's server and the Studio's page all
 * follow these; change one here and they change together.
 */

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

/** An article's folder name (its slug): lower-case letters and digits, joined by single hyphens. */
export const SLUG_PATTERN = new RegExp(`^${SLUG}$`, 'u');

/** The folders an article keeps its files in. */
export const ARTICLE_FOLDERS = Object.freeze(['img', 'assets', 'ai']);

/** The ones published with it (`ai/` stays private). */
export const PUBLISHED_FOLDERS = Object.freeze(['img', 'assets']);

/**
 * Files kept on the author's machine only, wherever they are in the article: videos (too big for
 * git). The Studio shows and plays them; git ignores them (.gitignore) and the build publishes
 * nothing of them (a ```video block shows its cover instead).
 */
export const LOCAL_ONLY_EXTENSIONS = Object.freeze(['mp4', 'm4v', 'mov', 'webm', 'mkv']);

/** Whether a file of an article (`assets/run.mp4`) stays on this machine only. */
export function isLocalOnly(path) {
	const match = /\.([^./]+)$/u.exec(String(path ?? ''));
	return Boolean(match && LOCAL_ONLY_EXTENSIONS.includes(match[1].toLowerCase()));
}

/** An address of one of the blog's articles: `/blog/<slug>/`, `/wiki/<slug>/#eq-1`; [1] is `blog` or `wiki`, [2] the slug. */
export const ARTICLE_ADDRESS = new RegExp(`^/(blog|wiki)/(${SLUG})/?(?:[#?].*)?$`, 'u');

/** Where an article is on the blog: `/wiki/<slug>/` for a wiki page, `/blog/<slug>/` for the rest. */
export function articleAddress(kind, slug) {
	return `/${kind === 'wiki' ? 'wiki' : 'blog'}/${slug}/`;
}
