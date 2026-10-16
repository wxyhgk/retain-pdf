import { ArticleConflictError } from './article-repository.mjs';
import { moveMoleculeViews } from './article-views.mjs';
import { managedSegments } from './file-manager.mjs';
import { rewriteMovedReferences } from '../shared/article-references.mjs';

/**
 * File changes that the article's text has to follow. Moving a file the
 * article refers to rewrites those references in `index.md` and carries the
 * saved 3D views of its `@file` blocks over, so the article never points at
 * a name that is gone.
 */
export class ArticleFiles {
	/**
	 * @param {import('./article-repository.mjs').ArticleRepository} articles
	 * @param {import('./file-manager.mjs').ArticleFileManager} manager
	 */
	constructor(articles, manager) {
		this.articles = articles;
		this.manager = manager;
	}

	/**
	 * Moves `from` to `to`. When the article refers to what moves, the editor
	 * must have the article as it is on disk (`expectedRevision`), so unsaved
	 * edits are never overwritten; a move nothing refers to needs no check.
	 */
	move(slug, from, to, options) {
		return this.articles.exclusive(slug, () => this.#move(slug, from, to, options));
	}

	async #move(slug, from, to, { expectedRevision } = {}) {
		const source = managedSegments(from).join('/');
		const target = managedSegments(to).join('/');
		const snapshot = await this.articles.snapshot(slug);
		const rewritten = rewriteMovedReferences(snapshot.source, source, target);
		if (rewritten.changed === 0) {
			const moved = await this.manager.move(slug, source, target);
			return { ...moved, revision: snapshot.revision, references: 0, views: 0 };
		}
		if (expectedRevision !== snapshot.revision) {
			throw new ArticleConflictError('文章已被修改，请先保存或重新载入，再移动它引用的文件');
		}
		const fileMoves = rewritten.moves.filter((move) => move.kind === 'file').map((move) => [move.from, move.to]);
		const views = moveMoleculeViews(snapshot.viewsSource, fileMoves);

		const moved = await this.manager.move(slug, source, target);
		try {
			const revision = await this.articles.writeSnapshot(snapshot, { source: rewritten.source, viewsSource: views.source });
			return { ...moved, revision, references: rewritten.changed, views: views.moved };
		} catch (error) {
			// The article could not follow: put its text and the file back as they were.
			const written = { ...snapshot, source: rewritten.source, viewsSource: views.source };
			await this.articles.writeSnapshot(written, snapshot).catch(() => {});
			await this.manager.move(slug, target, source).catch(() => {});
			throw error;
		}
	}
}
