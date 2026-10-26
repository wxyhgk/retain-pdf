import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { atomicWriteText } from '../files/atomic-write.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The AI panel's conversations kept, each a folder of `chats/` (beside blog/, never published, kept out of git):
 *
 * - `index.md`: what was said, to read as a page (YAML frontmatter as an article's draft): what the author said in an
 *   ` ```ask ` block, the AI's answers as they came, their Markdown blocks (formulas, molecules, code…) as an
 *   article's. Each turn is added at its end once it is over;
 * - `ai/conversation.json`: all of it (its thinking, the tools it called, leave asked), the agent it was, which
 *   session of the agent's (to go on with it), and the last item put on the page (`pageThrough`).
 *
 * A conversation is a folder named for when it began (`chat-20261025-153012`); that name is its id.
 */
export class ChatStore {
	/** @param {string} root the `chats/` folder */
	constructor(root) {
		this.root = root;
		/** Ids given and not yet written, so that two begun in the same second are not one. */
		this.given = new Set();
	}

	/** An id for a conversation begun at `date`, not one there is. */
	newId(date = new Date()) {
		const pad = (value) => String(value).padStart(2, '0');
		const base = `chat-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
		let taken = new Set();
		try {
			taken = new Set(readdirSync(this.root));
		} catch {
			// No chats/ yet.
		}
		let id = base;
		for (let n = 2; taken.has(id) || this.given.has(id); n += 1) id = `${base}-${n}`;
		this.given.add(id);
		return id;
	}

	/** The conversations kept, as `ai/conversation.json` has them; the latest first. One that cannot be read is left out. */
	async list() {
		let names = [];
		try {
			names = (await readdir(this.root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && isId(entry.name)).map((entry) => entry.name);
		} catch {
			return [];
		}
		const read = await Promise.all(names.map((id) => this.read(id).catch(() => null)));
		return read.filter(Boolean).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
	}

	/** @returns {Promise<ChatRecord>} */
	async read(id) {
		if (!isId(id)) throw Object.assign(new Error(t('没有这个对话')), { statusCode: 404 });
		try {
			return { ...JSON.parse(await readFile(this.#record(id), 'utf8')), id };
		} catch (error) {
			if (error?.code === 'ENOENT') throw Object.assign(new Error(t('没有这个对话')), { statusCode: 404 });
			throw error;
		}
	}

	/** Writes `record` (ai/conversation.json); `sync`, as the server stops. */
	async save(record, { sync = false } = {}) {
		if (!isId(record.id)) throw new Error(t('对话的名字不对：{id}', { id: record.id }));
		const json = `${JSON.stringify(record, null, '\t')}\n`;
		if (sync) {
			mkdirSync(join(this.root, record.id, 'ai'), { recursive: true });
			writeAtOnce(this.#record(record.id), json);
		} else {
			await mkdir(join(this.root, record.id, 'ai'), { recursive: true });
			await atomicWriteText(this.#record(record.id), json);
		}
		this.given.delete(record.id);
	}

	/**
	 * What was said in a turn (`items`: the author's words, the AI's answers) added at the end of the page, as it is
	 * now (edited in the editor, perhaps); the page begun if there is none (`record`: its title and date).
	 */
	async append(record, items, { sync = false } = {}) {
		if (!isId(record.id)) throw new Error(t('对话的名字不对：{id}', { id: record.id }));
		const blocks = turnMarkdown(items);
		const page = this.page(record.id);
		const read = () => (existsSync(page) ? readFileSync(page, 'utf8') : chatFront(record));
		// A page begun before anything was said is titled 新对话 until the conversation has a title (the author's, if retitled).
		const titled = (before) => (record.title ? before.replace(/^(---\n(?:[^\n]*\n)*?)title: "新对话"\n/u, `$1title: ${JSON.stringify(record.title)}\n`) : before);
		const next = (before) => titled(blocks ? `${before.replace(/\s*$/u, '')}\n\n${blocks}\n` : before);
		if (sync) {
			mkdirSync(join(this.root, record.id, 'ai'), { recursive: true });
			writeAtOnce(page, next(read()));
			return;
		}
		await mkdir(join(this.root, record.id, 'ai'), { recursive: true });
		await atomicWriteText(page, next(read()));
	}

	async remove(id) {
		if (!isId(id)) throw Object.assign(new Error(t('没有这个对话')), { statusCode: 404 });
		await rm(join(this.root, id), { recursive: true, force: true });
	}

	/** Where a conversation is written as a page. */
	page(id) {
		return join(this.root, id, 'index.md');
	}

	#record(id) {
		return join(this.root, id, 'ai', 'conversation.json');
	}
}

/**
 * @typedef {object} ChatRecord a conversation as kept
 * @property {string} id
 * @property {{ id: string, name: string }} agent
 * @property {string | null} acpSessionId the agent's own session, to go on with
 * @property {string} title
 * @property {string} created
 * @property {string} updated
 * @property {string | null} slug the article open when it began
 * @property {string | null} service
 * @property {Array<Record<string, any>>} configOptions
 * @property {Array<Record<string, any>>} items
 * @property {string | null} [pageThrough] the last item put on the page (none: all of them are, as they were before)
 */

const isId = (id) => typeof id === 'string' && /^chat-\d{8}-\d{6}(-\d+)?$/u.test(id);

function writeAtOnce(path, content) {
	const temporary = `${path}.tmp`;
	writeFileSync(temporary, content, 'utf8');
	renameSync(temporary, path);
}

/** A conversation's page begun: its properties as an article's (a draft, dated the day it began), no text yet. */
export function chatFront({ title, created }) {
	return ['---', `title: ${JSON.stringify(title || '新对话')}`, `pubDate: ${String(created).slice(0, 10)}`, 'draft: true', '---', ''].join('\n'); // i18n-ignore: written into the file
}

/** What was said, as a page has it: the author's words in ` ```ask ` blocks, each answer's Markdown as it is. */
export function turnMarkdown(items) {
	const blocks = [];
	for (const item of items) {
		if (item.kind === 'user') {
			const fence = '`'.repeat(Math.max(3, ...[...item.text.matchAll(/`+/gu)].map((run) => run[0].length + 1)));
			blocks.push(`${fence}ask\n${item.text.trim()}\n${fence}`);
		} else if (item.kind === 'message' && item.text.trim()) {
			blocks.push(item.text.trim());
		}
	}
	return blocks.join('\n\n');
}
