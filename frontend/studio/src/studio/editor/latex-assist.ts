/**
 * Help typing LaTeX: completing `\al` to `\alpha`, pairing braces, and Tab
 * to the next `{}`. These work on a formula's text and the caret in it, so
 * the display formula's popup and the inline formula's source share them.
 */

/** Where the caret goes in a command's template. */
const CARET = '‸';

export type LatexCommand = {
	/** As typed: `\frac`. */
	name: string;
	/** What is inserted; `‸` is where the caret goes. */
	insert: string;
	/** A formula that shows what it draws. */
	preview: string;
};

/** A change to a formula's text: replace [from, to) with `insert`, then the caret at `caret`. */
export type LatexEdit = { from: number; to: number; insert: string; caret: number };

const SYMBOLS = [
	// Greek, the common ones first.
	'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'theta', 'lambda', 'mu', 'nu', 'pi', 'rho', 'sigma', 'tau',
	'phi', 'varphi', 'chi', 'psi', 'omega', 'zeta', 'eta', 'vartheta', 'iota', 'kappa', 'xi', 'varpi', 'varrho', 'varsigma',
	'upsilon', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
	// Operators and relations.
	'sum', 'prod', 'int', 'iint', 'iiint', 'oint', 'partial', 'nabla', 'infty', 'hbar', 'ell', 'pm', 'mp', 'times', 'cdot',
	'div', 'circ', 'approx', 'equiv', 'neq', 'leq', 'geq', 'll', 'gg', 'sim', 'simeq', 'propto', 'in', 'notin', 'subset',
	'subseteq', 'cup', 'cap', 'forall', 'exists', 'emptyset', 'dagger', 'otimes', 'oplus', 'perp', 'parallel', 'angle',
	'cdots', 'ldots', 'vdots', 'ddots', 'langle', 'rangle', 'lvert', 'rvert', 'quad', 'qquad',
	// Arrows, also for reactions.
	'to', 'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'longrightarrow',
	'rightleftharpoons', 'uparrow', 'downarrow', 'mapsto',
	// Functions.
	'sin', 'cos', 'tan', 'exp', 'ln', 'log', 'lim', 'max', 'min', 'det', 'arg', 'sinh', 'cosh', 'tanh', 'Re', 'Im',
	// Without an argument, but used with one.
	'left', 'right', 'label', 'tag', 'notag', 'nonumber',
];

