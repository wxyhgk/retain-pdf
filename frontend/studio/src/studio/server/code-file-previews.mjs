import { parseFenceMeta } from '../../code-files/highlight.mjs';
import { codeFileFigure } from '../../code-files/render.mjs';
import { articlePath, studioFileUrl } from '../shared/article-references.mjs';
import { ResourceTooLargeError } from './file-repository.mjs';
import { StudioPathError } from './bundle-paths.mjs';

/** What the Studio previews; the blog build reads any size. */
export const CODE_FILE_SIZE_LIMIT = 256 * 1024 * 1024;
/** Drawings kept, the latest used last. */
const KEPT = 16;

/**
 * The preview of a code block that shows a file of the article
 * (`@file ./assets/opt.log`), drawn here as the build draws it: the head and
 * tail of a long file, or the lines `lines=` names, under its bar. Only those
 * lines go to the page, so a log of tens of megabytes previews as quickly as
 * a short one. A drawing is kept until its file changes.
 */
export class CodeFilePreviews {
	#kept = new Map();

	/** @param {import('./file-repository.mjs').FileRepository} files */
	constructor(files, { sizeLimit = CODE_FILE_SIZE_LIMIT } = {}) {
		this.files = files;
		this.sizeLimit = sizeLimit;
	}

	/**
	 * @param {string} slug
	 * @param {string} reference the path as the block writes it: `./assets/opt.log`
	 * @param {string} language the block's language
	 * @param {string} meta what follows the language on the fence line
	 */
	async figure(slug, reference, language, meta) {
		const path = typeof reference === 'string' ? articlePath(reference) : null;
		const [root, ...rest] = path?.split('/') ?? [];
		if (!path || !rest.length) throw new StudioPathError('无效的文件路径');
		const { handle, size, modified } = await this.files.open(slug, root, rest.join('/'));
		const key = JSON.stringify([slug, path, size, modified, language, meta]);
		let text;
		try {
			const kept = this.#kept.get(key);
			if (kept) {
				this.#kept.delete(key);
				this.#kept.set(key, kept);
				return kept;
			}
			if (size > this.sizeLimit) throw new ResourceTooLargeError(this.sizeLimit);
			text = (await handle.readFile()).toString('utf8');
		} finally {
			await handle.close();
		}
		const figure = codeFileFigure({
			language,
			meta: parseFenceMeta(meta),
			source: `@file ${reference}`,
			file: { path: reference, text, href: studioFileUrl(slug, path) },
		});
		this.#kept.set(key, figure);
		if (this.#kept.size > KEPT) this.#kept.delete(this.#kept.keys().next().value);
		return figure;
	}
}
