import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';

import { parseArticleSource } from '../../../articles/schemas.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * An article's text (blog/<folder>/index.md) as an AI's own file tools (pi's edit and write) may change it: its text
 * edited as the AI edits any file (what it does best, its edits shown to the author to accept or reject), but what
 * would lose the page not:
 *
 * - its properties (the YAML at its top) edited: refused, `studio update-page` named (it changes a field, not text);
 * - the whole of it written over, or a new one written: refused, `studio edit-page` / `update-page` / `create-page`
 *   named (a write cuts it short, drops its properties; a page made by hand has no link from the one above);
 * - an edit that left its properties unreadable after all (a passage that ran into them): the file put back as it was,
 *   the AI told so.
 *
 * One guard for each conversation (pi-agent.mjs) and each subagent (pi-child-guard.mjs): `before` a tool runs, `after`.
 */

/** The article file a tool's input names (blog/<folder>/index.md), or null. */
function articleFile(input, cwd) {
	const path = typeof input?.path === 'string' ? input.path : typeof input?.file_path === 'string' ? input.file_path : '';
	if (!path) return null;
	const file = isAbsolute(path) ? path : resolve(cwd, path.replace(/^~(?=\/)/u, process.env.HOME ?? '~'));
	const above = dirname(dirname(file));
	return basename(file) === 'index.md' && (basename(above) === 'blog' || above === resolve(cwd)) ? file : null;
}

/** Where its properties end (after their closing ---), 0 for none. */
function propertiesEnd(source) {
	return /^(?:﻿)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(source)?.[0].length ?? 0;
}

/** Whether its properties read (as the Studio and the blog read them). */
function readable(source) {
	if (!propertiesEnd(source)) return false;
	try {
		parseArticleSource(source);
		return true;
	} catch {
		return false;
	}
}

export function articleGuard() {
	/** By tool call: the article an edit changes, and its text before (put back when the edit broke it). */
	const edited = new Map();
	return {
		/** Before a tool runs: `{ block, reason }` when it may not, else undefined. */
		before(event, cwd) {
			if (event.toolName !== 'edit' && event.toolName !== 'write') return undefined;
			const file = articleFile(event.input, cwd);
			if (!file) return undefined;
			const slug = basename(dirname(file));
			if (event.toolName === 'write') {
				return existsSync(file)
					? { block: true, reason: t('不要用写文件整个覆盖文章（会截断正文、丢掉属性）：改几处用编辑工具，换整篇正文用 studio update-page --slug {slug} --body @文件', { slug }) }
					: { block: true, reason: t('新建文章用 studio create-page（会起文件夹名、写好属性、在上级页面放链接），不要自己写 index.md') };
			}
			let source;
			try {
				source = readFileSync(file, 'utf8');
			} catch {
				return undefined;
			}
			const end = propertiesEnd(source);
			const edits = Array.isArray(event.input?.edits) ? event.input.edits : [event.input];
			for (const edit of edits) {
				const old = typeof edit?.oldText === 'string' ? edit.oldText : typeof edit?.old_string === 'string' ? edit.old_string : '';
				for (let at = old ? source.indexOf(old) : -1; at >= 0; at = source.indexOf(old, at + 1)) {
					if (at < end) return { block: true, reason: t('这处在文章开头的属性里：属性用 studio update-page --slug {slug} 改（--title、--description、--tags、--icon、--props），编辑工具只改正文', { slug }) };
				}
			}
			edited.set(event.toolCallId, { file, source, ok: readable(source) });
			return undefined;
		},
		/** After it ran: an edit that left the properties unreadable undone, said in its result; else undefined. */
		after(event) {
			const was = edited.get(event.toolCallId);
			edited.delete(event.toolCallId);
			if (!was || !was.ok || event.isError) return undefined;
			let now;
			try {
				now = readFileSync(was.file, 'utf8');
			} catch {
				return undefined;
			}
			if (readable(now)) return undefined;
			writeFileSync(was.file, was.source);
			return { isError: true, content: [{ type: 'text', text: t('这次修改让文章开头的属性读不出来了，已经把文件恢复成改之前的样子。只改正文；属性用 studio update-page 改。') }] };
		},
	};
}
