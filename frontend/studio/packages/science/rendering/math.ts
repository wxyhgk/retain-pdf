import { t } from '@blog/i18n/index.mjs';
import katex from 'katex';
import 'katex/contrib/mhchem';

import { prepareFormula, type EquationLabel } from './equations.mjs';
import { katexOptions, lenientOptions } from './katex-options.mjs';

export type MathRenderResult = {
	html: string;
	error?: string;
};

let macros: Record<string, string> = {};

/** The macros the formulas drawn from now on use (`mergeMacros`: the site's, then the article's). */
export function useMacros(next: Record<string, string>): void {
	macros = next;
}

/** The macros formulas use now: the site's, then the article's. */
export function currentMacros(): Record<string, unknown> {
	return macros;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : t('无法渲染公式');
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

/**
 * For a formula being typed in the Studio (`marks`): the editor's own `\htmlClass{pm-math-…}` marks trusted too (the
 * caret, the part it is in, the empty places), and not warned of as not standard.
 */
const markOptions = {
	trust: (context: { command: string; url?: string; class?: string }) =>
		(context.command === '\\href' && Boolean(context.url?.startsWith('#'))) || (context.command === '\\htmlClass' && /^pm-math-[a-z]+$/u.test(context.class ?? '')),
	strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'warn'),
};

/**
 * Render trusted application output from untrusted LaTeX source.
 *
 * Parse failures are represented in the returned HTML and `error`; callers do
 * not need a try/catch. `mhchem` is registered on the same KaTeX instance.
 * `\label`s are dropped and `\eqref`s shown from `labels` (`equations.mjs`).
 */
export function renderMathHtml(latex: string, displayMode: boolean, labels?: Map<string, EquationLabel>, { marks = false }: { marks?: boolean } = {}): MathRenderResult {
	const source = prepareFormula(latex, labels);
	const options = marks ? { ...katexOptions, ...markOptions } : katexOptions;
	try {
		return {
			html: katex.renderToString(source, { ...options, macros, displayMode }),
		};
	} catch (error) {
		const message = errorMessage(error);
		try {
			return {
				html: katex.renderToString(source, { ...options, ...lenientOptions, macros, displayMode }),
				error: message,
			};
		} catch {
			return {
				html: `<span class="katex-error" title="${escapeHtml(message)}">${escapeHtml(latex)}</span>`,
				error: message,
			};
		}
	}
}
