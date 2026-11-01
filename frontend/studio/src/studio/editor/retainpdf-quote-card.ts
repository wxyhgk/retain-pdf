// A ```retainpdf block (retainpdf-quote.ts) as the editor shows it: a block of its own, not a code block (its
// language and tools hidden, studio-page.css), the original and the translation drawn as Markdown with their formulas
// (RetainPDF gives them as its reader has them: $…$, $$…$$), RetainPDF's mark small in its top right corner. The mark,
// and the book and page under it, show the passage in 翻译 (followQuoteOpens).
import { t } from '@blog/i18n/index.mjs';
import { renderAiMarkdown } from '../ai/ai-markdown';
import logo from './retainpdf-logo.svg?raw';
import { parseQuote, QUOTE_LANGUAGE, quoteTarget } from './retainpdf-quote';

/** The preview of a ```retainpdf block: a card; null for the other languages, and for one that says no job and block. */
export function quotePreview(language: string, content: string): HTMLElement | null {
	if (language.toLowerCase() !== QUOTE_LANGUAGE) return null;
	const quote = parseQuote(content);
	if (!quote) return null;
	const target = JSON.stringify(quoteTarget(quote));
	const label = t('在 RetainPDF 中打开');
	const card = document.createElement('figure');
	card.className = 'retainpdf-quote';

	const mark = document.createElement('button');
	mark.type = 'button';
	mark.className = 'retainpdf-quote-open retainpdf-quote-logo';
	mark.title = label;
	mark.setAttribute('aria-label', label);
	mark.dataset.target = target;
	mark.innerHTML = logo;

	for (const [text, name] of [
		[quote.source, 'retainpdf-quote-source'],
		[quote.translated, 'retainpdf-quote-translated'],
	] as const) {
		if (!text) continue;
		const part = document.createElement('div');
		part.className = name;
		part.append(renderAiMarkdown(text));
		card.append(part);
	}

	const where = document.createElement('figcaption');
	const open = document.createElement('button');
	open.type = 'button';
	open.className = 'retainpdf-quote-open retainpdf-quote-where';
	open.title = label;
	open.dataset.target = target;
	open.textContent = [quote.book ?? t('RetainPDF 里的一段'), quote.page ? t('第 {page} 页', { page: quote.page }) : ''].filter(Boolean).join(' · ');
	where.append(open);
	card.append(where, mark);
	return card;
}
