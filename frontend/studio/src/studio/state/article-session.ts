import { mergeMarkdownBody, parseStudioDocument, replaceStudioDocumentBody, updateStudioFrontmatter } from '../document/index.ts';
import { rewriteMovedReferences } from '../shared/article-references.mjs';
import type { ArticlePayload, ArticleProperties } from '../types.ts';
import { ArticleStore, type ArticleSnapshot } from './article-store.ts';
import { Autosave, type AutosaveOptions, type SaveOutcome } from './autosave.ts';
import { trackWrite, writesSettled } from './writes.ts';

/** Where saving stands, for the status line. */
export type SaveState =
	| { kind: 'loading' }
	| { kind: 'loaded' }
	| { kind: 'dirty' }
	| { kind: 'saving' }
	| { kind: 'saved' }
	| { kind: 'reviewing' }
	| { kind: 'conflict' }
	| { kind: 'failed'; message: string };

export type OpenedArticle = { article: ArticlePayload; properties: ArticleProperties };

type MoleculeViews = ArticlePayload['chemistryViews'];

/** The server, as far as an open article needs it. */
export type SessionApi = {
	getArticle(slug: string): Promise<ArticlePayload>;
	saveArticle(slug: string, source: string, expectedRevision: string): Promise<{ revision: string; problems?: string[] }>;
	saveMoleculeView(
		slug: string,
		key: string,
		format: string,
		view: number[],
		expectedRevision: string,
		display?: unknown,
	): Promise<{ revision: string; chemistryViews: MoleculeViews }>;
	/** Whether this failure means the article changed on disk since it was loaded. */
	isConflict(error: unknown): boolean;
};

/** What the session asks of the page around it. */
export type SessionHost = {
	/**
	 * Shows this Markdown body in the editor and resolves with the Markdown
	 * the editor writes for it. `again` is the open article shown anew, where
	 * the author was reading.
	 */
	mount(article: ArticlePayload, body: string, again: boolean): Promise<string>;
	/**
	 * The body changed on disk to `body`: shows the differences from the body
	 * in the editor, each to accept or reject, and resolves with the Markdown
	 * the editor holds once every one is decided.
	 */
	review(article: ArticlePayload, body: string): Promise<string>;
	/**
	 * Reports, through `editBody`, the edits the editor holds but has not
	 * reported yet: it reports them a moment after the typing, and a save
	 * or the page closing can come sooner.
	 */
	settle(): void;
	/** A yes/no question the author answers before anything is lost. */
	confirm(message: string): boolean;
	toast(message: string): void;
	/** The article in the editor and its properties, once it is there. */
	opened(opened: OpenedArticle): void;
	saveState(state: SaveState): void;
	/** Whether the Markdown is still as it was loaded or saved, byte for byte. */
	roundtrip(exact: boolean): void;
	/** The title as typed, before it is saved. */
	retitled(title: string): void;
	/** These properties are now on disk; `problems` says why the blog could not build them. */
	saved(slug: string, properties: ArticleProperties, problems: string[]): void;
};

const ARTICLE_TEXT_FILES = ['index.md', 'article.views.json'];

/**
 * The article open in the Studio: loading it, taking in the editor's and
 * the property fields' edits, saving them by itself, and settling with
 * changes made to it on disk. It knows no DOM; the page shows what it
 * reports through its host.
 */
export class ArticleSession {
	readonly #store = new ArticleStore();
	readonly #autosave: Autosave;
	readonly #api: SessionApi;
	readonly #host: SessionHost;
	/** Bumped by every load: a load that finds it changed was overtaken. */
	#sequence = 0;
	/** Checks against the disk, one after the other. */
	#diskCheck: Promise<void> = Promise.resolve();
	#properties: ArticleProperties | null = null;
	#propertiesValid = true;
	#state: SaveState['kind'] = 'loading';

	constructor(api: SessionApi, host: SessionHost, autosave: Omit<AutosaveOptions, 'save'> = {}) {
		this.#api = api;
		this.#host = host;
		this.#autosave = new Autosave({ ...autosave, save: () => this.#save() });
	}

	get current(): ArticleSnapshot {
		return this.#store.current;
	}

	get slug(): string | null {
		return this.#store.current.article?.slug ?? null;
	}

	/** The source changed: edited, saved or loaded. */
	subscribe(listener: (snapshot: ArticleSnapshot) => void): () => void {
		return this.#store.subscribe(listener);
	}