/** [name, template, preview]: commands that take arguments, the caret in the first. */
const TEMPLATES: [string, string, string][] = [
	['frac', '\\frac{‸}{}', '\\frac{a}{b}'],
	['dfrac', '\\dfrac{‸}{}', '\\dfrac{a}{b}'],
	['sqrt', '\\sqrt{‸}', '\\sqrt{x}'],
	['sqrt[n]', '\\sqrt[‸]{}', '\\sqrt[n]{x}'],
	['text', '\\text{‸}', '\\text{文字}'],
	['mathrm', '\\mathrm{‸}', '\\mathrm{d}x'],
	['mathbf', '\\mathbf{‸}', '\\mathbf{r}'],
	['boldsymbol', '\\boldsymbol{‸}', '\\boldsymbol{\\mu}'],
	['mathcal', '\\mathcal{‸}', '\\mathcal{H}'],
	['mathbb', '\\mathbb{‸}', '\\mathbb{R}'],
	['operatorname', '\\operatorname{‸}', '\\operatorname{Tr}'],
	['hat', '\\hat{‸}', '\\hat{H}'],
	['bar', '\\bar{‸}', '\\bar{x}'],
	['vec', '\\vec{‸}', '\\vec{v}'],
	['dot', '\\dot{‸}', '\\dot{x}'],
	['ddot', '\\ddot{‸}', '\\ddot{x}'],
	['tilde', '\\tilde{‸}', '\\tilde{\\psi}'],
	['overline', '\\overline{‸}', '\\overline{AB}'],
	['underline', '\\underline{‸}', '\\underline{x}'],
	['overset', '\\overset{‸}{}', '\\overset{\\Delta}{\\longrightarrow}'],
	['binom', '\\binom{‸}{}', '\\binom{n}{k}'],
	['left(', '\\left( ‸ \\right)', '\\left( x \\right)'],
	['left[', '\\left[ ‸ \\right]', '\\left[ x \\right]'],
	['left|', '\\left| ‸ \\right|', '\\left| x \\right|'],
	['left\\langle', '\\left\\langle ‸ \\right\\rangle', '\\left\\langle x \\right\\rangle'],
	['begin{pmatrix}', '\\begin{pmatrix} ‸ \\end{pmatrix}', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
	['begin{bmatrix}', '\\begin{bmatrix} ‸ \\end{bmatrix}', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}'],
	['begin{vmatrix}', '\\begin{vmatrix} ‸ \\end{vmatrix}', '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}'],
	['begin{cases}', '\\begin{cases} ‸ \\end{cases}', '\\begin{cases} a & x>0 \\\\ b & x<0 \\end{cases}'],
	['begin{aligned}', '\\begin{aligned} ‸ \\end{aligned}', '\\begin{aligned} a &= b \\end{aligned}'],
	['ce', '\\ce{‸}', '\\ce{H2O}'],
	['pu', '\\pu{‸}', '\\pu{298 K}'],
	['eqref', '\\eqref{‸}', '(1)'],
	['ref', '\\ref{‸}', '1'],
];

/** Templates used about as often as the symbols; the others come after the symbols. */
const COMMON_TEMPLATES = new Set(['frac', 'sqrt', 'text', 'mathrm', 'hat', 'vec', 'ce']);

const template = ([name, insert, preview]: [string, string, string]): LatexCommand => ({ name: `\\${name}`, insert, preview });

/** In the order offered when several complete the same letters. */
const BUILT_IN: LatexCommand[] = [
	...TEMPLATES.filter(([name]) => COMMON_TEMPLATES.has(name)).map(template),
	...SYMBOLS.map((name) => ({ name: `\\${name}`, insert: `\\${name}`, preview: `\\${name}` })),
	...TEMPLATES.filter(([name]) => !COMMON_TEMPLATES.has(name)).map(template),
];

/** Shown for commands that draw nothing alone. */
const BARE_PREVIEW: Record<string, string> = {
	'\\left': '\\left( \\right)',
	'\\right': '\\left( \\right)',
	'\\label': '',
	'\\tag': '',
	'\\notag': '',
	'\\nonumber': '',
	'\\quad': 'a \\quad b',
	'\\qquad': 'a \\qquad b',
};
for (const command of BUILT_IN) {
	if (command.name in BARE_PREVIEW) command.preview = BARE_PREVIEW[command.name];
}

/** Macros (`\dd`, `\expval`…) as commands; one with arguments gets a `{}` for each. */
function macroCommands(macros: Record<string, unknown>): LatexCommand[] {
	// KaTeX also keeps the formulas' own `\gdef`s there, not as text.
	const written = Object.entries(macros).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
	return written.map(([name, expansion]) => {
		const arity = Math.max(0, ...[...expansion.matchAll(/#(\d)/g)].map((match) => Number(match[1])));
		const insert = arity ? `${name}{‸}${'{}'.repeat(arity - 1)}` : name;
		const preview = arity ? `${name}${Array.from({ length: arity }, (_, index) => `{${'xyz'[index] ?? 'x'}}`).join('')}` : name;
		return { name, insert, preview };
	});
}

/** The commands to complete from: the article's macros first, then LaTeX's. */
export function latexCommands(macros: Record<string, unknown> = {}): LatexCommand[] {
	const own = macroCommands(macros);
	const names = new Set(own.map((command) => command.name));
	return [...own, ...BUILT_IN.filter((command) => !names.has(command.name))];
}

function backslashesBefore(text: string, index: number): number {
	let count = 0;
	for (let at = index - 1; at >= 0 && text[at] === '\\'; at -= 1) count += 1;
	return count;
}

/** The command being typed at the caret, `\al|` or `\al|pha`: what it replaces, and its letters before the caret. */
export function completionQuery(text: string, caret: number): { from: number; to: number; prefix: string } | null {
	const match = /\\([A-Za-z]+)$/.exec(text.slice(0, caret));
	// `\\al`: that backslash ends a line break.
	if (!match || backslashesBefore(text, match.index) % 2 === 1) return null;
	const rest = /^[A-Za-z]*/.exec(text.slice(caret))?.[0] ?? '';
	return { from: match.index, to: caret + rest.length, prefix: match[1] };
}

/**
 * The commands that complete `prefix`: an exact match first, then those it
 * starts with in this case, then in any case; in the list's order (the
 * common ones first). Nothing to offer when the command is already whole.
 */
export function completeLatex(prefix: string, commands: LatexCommand[], limit = 8): LatexCommand[] {
	const lower = prefix.toLowerCase();
	const ranked = commands
		.map((command, order) => ({ command, order, word: command.name.slice(1) }))
		.filter(({ word }) => word.toLowerCase().startsWith(lower))
		.sort((a, b) =>
			Number(b.word === prefix) - Number(a.word === prefix)
			|| Number(b.word.startsWith(prefix)) - Number(a.word.startsWith(prefix))
			|| a.order - b.order);
	const found = ranked.slice(0, limit).map(({ command }) => command);
	if (found.length === 1 && found[0].name === `\\${prefix}` && found[0].insert === found[0].name) return [];
	return found;
}

/** Writes a command in place of what the query covers; the caret where its template says. */
export function applyCompletion(text: string, query: { from: number; to: number }, command: LatexCommand): LatexEdit {
	// Its arguments are there already, as when renaming `\dfrac{a}{b}` to `\frac`.
	const argued = /^[{[]/.test(text.slice(query.to));
	const template = argued ? command.name.replace(/[[{(|].*$/, '') : command.insert;
	const at = template.indexOf(CARET);
	const insert = template.replace(CARET, '');
	return { from: query.from, to: query.to, insert, caret: query.from + (at < 0 ? insert.length : at) };
}

/** Whether every `{` has its `}`; escaped braces are text. */
function balanced(text: string): boolean {
	let depth = 0;
	for (let index = 0; index < text.length; index += 1) {
		if (text[index] === '\\') index += 1;
		else if (text[index] === '{') depth += 1;
		else if (text[index] === '}') depth -= 1;
	}
	return depth === 0;
}

/**
 * A brace typed: `{` comes with its `}` (around the selection, if any; `\{`
 * with `\}`), and `}` steps over the `}` already there when the braces pair up.
 * Null: type it as it is.
 */
export function typeBrace(text: string, start: number, end: number, brace: '{' | '}'): LatexEdit | null {
	const escaped = backslashesBefore(text, start) % 2 === 1;
	if (brace === '{') {
		const closing = escaped ? '\\}' : '}';
		const inside = text.slice(start, end);
		const insert = `{${inside}${closing}`;
		return { from: start, to: end, insert, caret: start + 1 + inside.length + (inside ? closing.length : 0) };
	}
	if (start !== end || escaped || text[start] !== '}' || !balanced(text)) return null;
	return { from: start, to: start, insert: '', caret: start + 1 };
}

/** Backspace between an empty `{}` deletes both. */
export function deleteBracePair(text: string, start: number, end: number): LatexEdit | null {
	if (start !== end || text[start - 1] !== '{' || text[start] !== '}' || backslashesBefore(text, start - 1) % 2 === 1) return null;
	return { from: start - 1, to: start + 1, insert: '', caret: start - 1 };
}

/** Tab: into the next `{…}` after the caret. Null when there is none. */
export function nextSlot(text: string, caret: number): number | null {
	for (let index = caret; index < text.length; index += 1) {
		if (text[index] === '\\') index += 1;
		else if (text[index] === '{') return index + 1;
	}
	return null;
}
