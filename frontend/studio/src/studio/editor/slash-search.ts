import { pinyin } from 'pinyin-pro';

/**
 * Finding a block in the slash menu as Notion lets one: by its name, its
 * English name (`/code`, `/h2`, `/todo`) or its name's pinyin, whole or by
 * initials (`/daima`, `/dm`), and opened by `、` too, which is what the `/`
 * key types under a Chinese input method.
 */

/** What, typed at the start of a block, opens the slash menu. */
export const SLASH_TRIGGERS = ['/', '、', '／'];

/**
 * English names of the blocks Crepe itself puts in the menu, by its group and
 * item keys; the Studio's own blocks give theirs where they are added.
 */
const CREPE_ITEM_WORDS: Record<string, string[]> = {
	'text/text': ['text', 'paragraph'],
	'text/h1': ['h1', 'heading1', 'title'],
	'text/h2': ['h2', 'heading2'],
	'text/h3': ['h3', 'heading3'],
	'text/quote': ['quote', 'blockquote'],
	'text/divider': ['divider', 'hr', 'line', 'separator'],
	'list/bullet-list': ['bullet', 'list', 'ul'],
	'list/ordered-list': ['numbered', 'ordered', 'ol', 'list'],
	'list/task-list': ['todo', 'task', 'checkbox'],
	'advanced/image': ['image', 'img', 'picture', 'photo'],
	'advanced/code': ['code', 'snippet'],
	'advanced/table': ['table'],
	'advanced/math': ['math', 'equation', 'formula', 'latex', 'tex'],
};

const pinyinOf = new Map<string, string[]>();

/** A name's pinyin, whole and by initials: 「标题 1」 → `biaoti1`, `bt1`. Words without Chinese, none. */
export function pinyinWords(label: string): string[] {
	const known = pinyinOf.get(label);
	if (known) return known;
	let words: string[] = [];
	if (/\p{Script=Han}/u.test(label)) {
		const options = { toneType: 'none', type: 'array', nonZh: 'consecutive', v: true } as const;
		const whole = pinyin(label, options).join('');
		const initials = pinyin(label, { ...options, pattern: 'first' }).join('');
		words = [...new Set([whole, initials].map((word) => word.replace(/\s+/gu, '').toLowerCase()))];
	}
	pinyinOf.set(label, words);
	return words;
}

type SearchableItem = { key: string; label: string; keywords?: string[] };
type SearchableMenu = { build(): Array<{ key: string; items: SearchableItem[] }> };

/** Gives every item of the menu its English names and its pinyin, besides any words it has. */
export function addSearchWords(menu: SearchableMenu): void {
	for (const group of menu.build()) {
		for (const item of group.items) {
			item.keywords = [...new Set([...(item.keywords ?? []), ...(CREPE_ITEM_WORDS[`${group.key}/${item.key}`] ?? []), ...pinyinWords(item.label)])];
		}
	}
}
