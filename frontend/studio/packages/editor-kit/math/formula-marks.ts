/**
 * A formula being typed, drawn as MathLive shows one (cortexjs.io): where the caret is in the drawing, the part it is
 * in (the numerator, the exponent, what is under the root) shaded, and its empty places (`\frac{}{}`) as boxes. The
 * LaTeX is marked for the drawing only (KaTeX's `\htmlClass`, with these classes); the source is not changed.
 */

export const CARET_CLASS = 'pm-math-caret';
export const HERE_CLASS = 'pm-math-here';
export const SLOT_CLASS = 'pm-math-slot';

/** Commands whose `{…}` is not a place in the formula: words, names, numbers, colours, environments. */
const NOT_A_PLACE = new Set([
	'text', 'textrm', 'textbf', 'textit', 'textsf', 'texttt', 'mathrm', 'operatorname', 'begin', 'end', 'label', 'tag',
	'ref', 'eqref', 'ce', 'pu', 'color', 'textcolor', 'colorbox', 'href', 'htmlClass', 'unit',
]);

/** Commands that take what follows them: a mark put right after one would be taken as its argument. */
const TAKES_WHAT_FOLLOWS = new Set([
	...NOT_A_PLACE, 'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'binom', 'dbinom', 'tbinom', 'hat', 'widehat', 'bar',
	'overline', 'underline', 'vec', 'dot', 'ddot', 'tilde', 'widetilde', 'check', 'breve', 'acute', 'grave', 'mathring',
	'mathbf', 'mathit', 'mathcal', 'mathbb', 'mathsf', 'mathtt', 'mathfrak', 'mathscr', 'boldsymbol', 'bm', 'pmb',
	'left', 'right', 'middle', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl',
	'Biggr', 'overset', 'underset', 'stackrel', 'overbrace', 'underbrace', 'xrightarrow', 'xleftarrow', 'cancel',
	'bcancel', 'xcancel', 'boxed', 'phantom', 'hphantom', 'vphantom', 'not', 'mathop', 'mathbin', 'mathrel', 'mathord',
	'displaystyle', 'textstyle', 'scriptstyle', 'limits', 'nolimits', 'substack', 'sideset',
]);

const isLetter = (char: string | undefined) => char !== undefined && /[A-Za-z]/u.test(char);

/** How many backslashes are just before `index`. */
function backslashesBefore(text: string, index: number): number {
	let count = 0;
	for (let at = index - 1; at >= 0 && text[at] === '\\'; at -= 1) count += 1;
	return count;
}

/** The command (its name) whose letters end at `end`, if one does: `\frac|` → `frac`. */
function commandEndingAt(text: string, end: number): { name: string; start: number } | null {
	let start = end;
	while (start > 0 && isLetter(text[start - 1])) start -= 1;
	if (start === end || text[start - 1] !== '\\' || backslashesBefore(text, start - 1) % 2 === 1) return null;
	return { name: text.slice(start, end), start: start - 1 };
}

type Group = { open: number; close: number; command: string | null };

/** The `{…}` groups of `text` (not escaped braces), each with the command it follows (through `^`, `_` it is none). */
function groupsOf(text: string): Group[] {
	const groups: Group[] = [];
	const open: number[] = [];
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === '\\') {
			index += isLetter(text[index + 1]) ? 0 : 1;
			continue;
		}
		if (char === '{') open.push(index);
		else if (char === '}' && open.length) {
			const start = open.pop()!;
			// The command it is an argument of: the one just before it, or before the group(s) before it (`\frac{a}{b}`).
			let at = start;
			while (text[at - 1] === '}') {
				const previous = groups.find((group) => group.close === at - 1);
				if (!previous) break;
				at = previous.open;
			}
			while (at > 0 && /\s/u.test(text[at - 1]!)) at -= 1;
			groups.push({ open: start, close: index, command: commandEndingAt(text, at)?.name ?? null });
		}
	}
	return groups;
}

/** Where a caret mark can go, near `caret`: not inside a command's name; nowhere it would be taken as an argument. */
function caretPlace(text: string, caret: number): number | null {
	let at = caret;
	// In a command's name (`\si|n`, `\|sin`): after it.
	const end = at + (/^[A-Za-z]*/u.exec(text.slice(at))?.[0].length ?? 0);
	const name = commandEndingAt(text, end);
	if (name && name.start < at && at < end) at = end;
	if (at > 0 && text[at - 1] === '\\' && backslashesBefore(text, at - 1) % 2 === 0) return null;
	let before = at;
	while (before > 0 && /\s/u.test(text[before - 1]!)) before -= 1;
	const previous = text[before - 1];
	if ((previous === '^' || previous === '_') && backslashesBefore(text, before - 1) % 2 === 0) return null;
	const command = commandEndingAt(text, before);
	if (command && TAKES_WHAT_FOLLOWS.has(command.name)) return null;
	return at;
}

/**
 * `text` marked for its drawing, `caret` being where the typing is (in it); null when nothing is to be marked. What
 * cannot be marked safely is left as it is.
 */
export function markFormula(text: string, caret: number): string | null {
	const inserts: Array<{ at: number; order: number; text: string }> = [];
	const replaced: Array<{ from: number; to: number; text: string }> = [];
	const groups = groupsOf(text).filter((group) => !(group.command && NOT_A_PLACE.has(group.command)));
	for (const group of groups) {
		if (text.slice(group.open + 1, group.close).trim()) continue;
		replaced.push({ from: group.open + 1, to: group.close, text: `\\htmlClass{${SLOT_CLASS}}{\\phantom{\\square}}` });
	}
	// The innermost place the caret is in: shaded. Not one holding rows or columns (they would come apart).
	const here = groups
		.filter((group) => group.open < caret && caret <= group.close)
		.sort((a, b) => b.open - a.open)
		.find((group) => !/&|\\\\|\\begin/u.test(text.slice(group.open + 1, group.close)));
	if (here) {
		inserts.push({ at: here.open + 1, order: 0, text: `\\htmlClass{${HERE_CLASS}}{` });
		inserts.push({ at: here.close, order: 2, text: '}' });
	}
	const place = caretPlace(text, caret);
	const inSlot = place !== null && replaced.some((slot) => slot.from <= place && place <= slot.to);
	if (place !== null && !inSlot) inserts.push({ at: place, order: 1, text: `\\htmlClass{${CARET_CLASS}}{}` });
	if (!inserts.length && !replaced.length) return null;

	let marked = '';
	let at = 0;
	const edits = [
		...replaced.map((slot) => ({ at: slot.from, order: 1, to: slot.to, text: slot.text })),
		...inserts.map((insert) => ({ ...insert, to: insert.at })),
	].sort((a, b) => a.at - b.at || a.order - b.order);
	for (const edit of edits) {
		if (edit.at < at) continue;
		marked += text.slice(at, edit.at) + edit.text;
		at = edit.to;
	}
	return marked + text.slice(at);
}
