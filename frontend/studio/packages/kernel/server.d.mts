/**
 * `ctx.server`, the Studio's dev server (node.mjs `serverKernel`): what a
 * plugin's server.mjs may know of the Studio and do with its articles.
 */

/** The articles' folders, checked: a plugin never builds a path into them by hand. */
export type StudioFiles = {
	/** The folder of an article (its name checked); it may not exist. */
	articleFolder(slug: string): string;
	/** A path inside `root`; throws (400) if the segments would leave it. */
	inside(root: string, ...segments: string[]): string;
	/** Writes a file whole or not at all (a temporary file renamed over it). */
	writeText(path: string, text: string): Promise<void>;
};

export type StudioServer = {
	/** The project (this repository). */
	projectRoot: string;
	/** The articles' folder (blog/; the browser tests' copy when testing). */
	blogRoot: string;
	/** The Studio's settings (.studio-settings.json, kept out of git): a plugin keeps its own key in it. */
	settingsFile: string;
	/** Where a plugin keeps private state (`.studio-<name>.json`, kept out of git). */
	privateFile(name: string): string;
	/** The browser tests run this server: their own articles, nothing started for nothing. */
	testing: boolean;
	files: StudioFiles;
	/** The server's log. */
	logger: { info(message: string): void; warn(message: string): void };
};

declare module '@deepseek-ai/cordis' {
	interface Context {
		server: StudioServer;
	}
}
