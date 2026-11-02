import { schemaCtx } from '@milkdown/kit/core';
import { closeHistory } from '@milkdown/prose/history';
import { InputRule, inputRules, textblockTypeInputRule, wrappingInputRule } from '@milkdown/prose/inputrules';
import { Plugin, PluginKey, type Transaction } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';

import { todoInputRule } from './block-keys.ts';

/**
 * The Markdown shortcuts as a Chinese input method types them (as SiYuan
 * takes them), so they need no switch to English: `》` at the start of a line
 * is a quote, `【】` a to-do, `···` (the backtick key) a code block.
 */
export const fullWidthRules = $prose((ctx) => {
	const schema = ctx.get(schemaCtx);
	const rules: InputRule[] = [new InputRule(/^【( |x|X)?】\s?$/u, todoInputRule)];
	const quote = schema.nodes.blockquote;
	if (quote) rules.push(wrappingInputRule(/^\s*》$/u, quote));
	const code = schema.nodes.code_block;
	if (code) rules.push(textblockTypeInputRule(/^···([\w+#-]*)\s$/u, code, (match) => ({ language: match[1] ?? '' })));
	return inputRules({ rules });
});

const apartKey = new PluginKey<boolean>('typing-rule-apart');

/** Whether an input rule (`# `, `> `, `$…$`) made this change. */
function byInputRule(tr: Transaction, plugins: readonly Plugin[]): boolean {
	return plugins.some((plugin) => (plugin.spec as { isInputRules?: boolean }).isInputRules && tr.getMeta(plugin) != null);
}

/**
 * What an input rule makes of what is typed is a step of its own to undo: ⌘Z
 * after `# ` and a heading typed fast takes back the heading's text, then the
 * heading, then the `#`, not all of them at once (they are less than half a
 * second apart, which joins them).
 */
export const ruleStepApart = $prose(
	() =>
		new Plugin({
			key: apartKey,
			state: {
				init: () => false,
				apply: (tr, after, _old, state) => (tr.docChanged ? byInputRule(tr, state.plugins) : after),
			},
			filterTransaction(tr, state) {
				if (tr.docChanged && (apartKey.getState(state) || byInputRule(tr, state.plugins))) closeHistory(tr);
				return true;
			},
		}),
);

export const typingRulePlugins = [fullWidthRules, ruleStepApart];
