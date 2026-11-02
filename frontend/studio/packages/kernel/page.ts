import { applyPlugins, Context, pluginProblems } from './index.mjs';

/**
 * The blog's pages: each plugin's page.ts draws what its build.mjs left in
 * the article (a figure it made, data in it). `ctx.page` is the article.
 */
export type ArticlePage = {
	/** The article's name, as in its address. */
	articleSlug: string;
	/** Where a file the article publishes is (its path in the article's folder, e.g. assets/jobs/…/run.json). */
	fileUrl(path: string): string;
	/** What the article keeps of how its blocks are seen (article.views.json: a molecule's camera…), by key. */
	views: Record<string, unknown>;
};

declare module '@deepseek-ai/cordis' {
	interface Context {
		page: ArticlePage;
	}
	interface Events {
		/** Every plugin of the page has started: what one draws may use what the others registered. */
		'page/ready'(): void;
	}
}

/** Starts the page's plugins (modules by path, as import.meta.glob gives them) for this article, with its saved views. */
export async function startPage(modules: Record<string, unknown>, articleSlug: string, views: Record<string, unknown> = {}): Promise<Context> {
	const ctx = new Context();
	const slug = encodeURIComponent(articleSlug);
	ctx.provide('page', {
		articleSlug,
		// Published with the page: /article-assets/<slug>/assets/… (article-assets.mjs).
		fileUrl: (path: string) => `/article-assets/${slug}/${path.split('/').map(encodeURIComponent).join('/')}`,
		views,
	} satisfies ArticlePage);
	const plugins = Object.entries(modules).map(([path, module]) => ({ id: /\/plugins\/([^/]+)\//u.exec(path)?.[1] ?? path, module }));
	for (const problem of pluginProblems(await applyPlugins(ctx, plugins))) console.warn(`[plugins] ${problem}`);
	ctx.emit('page/ready');
	return ctx;
}
