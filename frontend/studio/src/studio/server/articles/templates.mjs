import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

import { resolveInside } from '../../../articles/bundle-paths.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * Page templates, as SiYuan's and Notion's: `templates/<id>.md` at the project's root (in git), each a page's body to
 * start from, with a few lines of its own at the top:
 *
 *     ---
 *     name: 计算记录
 *     description: 体系、方法、输入、结果、问题
 *     title: '{{date}} 计算记录'
 *     ---
 *
 * In it (the body and the title) `{{date}}` (2026-10-29), `{{time}}` (14:03), `{{datetime}}`, `{{year}}`, `{{month}}`,
 * `{{day}}`, `{{weekday}}` (星期四) and `{{title}}` (the new page's) are filled in. `journal` is 今天的日志's.
 */

export const JOURNAL = 'journal';

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']; // i18n-ignore: written into the page

class TemplateError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** A template's own lines (`key: value`, a value quoted or not) and its body. */
export function parseTemplate(source) {
	const text = String(source).replace(/^﻿/u, '');
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u.exec(text);
	const fields = {};
	for (const line of (match?.[1] ?? '').split(/\r?\n/u)) {
		const field = /^([a-z]+):\s*(.*)$/u.exec(line.trim());
		if (field) fields[field[1]] = field[2].replace(/^(['"])(.*)\1$/u, '$2');
	}
	return { name: fields.name ?? '', description: fields.description ?? '', title: fields.title ?? '', body: match ? text.slice(match[0].length) : text };
}

/** `text` with its `{{…}}` filled in, for a page made at `now` called `title`. */
export function fillTemplate(text, { now = new Date(), title = '' } = {}) {
	const two = (number) => String(number).padStart(2, '0');
	const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
	const time = `${two(now.getHours())}:${two(now.getMinutes())}`;
	const values = {
		date,
		time,
		datetime: `${date} ${time}`,
		year: String(now.getFullYear()),
		month: two(now.getMonth() + 1),
		day: two(now.getDate()),
		weekday: `星期${WEEKDAYS[now.getDay()]}`, // i18n-ignore: written into the page
		title,
	};
	return String(text).replace(/\{\{\s*([a-z]+)\s*\}\}/gu, (whole, key) => values[key] ?? whole);
}

export class ArticleTemplates {
	/** @param {string} folder where the templates are (`templates/`) */
	constructor(folder) {
		this.folder = folder;
	}

	#file(id) {
		if (typeof id !== 'string' || !ID.test(id)) throw new TemplateError(t('模板的名字无效'));
		return resolveInside(this.folder, `${id}.md`);
	}

	/** Every template: `{ id, name, description, title }`, by name. */
	async list() {
		let names;
		try {
			names = await readdir(this.folder);
		} catch (error) {
			if (error?.code === 'ENOENT') return [];
			throw error;
		}
		const found = [];
		for (const name of names) {
			const id = name.replace(/\.md$/u, '');
			if (id === name || !ID.test(id)) continue;
			const { name: shown, description, title } = parseTemplate(await readFile(this.#file(id), 'utf8'));
			found.push({ id, name: shown || id, description, title });
		}
		return found.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
	}

	/** One template, filled in for a page made now: its title (the one given, else the template's) and its body. */
	async render(id, { title = '', now = new Date() } = {}) {
		let source;
		try {
			source = await readFile(this.#file(id), 'utf8');
		} catch (error) {
			if (error?.code === 'ENOENT') throw new TemplateError(t('没有模板「{id}」', { id }), 404);
			throw error;
		}
		const template = parseTemplate(source);
		const filledTitle = title || fillTemplate(template.title, { now });
		return { id, name: template.name || id, title: filledTitle, body: fillTemplate(template.body, { now, title: filledTitle }) };
	}

	/**
	 * A page's body kept as a template called `name` (存为模板): a new file, never one written over. Its pictures and
	 * files stay the page's (their links would not lead anywhere from another page), so they are left out.
	 */
	async save(name, body) {
		const shown = String(name ?? '').trim();
		if (!shown || shown.length > 60 || /[\r\n]/u.test(shown)) throw new TemplateError(t('模板要有一个名字（一行，60 字以内）'));
		const kept = String(body ?? '').replace(/^\s*!\[[^\]]*\]\(\.\/(?:img|assets)\/[^)]*\)\s*$/gmu, '').replace(/\n{3,}/gu, '\n\n').trim();
		await mkdir(this.folder, { recursive: true });
		const existing = new Set((await readdir(this.folder)).map((file) => file.replace(/\.md$/u, '')));
		let id = 'template';
		for (let number = 1; existing.has(id); number += 1) id = `template-${number}`;
		await writeFile(this.#file(id), `---\nname: ${shown}\n---\n\n${kept}\n`, { flag: 'wx' });
		return { id, name: shown };
	}
}