	/**
	 * Opens another article, saving this one first. Unless `discard`, the
	 * author is asked before edits that could not be saved are dropped.
	 */
	async open(slug: string, { discard = false } = {}): Promise<void> {
		if (this.slug === slug) return;
		if (!discard && !(await this.saveBeforeLeaving())) return;
		const sequence = ++this.#sequence;
		this.#setState({ kind: 'loading' });
		const article = await this.#api.getArticle(slug);
		if (sequence !== this.#sequence) return;
		await this.#present(article, sequence, false);
	}

	/** The editor's Markdown, after an edit. */
	editBody(markdown: string): void {
		const { article, source } = this.#store.current;
		if (!article) return;
		const merged = mergeMarkdownBody(parseStudioDocument(article.source).body.raw, markdown);
		const next = replaceStudioDocumentBody(parseStudioDocument(source), merged.body);
		this.#store.updateSource(next);
		this.#host.roundtrip(article.source === next);
		this.#noteEdit();
	}

	/** The properties as typed. Why they cannot be saved, or null. */
	editProperties(properties: ArticleProperties): string | null {
		const { article, source } = this.#store.current;
		if (!article) return null;
		try {
			this.#store.updateSource(updateStudioFrontmatter(source, properties));
		} catch (error) {
			this.#propertiesValid = false;
			return error instanceof Error ? error.message : '文章属性无效';
		}
		this.#properties = properties;
		this.#propertiesValid = true;
		this.#host.retitled(properties.title || article.slug);
		this.#noteEdit();
		return null;
	}

	/** Saves now. Whether everything is saved. */
	flush(): Promise<boolean> {
		this.#host.settle();
		return this.#autosave.flush();
	}

	/** Whether there are edits not yet saved, including the ones just typed. */
	hasUnsavedEdits(): boolean {
		this.#host.settle();
		return this.#store.current.dirty;
	}

	/** Before the author leaves this article: saves it, or asks to let the edits go if it cannot. */
	async saveBeforeLeaving(): Promise<boolean> {
		if (!this.hasUnsavedEdits() || (await this.#autosave.flush())) return true;
		return this.#host.confirm('当前文章没能保存，切换后未保存的改动会丢失。确定吗？');
	}

	/** Saves a molecule's view, after the text, on the revision that leaves. */
	async saveView(key: string, format: string, view: number[], display?: unknown): Promise<void> {
		await this.flush();
		const { article, revision } = this.#store.current;
		if (!article) throw new Error('文章尚未载入');
		const result = await trackWrite(() => this.#api.saveMoleculeView(article.slug, key, format, view, revision, display));
		this.#store.updateRevision(result.revision, result.chemistryViews);
	}

	/**
	 * A file the article uses was renamed or moved. When the server rewrote
	 * `index.md` to follow it, or unsaved text names it, the article is shown
	 * again: what was saved as it now is on disk, and unsaved edits kept as
	 * edits, their references pointed at the new name the same way.
	 */
	async fileMoved(from: string, to: string, rewritten: boolean): Promise<void> {
		const current = this.#store.current;
		if (!current.article) return;
		const edited = rewriteMovedReferences(current.source, from, to);
		if (!rewritten && edited.changed === 0) return;
		const properties = this.#properties ?? current.article.properties;
		const sequence = ++this.#sequence;
		const article = await this.#api.getArticle(current.article.slug);
		if (sequence !== this.#sequence) return;
		await this.#present(article, sequence, true, current.dirty ? { source: edited.source, properties } : undefined);
	}

	/** These files of the open article changed on disk (paths in its folder). */
	changedOnDisk(paths: string[]): void {
		const slug = this.slug;
		if (!slug || !paths.some((path) => ARTICLE_TEXT_FILES.includes(path))) return;
		this.#checkDisk(slug);
	}

	/**
	 * Puts a loaded article in the editor. `edited` is unsaved text to keep
	 * instead of what is on disk, with the properties typed for it.
	 */
	async #present(
		article: ArticlePayload,
		sequence: number,
		again: boolean,
		edited?: { source: string; properties: ArticleProperties },
	): Promise<void> {
		const source = edited?.source ?? article.source;
		const properties = edited?.properties ?? article.properties;
		this.#store.load(article);
		this.#store.updateSource(source);
		this.#properties = properties;
		this.#propertiesValid = true;
		this.#autosave.cancel();
		const original = parseStudioDocument(source);
		const markdown = await this.#host.mount(article, original.body.raw, again);
		if (sequence !== this.#sequence) return;
		const normalized = replaceStudioDocumentBody(original, mergeMarkdownBody(original.body.raw, markdown).body);
		this.#host.opened({ article, properties });
		this.#host.roundtrip(source === normalized);
		this.#setState({ kind: 'loaded' });
		this.#noteEdit();
	}

	/** After an edit: unsaved text is saved shortly, by itself. */
	#noteEdit(): void {
		if (this.#store.current.dirty) {
			if (this.#state !== 'saving') this.#setState({ kind: 'dirty' });
			this.#autosave.changed();
		} else if (this.#state === 'dirty') {
			this.#setState({ kind: 'saved' });
		}
	}

	/** One save, as autosave runs it. */
	async #save(): Promise<SaveOutcome> {
		const { article, source, revision, dirty } = this.#store.current;
		if (!article || !dirty) return 'saved';
		if (!this.#propertiesValid) return 'held';
		const properties = this.#properties ?? article.properties;
		this.#setState({ kind: 'saving' });
		try {
			const result = await trackWrite(() => this.#api.saveArticle(article.slug, source, revision));
			if (this.slug !== article.slug) return 'saved';
			this.#store.markSaved(result.revision, source, properties);
			this.#host.saved(article.slug, properties, result.problems ?? []);
			if (this.#store.current.dirty) {
				this.#setState({ kind: 'dirty' });
				return 'more';
			}
			this.#host.roundtrip(true);
			this.#setState({ kind: 'saved' });
			return 'saved';
		} catch (error) {
			if (this.#api.isConflict(error)) {
				this.#setState({ kind: 'conflict' });
				// The author decides between the two versions; saving goes on after.
				this.#checkDisk(article.slug, () => this.#autosave.resume());
				return 'conflict';
			}
			this.#setState({ kind: 'failed', message: error instanceof Error ? error.message : '保存失败' });
			return 'failed';
		}
	}

	#checkDisk(slug: string, then?: () => void): void {
		this.#diskCheck = this.#diskCheck
			.then(() => this.#compareWithDisk(slug))
			.catch(() => {})
			.then(() => then?.());
	}

	/**
	 * The article may have changed on disk. Without unsaved edits, the new
	 * version is the saved one, and the author reviews what changed in the
	 * body: whatever they reject is saved back over it. With unsaved edits,
	 * the author chooses: take the version on disk, or keep their edits,
	 * which saving then writes over it.
	 */
	async #compareWithDisk(slug: string): Promise<void> {
		// The Studio's own writes are not someone else's changes.
		await writesSettled();
		if (this.slug !== slug) return;
		const sequence = this.#sequence;
		const article = await this.#api.getArticle(slug);
		const current = this.#store.current;
		if (sequence !== this.#sequence || this.slug !== slug || article.revision === current.revision) return;
		if (!current.dirty) {
			await this.#review(article, current.source, ++this.#sequence);
			return;
		}
		const title = this.#properties?.title || slug;
		const takeDisk = this.#host.confirm(
			`「${title}」在磁盘上被修改了（可能是终端或其他编辑器）。\n\n`
			+ '确定：载入磁盘上的版本，放弃你没保存的改动\n'
			+ '取消：保留你的改动，保存时覆盖磁盘上的版本',
		);
		if (sequence !== this.#sequence || this.slug !== slug) return;
		if (takeDisk) {
			await this.#present(article, ++this.#sequence, true);
			this.#host.toast('已载入磁盘上的版本');
		} else {
			this.#store.updateRevision(article.revision, article.chemistryViews);
		}
	}

	/** The version on disk becomes the saved one; the editor shows how its body differs. */
	async #review(article: ArticlePayload, shown: string, sequence: number): Promise<void> {
		this.#store.load(article);
		this.#properties = article.properties;
		this.#propertiesValid = true;
		this.#autosave.cancel();
		this.#host.opened({ article, properties: article.properties });
		const body = parseStudioDocument(article.source).body.raw;
		if (body === parseStudioDocument(shown).body.raw) {
			this.#host.toast('文章属性在磁盘上被修改，已更新');
			this.#setState({ kind: 'loaded' });
			return;
		}
		this.#setState({ kind: 'reviewing' });
		const markdown = await this.#host.review(article, body);
		if (sequence !== this.#sequence) return;
		this.#setState({ kind: 'saved' });
		// What was rejected is an edit, saved over the version on disk.
		this.editBody(markdown);
	}

	#setState(state: SaveState): void {
		this.#state = state.kind;
		this.#host.saveState(state);
	}
}
