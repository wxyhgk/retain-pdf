// What the Studio gives its 小程序 (window.studio): the same list as the skill studio-mini-apps, checked by the
// Studio's tests (src/studio/server/apps/mini-apps.test.mjs) to stay so.

type StudioArticle = { slug: string; title: string; source: string };
type StudioFile = { path: string; kind: string; size: number };
type StudioFetched = { status: number; ok: boolean; headers: Record<string, string>; text: string };
type StudioRun = { state: string; log: string; error?: string };
/** Where a thing of the notes is: the note, the heading it is under, its line (a fence), its path (a file). */
type StudioPlace = { slug: string; title: string; heading: string; line: number | null; path: string | null; modified: number };
type StudioCode = { id: string; kind: 'block' | 'file' | 'plugin' | 'output'; language: string; title: string; text: string; lines: number; modified: number; places: StudioPlace[] };
type StudioRepository = { id: string; name: string; path: string; own: boolean; description: string; branch: string; commit: { hash: string; subject: string; author: string; time: number } | null; changes: number; files: number; languages: Array<{ name: string; share: number }>; remote: string; problem: string };
type StudioPicture = { id: string; url: string; name: string; alt: string; size: number | null; remote: boolean; referenced: boolean; modified: number; places: Array<StudioPlace & { referenced: boolean }> };

interface Studio {
	/** The article open: its folder name, title, and whole index.md. */
	article(): Promise<StudioArticle>;
	/** Puts Markdown into the article where the caret is. */
	insert(markdown: string): Promise<boolean>;
	files: {
		/** The article's files. */
		list(): Promise<StudioFile[]>;
		/** A text file of the article (`assets/opt.log`). */
		read(path: string): Promise<string>;
		/** Writes a text file into the article (replacing one of that name). */
		write(path: string, text: string): Promise<string>;
	};
	/** Asked of the Studio, anywhere (this machine and its network too), not limited as the browser's fetch. */
	fetch(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<StudioFetched>;
	/** Runs a command (no shell) in the background; answered once it is over. */
	run(argv: string[], options?: { inArticle?: boolean }): Promise<StudioRun>;
	/** Says something for a moment at the foot of the Studio. */
	toast(text: string): Promise<boolean>;
	/** A file of the app's own folder, as text. */
	appFile(path: string): Promise<string>;
	storage: {
		get<T = unknown>(key: string): Promise<T | null>;
		set(key: string, value: unknown): Promise<boolean>;
	};
	/** Opens an article, at the first block holding `find` (a line of code, a picture's path) when given. */
	openPage(slug: string, options?: { find?: string }): Promise<boolean>;
	/** What is scattered in all the notes, gathered by the Studio. */
	notes: {
		/** Their code: fences, and the scripts and inputs kept in their folders; the same code once, with each place. */
		code(): Promise<StudioCode[]>;
		/** Their pictures: shown in them (on the web too), or only kept in their folders; the same picture once. */
		images(): Promise<StudioPicture[]>;
		/** Called when a note or its files changed (once for a burst): ask again then. */
		onChange(listener: () => void): void;
	};
	/** 代码仓库: the git repositories on this machine the Studio shows (its own in repos/, and those added). */
	repos: {
		/** Each, the last committed to first: name, description, branch, last commit, changes not committed, languages. */
		list(): Promise<StudioRepository[]>;
		/** Those on this machine not added yet (~/Code… two levels down). */
		found(): Promise<Array<{ path: string; shown: string; name: string }>>;
		/** One on this machine added (a folder in it is enough). */
		add(path: string): Promise<StudioRepository>;
		/** One of the Studio's own made: repos/<name>/, git, a README. */
		create(name: string, description?: string): Promise<StudioRepository>;
		/** One added taken off the list (its folder left as it is). */
		remove(id: string): Promise<boolean>;
		/** A folder of one ('' its top): folders then files, and its README there as HTML. */
		tree(id: string, dir?: string): Promise<{ dir: string; entries: Array<{ name: string; path: string; kind: 'folder' | 'file'; size: number | null }>; readme: { path: string; html: string } | null; truncated: boolean }>;
		/** A file of one: its text and lines highlighted (black and white kinds), or that it is a picture (`raw`), binary or too large. */
		file(id: string, path: string): Promise<{ path: string; size: number; language: string; kind: 'text' | 'picture' | 'binary' | 'large'; text: string; lines: Array<Array<[string, string]>> | null; html: string; raw: string }>;
	};
	/** In a block of an article: its state (the fence's body) and options; null in a window. */
	block: {
		get(): Promise<{ state: string; meta: string } | null>;
		set(state: string): Promise<boolean>;
		picture(data: string, type?: 'image/svg+xml' | 'image/png'): Promise<string>;
	};
	theme: 'light' | 'dark';
	onTheme(listener: (theme: 'light' | 'dark') => void): void;
	/** A color of the notes (`ink`, `muted`, `line`, `soft`, `surface`, `danger`). */
	color(name: string): string;
}

interface Window {
	studio: Studio;
}
