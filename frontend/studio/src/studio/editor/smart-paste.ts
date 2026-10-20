import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { parserCtx } from '@milkdown/kit/core';
import { Slice, type Mark } from '@milkdown/prose/model';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { ARTICLE_ADDRESS } from '@blog/markdown/articles/rules.mjs';
import type { ArticleLinkHost } from './article-links.ts';

/**
 * Pasting an address, as Notion takes it:
 * - over selected text, the text becomes a link to it;
 * - on its own, it comes in as a link (its own text);
 * - an address of one of the blog's articles (`/blog/slug/`, or the whole
 *   address on this site) comes in as a link titled as the article, to its
 *   address on the blog: `[标题](/blog/slug/)`.
 * And columns copied as plain text (from a terminal, or a sheet that gave no
 * HTML): lines of cells between tabs, as many on each line, come in as a
 * table, the first line its header.
 * Anything else pastes as it did.
 */

/** What the paste needs from the Studio around the editor. */
export type SmartPasteHost = Pick<ArticleLinkHost, 'articleTitle'>;

/** The one address the clipboard holds, if that is all it holds. */
function pastedAddress(text: string): string | null {
	const trimmed = text.trim();
	if (!trimmed || /\s/u.test(trimmed)) return null;
	if (/^https?:\/\/[^\s/]+\.[^\s]+$/iu.test(trimmed) || /^https?:\/\/localhost(?::\d+)?\//iu.test(trimmed)) return trimmed;
	return ARTICLE_ADDRESS.test(trimmed) ? trimmed : null;
}

/** An address of one of the blog's articles, as the blog's own path (`/blog/slug/#…`); null for one elsewhere. */
export function ownArticlePath(address: string, origins: string[]): string | null {
	let path = address;
	if (/^https?:/iu.test(address)) {
		let url: URL;
		try {
			url = new URL(address);
		} catch {
			return null;
		}
		if (!origins.includes(url.origin)) return null;
		path = `${url.pathname}${url.search}${url.hash}`;
		try {
			// As it is read: /wiki/slug/#一节, not #%E4%B8%80….
			path = decodeURI(path);
		} catch {
			// Not valid percent-encoding: kept as it came.
		}
	}
	return ARTICLE_ADDRESS.test(path) ? path : null;
}

/** The sites whose addresses are this blog's: where the Studio runs, and where the blog is published. */
function ownOrigins(): string[] {
	const origins = [window.location.origin];
	const site = (import.meta.env as { SITE?: string }).SITE;
	if (site) {
		try {
			origins.push(new URL(site).origin);
		} catch {
			// No published address: only this one.
		}
	}
	return origins;
}

/** Plain text that is columns: two lines or more, each with as many cells between tabs, two or more. */
export function pastedTable(text: string): string[][] | null {
	const lines = text.replace(/\r\n?/gu, '\n').replace(/\n+$/u, '').split('\n');
	if (lines.length < 2) return null;
	const rows = lines.map((line) => line.split('\t'));
	const width = rows[0]!.length;
	if (width < 2 || rows.some((row) => row.length !== width)) return null;
	return rows;
}

/** The rows as a Markdown table, the first its header. */
export function tableMarkdown(rows: string[][]): string {
	const line = (cells: string[]) => `| ${cells.map((cell) => cell.trim().replaceAll('|', '\\|')).join(' | ')} |`;
	return [line(rows[0]!), line(rows[0]!.map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}

function pasteTable(ctx: Ctx, view: EditorView, rows: string[][]): boolean {
	const { $from } = view.state.selection;
	for (let depth = $from.depth; depth > 0; depth--) if ($from.node(depth).type.spec.tableRole) return false;
	const doc = ctx.get(parserCtx)(tableMarkdown(rows));
	if (!doc) return false;
	view.dispatch(view.state.tr.replaceSelection(new Slice(doc.content, 0, 0)).scrollIntoView());
	return true;
}

function paste(ctx: Ctx, view: EditorView, event: ClipboardEvent, host: SmartPasteHost): boolean {
	const clipboard = event.clipboardData;
	const link = view.state.schema.marks.link;
	if (!clipboard || !link) return false;
	const { selection } = view.state;
	const { $from } = selection;
	if ($from.parent.type.spec.code || !$from.parent.isTextblock || $from.marks().some((mark) => mark.type.spec.code)) return false;
	const rows = clipboard.getData('text/html') ? null : pastedTable(clipboard.getData('text/plain'));
	if (rows && pasteTable(ctx, view, rows)) {
		event.preventDefault();
		return true;
	}
	const address = pastedAddress(clipboard.getData('text/plain'));
	if (!address) return false;
	const own = ownArticlePath(address, ownOrigins());
	const href = own ?? address;
	const make = (): Mark => link.create({ href, title: null });
	let tr = view.state.tr;
	if (!selection.empty && selection instanceof TextSelection && $from.sameParent(selection.$to)) {
		tr = tr.addMark(selection.from, selection.to, make());
	} else if (selection.empty) {
		const slug = own ? ARTICLE_ADDRESS.exec(own)?.[2] : undefined;
		const text = (slug && host.articleTitle(slug)) || address;
		tr = tr.insert(selection.from, view.state.schema.text(text, [make()]));
		// Typing on after the link is not more of it.
		tr = tr.setSelection(TextSelection.create(tr.doc, selection.from + text.length)).removeStoredMark(link);
	} else {
		return false;
	}
	event.preventDefault();
	view.dispatch(tr.scrollIntoView());
	return true;
}

export function smartPastePlugins(host: SmartPasteHost): MilkdownPlugin[] {
	// On the DOM event, ahead of the clipboard's own handling, which would put the address in place of the text.
	const plugin = $prose((ctx) => new Plugin({ props: { handleDOMEvents: { paste: (view, event) => paste(ctx, view, event, host) } } }));
	return [plugin].flat();
}
