import { t } from '@blog/i18n/index.mjs';
import { mergeMarkdownBody, parseStudioDocument, replaceStudioDocumentBody, updateStudioFrontmatter } from '@blog/document/index.ts';
import { rewriteMovedReferences } from '@blog/markdown/articles/article-references.mjs';
import type { ArticlePayload, ArticleProperties, HistoryReason } from '../types.ts';
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
	| { kind: 'failed'; message: string }
	/** The editor could not show the article; its properties can still be edited. */
	| { kind: 'unshown'; message: string };

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
	/** Keeps a version of the article in its ai/history, to go back to. */
	keepVersion(slug: string, source: string, reason: HistoryReason): Promise<void>;
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
	 * Shows the differences from the body in the editor to `body` (the body
	 * as it is now on disk, or an earlier version's, `from`), each to accept
	 * or reject, and resolves with the Markdown the editor holds once every
	 * one is decided.
	 */
	review(article: ArticlePayload, body: string, from: 'disk' | 'history' | 'ai'): Promise<string>;
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

/** An article's own text (its words, its views), as against its other files. */
export const ARTICLE_TEXT_FILES = ['index.md', 'article.views.json'];

const PROPERTY_NAMES: Record<keyof ArticleProperties, string> = {
	title: t('标题'),
	description: t('简介'),
	pubDate: t('发布日期'),
	tags: t('标签'),
	draft: t('状态'),
	icon: t('图标'),
	cover: t('封面'),
	kind: t('类型'),
	wide: t('全宽'),
	parent: t('上级页面'),
	props: t('数据库里的值'),
	type: t('数据库'),
};

/** A property as it counts: left out, empty and (for `wide`) off are all none. */
function propertyValue(properties: ArticleProperties, key: keyof ArticleProperties): string {
	const value = properties[key];
	const none = value === undefined || value === '' || (key === 'wide' && value === false) || (key === 'props' && Object.keys(value as object).length === 0);
	return JSON.stringify(none ? null : value);
}

/** Which properties differ, by their names on the page: 「标题」「标签」. */
export function changedProperties(before: ArticleProperties, after: ArticleProperties): string[] {
	return (Object.keys(PROPERTY_NAMES) as (keyof ArticleProperties)[])
		// A move in the tree of pages is seen there, not told.
		.filter((key) => key !== 'parent')
		.filter((key) => propertyValue(before, key) !== propertyValue(after, key))
		.map((key) => PROPERTY_NAMES[key]);
}

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
	/**
	 * The open article read again from disk, as it is there now (after a
	 * change the Studio made to it there: 并入上级页面). Unsaved edits are let go.
	 */
	async reload(): Promise<void> {
		const slug = this.slug;
		if (!slug) return;
		const sequence = ++this.#sequence;
		this.#setState({ kind: 'loading' });
		const article = await this.#api.getArticle(slug);
		if (sequence !== this.#sequence) return;
		await this.#present(article, sequence, true);
	}

	async open(slug: string, { discard = false } = {}): Promise<void> {
		if (this.slug === slug) return;
		if (!discard && !(await this.saveBeforeLeaving())) return;
		const sequence = ++this.#sequence;
		this.#setState({ kind: 'loading' });
		let article: ArticlePayload;
		try {
			article = await this.#api.getArticle(slug);
		} catch (error) {
			if (sequence !== this.#sequence) return;
			// The article open before stays open, as it was.
			this.#host.toast(t('打不开「{slug}」：{error}', { slug, error: error instanceof Error ? error.message : String(error) }));
			const { article: open, dirty } = this.#store.current;
			this.#setState(open ? { kind: dirty ? 'dirty' : 'loaded' } : { kind: 'failed', message: t('没有打开文章') });
			return;
		}
		if (sequence !== this.#sequence) return;
		// Typed while the article was on its way: saved before it goes.
		if (!discard && this.hasUnsavedEdits()) await this.#autosave.flush();
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

	/**
	 * The editor drawn again on what it holds: its blocks are others now (a
	 * block's plugin was loaded again). The edits not yet reported are
	 * taken first; nothing is lost, nothing saved.
	 */
	async remount(): Promise<void> {
		const { article } = this.#store.current;
		if (!article) return;
		const sequence = this.#sequence;
		this.#host.settle();
		const body = parseStudioDocument(this.#store.current.source).body.raw;
		try {
			await this.#host.mount(article, body, true);
		} catch (error) {
			if (sequence !== this.#sequence) return;
			this.#setState({ kind: 'unshown', message: t('编辑器没能显示正文：{error}', { error: error instanceof Error ? error.message : String(error) }) });
		}
	}

	/** The properties as typed. Why they cannot be saved, or null. */
	editProperties(properties: ArticleProperties): string | null {
		const { article, source } = this.#store.current;
		if (!article) return null;
		try {
			this.#store.updateSource(updateStudioFrontmatter(source, properties));
		} catch (error) {
			this.#propertiesValid = false;
			return error instanceof Error ? error.message : t('文章属性无效');
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
		return this.#host.confirm(t('当前文章没能保存，切换后未保存的改动会丢失。确定吗？'));
	}

	/** Saves a molecule's view, after the text, on the revision that leaves. */
	async saveView(key: string, format: string, view: number[], display?: unknown): Promise<void> {
		await this.flush();
		const { article, revision } = this.#store.current;
		if (!article) throw new Error(t('文章尚未载入'));
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

	/**
	 * Brings back an earlier version's body: the editor shows how it differs
	 * from what is there now, each difference to take or leave, as a change
	 * on disk is reviewed. What is there now is kept in the history first.
	 */
	async restoreVersion(source: string): Promise<void> {
		this.#host.settle();
		const { article, source: now } = this.#store.current;
		if (!article) return;
		const body = parseStudioDocument(source).body.raw;
		if (body === parseStudioDocument(now).body.raw) {
			this.#host.toast(t('正文和这个版本一样，没有要恢复的'));
			return;
		}
		if (!(await this.#keep(article.slug, [[now, 'before-restore']]))) return;
		const sequence = ++this.#sequence;
		this.#autosave.cancel();
		this.#setState({ kind: 'reviewing' });
		const markdown = await this.#host.review(article, body, 'history');
		if (sequence !== this.#sequence) return;
		this.#setState({ kind: this.#store.current.dirty ? 'dirty' : 'loaded' });
		// What was taken is an edit, saved as any other.
		this.editBody(markdown);
	}

	/**
	 * What the AI in the editor proposes for the body: shown as the differences to take or leave, where they are, as a
	 * change on disk is reviewed; what is taken is an edit, saved as any other.
	 */
	async reviewProposal(body: string): Promise<void> {
		this.#host.settle();
		const { article, source: now } = this.#store.current;
		if (!article) return;
		if (body.trim() === parseStudioDocument(now).body.raw.trim()) {
			this.#host.toast(t('AI 写的和原来一样'));
			return;
		}
		const sequence = ++this.#sequence;
		this.#autosave.cancel();
		this.#setState({ kind: 'reviewing' });
		const markdown = await this.#host.review(article, body, 'ai');
		if (sequence !== this.#sequence) return;
		this.#setState({ kind: this.#store.current.dirty ? 'dirty' : 'loaded' });
		this.editBody(markdown);
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
		// The properties shown are this article's before its body is: what is
		// typed in them belongs to it, even should the body fail to show.
		this.#host.opened({ article, properties });
		const original = parseStudioDocument(source);
		let markdown: string;
		try {
			markdown = await this.#host.mount(article, original.body.raw, again);
		} catch (error) {
			if (sequence !== this.#sequence) return;
			this.#setState({ kind: 'unshown', message: t('编辑器没能显示正文：{error}', { error: error instanceof Error ? error.message : String(error) }) });
			return;
		}
		if (sequence !== this.#sequence) return;
		const normalized = replaceStudioDocumentBody(original, mergeMarkdownBody(original.body.raw, markdown).body);
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
			this.#setState({ kind: 'failed', message: error instanceof Error ? error.message : t('保存失败') });
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
	 * Keeps these versions in the history, each unless it is what is on disk
	 * now (`except`). Whether they all were; the author is told when not.
	 */
	async #keep(slug: string, versions: [string, HistoryReason][], except?: string): Promise<boolean> {
		try {
			for (const [source, reason] of versions) {
				if (source !== except) await this.#api.keepVersion(slug, source, reason);
			}
			return true;
		} catch (error) {
			this.#host.toast(t('没能存下历史版本：{error}', { error: error instanceof Error ? error.message : String(error) }));
			return false;
		}
	}

	/**
	 * The article may have changed on disk (the terminal, an AI, another
	 * editor). The version on disk becomes the saved one, and the author
	 * reviews how the body differs from what the editor shows, unsaved edits
	 * and all: whatever they reject is saved back over it. Nothing is lost
	 * whatever they decide: what was saved before, and edits not yet saved,
	 * are kept in the history first.
	 */
	async #compareWithDisk(slug: string): Promise<void> {
		// The Studio's own writes are not someone else's changes.
		await writesSettled();
		if (this.slug !== slug) return;
		// What was just typed counts as unsaved.
		this.#host.settle();
		const sequence = this.#sequence;
		const article = await this.#api.getArticle(slug);
		const current = this.#store.current;
		if (sequence !== this.#sequence || this.slug !== slug || article.revision === current.revision || !current.article) return;
		const kept: [string, HistoryReason][] = [[current.article.source, 'before-change']];
		if (current.dirty) kept.push([current.source, 'unsaved']);
		await this.#keep(slug, kept, article.source);
		if (sequence !== this.#sequence || this.slug !== slug) return;
		// Not waited for: the author decides when they will, and a later change on disk (an AI writing on) is compared
		// meanwhile, its review taking over this one.
		void this.#review(article, current.source, ++this.#sequence, {
			unsaved: current.dirty && current.source !== article.source,
			// Against what was saved: properties typed and not yet saved are the author's, not the disk's.
			properties: changedProperties(current.article.properties, article.properties),
		});
	}

	/**
	 * The version on disk becomes the saved one; the editor shows how its
	 * body differs from `shown`. The author is told which properties changed
	 * on disk, and that unsaved edits were kept in the history.
	 */
	async #review(article: ArticlePayload, shown: string, sequence: number, told: { unsaved: boolean; properties: string[] }): Promise<void> {
		this.#store.load(article);
		this.#properties = article.properties;
		this.#propertiesValid = true;
		this.#autosave.cancel();
		this.#host.opened({ article, properties: article.properties });
		const notes = [
			...(told.properties.length ? [t('磁盘上改了{properties}', { properties: told.properties.join('、') })] : []),
			...(told.unsaved ? [t('你没保存的版本已存进「历史版本」')] : []),
		];
		if (notes.length) this.#host.toast(notes.join('；'));
		const body = parseStudioDocument(article.source).body.raw;
		if (body === parseStudioDocument(shown).body.raw) {
			this.#setState({ kind: 'loaded' });
			return;
		}
		this.#setState({ kind: 'reviewing' });
		const markdown = await this.#host.review(article, body, 'disk');
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
