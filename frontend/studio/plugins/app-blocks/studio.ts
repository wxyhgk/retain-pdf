import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import type { EditorView } from '@milkdown/prose/view';

import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { AppBlockLink, StudioBlock } from '@blog/kernel/studio.ts';

import { blockHeight, picturePath, picturePaths, stateHash } from './app-blocks.mjs';

/**
 * The Studio: the blocks the author's apps give the articles (app-blocks.mjs), each a fence of its own whose body (its
 * state, JSON for most) is edited as code, and shown by the app's page in a frame (`ctx.studio.apps.frame`) that reads
 * it and writes it back (`studio.block`), keeping its picture for the blog. In the slash menu by the block's title.
 *
 * The apps are asked for as the Studio starts (one request on this machine): the editor knows its blocks before it
 * draws an article. An app given a block later is taken in when the Studio is opened again.
 */
type Listed = { id: string; name: string; icon: string; problem?: string; blocks: Array<{ fence: string; entry: string; height: number; title: string }> };

const listed: Listed[] = await fetch('/api/studio/apps')
	.then((response) => (response.ok ? (response.json() as Promise<{ apps: Listed[] }>) : { apps: [] }))
	.then((answer) => answer.apps ?? [], () => []);

export const name = 'app-blocks';
export const description = t('小程序的块：apps/ 里的小程序在 app.json 里写了 blocks，页面里就能用它的块（比如 ```structura），由小程序的页面画、改；博客上显示它存下的图。');
export const inject = ['studio', 'blocks'];

const json = languages.find((language) => language.name === 'JSON');

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14 17.5h7"/></svg>';

/** The code block `element` is in (a frame the editor's preview shows), found by its DOM. */
function blockOf(view: EditorView, element: Element) {
	let found: { node: import('@milkdown/prose/model').Node; pos: number } | null = null;
	view.state.doc.descendants((node, pos) => {
		if (found) return false;
		if (node.type.name !== 'code_block') return true;
		const dom = view.nodeDOM(pos);
		if (dom instanceof Element && dom.contains(element)) found = { node, pos };
		return false;
	});
	return found as { node: import('@milkdown/prose/model').Node; pos: number } | null;
}

/** Whether a block of the article (```fence) holds `state`. */
function holds(view: EditorView, fence: string, state: string): boolean {
	let found = false;
	view.state.doc.descendants((node) => {
		if (found) return false;
		if (node.type.name === 'code_block' && String(node.attrs.language ?? '').toLowerCase() === fence && stateHash(node.textContent) === stateHash(state)) found = true;
		return !found && node.type.name !== 'code_block';
	});
	return found;
}

/** A picture given as SVG text or a `data:` address, as a file. */
function pictureFile(data: string, type: string, name: string): File {
	if (type === 'image/png' && data.startsWith('data:')) {
		const bytes = Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), (char) => char.charCodeAt(0));
		return new File([bytes], name, { type });
	}
	return new File([data], name, { type: 'image/svg+xml' });
}

export function apply(ctx: Context): void {
	// Blocks changed by their own page (fence, options, state): their preview kept as it is, the frame not loaded again.
	const changedByPage = new Set<string>();
	const keyOf = (fence: string, meta: string, state: string) => `${fence}\n${meta}\n${state}`;

	for (const app of listed) {
		if (app.problem) continue;
		for (const block of app.blocks ?? []) {
			const { fence } = block;
			const description = LanguageDescription.of({ name: fence, load: () => (json ? json.load() : Promise.reject(new Error('no JSON language'))) });
			const preview = (language: string, _content: string, meta: string): HTMLElement | null => {
				if (language.toLowerCase() !== fence) return null;
				const placeholder = document.createElement('figure');
				placeholder.className = 'app-block-placeholder';
				placeholder.dataset.appBlock = fence;
				placeholder.dataset.height = String(blockHeight(meta, block.height));
				placeholder.style.minHeight = `${placeholder.dataset.height}px`;
				return placeholder;
			};
			/** What the app's page is given of the block the element `holder()` (its frame) is in. */
			const linkTo = (holder: () => Element): AppBlockLink => {
				const found = () => {
					const view = ctx.studio.editor.view();
					const at = view ? blockOf(view, holder()) : null;
					return view && at ? { view, ...at } : null;
				};
				// The state its picture shows, until the next one is kept: that picture let go then.
				let pictured: string | null = null;
				const link: AppBlockLink = {
					state: () => found()?.node.textContent ?? '',
					meta: () => String(found()?.node.attrs.meta ?? ''),
					set(state) {
						const at = found();
						if (!at || at.node.textContent === state) return;
						const { view, node, pos } = at;
						pictured ??= node.textContent;
						changedByPage.add(keyOf(fence, String(node.attrs.meta ?? ''), state));
						const from = pos + 1;
						const to = pos + node.nodeSize - 1;
						view.dispatch(state ? view.state.tr.replaceWith(from, to, view.state.schema.text(state)) : view.state.tr.delete(from, to));
					},
					async picture(data, type) {
						const slug = ctx.studio.shown();
						if (!slug) throw new Error(t('还没有打开页面'));
						const state = link.state();
						const path = picturePath(fence, state, type);
						await ctx.studio.upload(slug, 'assets', pictureFile(data, type, path.slice('assets/'.length)), { replace: true });
						// The picture of what it held before goes to the trash, unless another block holds that still.
						const before = pictured;
						pictured = null;
						const view = ctx.studio.editor.view();
						if (before !== null && stateHash(before) !== stateHash(state) && view && !holds(view, fence, before)) {
							for (const old of picturePaths(fence, before)) await ctx.studio.trash(slug, old).catch(() => {});
						}
						return path;
					},
				};
				return link;
			};
			ctx.blocks.register({
				name: `app-block-${fence}`,
				fence,
				codeBlock: {
					languages: [description],
					preview,
					keep: (language, content, meta) => language.toLowerCase() === fence && changedByPage.delete(keyOf(fence, meta, content)),
				},
				observe(root) {
					const draw = () => {
						for (const placeholder of root.querySelectorAll<HTMLElement>(`figure.app-block-placeholder[data-app-block="${CSS.escape(fence)}"]`)) {
							// The link finds its block by the element in it: the frame, once it takes the placeholder's place.
							let holder: Element = placeholder;
							const frame = ctx.studio.apps.frame(app.id, block.entry, Number(placeholder.dataset.height) || block.height, linkTo(() => holder));
							placeholder.replaceWith(frame);
							holder = frame;
						}
					};
					const observer = new MutationObserver(draw);
					observer.observe(root, { childList: true, subtree: true });
					draw();
					return () => observer.disconnect();
				},
				menu: {
					key: `app-block-${fence}`,
					label: block.title,
					description: t('小程序「{name}」的块', { name: app.name }),
					hint: `\`\`\`${fence}`,
					icon: ICON,
					keywords: [fence, app.id, app.name],
					insert(view: EditorView) {
						const { state } = view;
						const type = state.schema.nodes.code_block;
						if (!type) return;
						const { $from } = state.selection;
						view.dispatch(state.tr.replaceWith($from.before(), $from.after(), type.create({ language: fence })).scrollIntoView());
						view.focus();
					},
				},
			} satisfies StudioBlock);
		}
	}
}
