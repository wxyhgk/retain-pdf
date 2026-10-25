import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';

/** What the author asked, as a conversation's page writes it (src/studio/server/chat-store.mjs). */
const ASK_LANGUAGE = 'ask';

const CSS = `
.note-ask { display: flex; justify-content: flex-end; margin: 4px 0; }
.note-ask-bubble { max-width: 82%; padding: 8px 13px; border-radius: 14px; background: var(--surface-soft); color: rgb(var(--black)); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

/** An ```ask block drawn as what was said in a conversation: a bubble on the right; null for the other languages. */
function askPreview(language: string, content: string): HTMLElement | null {
	if (language.toLowerCase() !== ASK_LANGUAGE) return null;
	const row = document.createElement('div');
	row.className = 'note-ask';
	const bubble = document.createElement('div');
	bubble.className = 'note-ask-bubble';
	bubble.textContent = content;
	row.append(bubble);
	return row;
}

/**
 * The Studio: ```ask blocks, what the author asked in a conversation kept as a page (chats/), drawn as a bubble, as
 * the AI panel draws it; the AI's answers after it are the page's own blocks.
 */
export const name = 'block-ask';
export const description = '对话里问的话（```ask）：对话页（chats/）里你问 AI 的话，画成右边的气泡；后面 AI 的回答就是普通的块。';
export const inject = ['blocks', 'styles'];

export function apply(ctx: Context): void {
	ctx.styles.add(CSS);
	ctx.blocks.register({ name, fence: ASK_LANGUAGE, codeBlock: { preview: askPreview } } satisfies StudioBlock);
}
