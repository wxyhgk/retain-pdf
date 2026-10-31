import { articleWriteOf, riskOf } from './risky-commands.mjs';

/**
 * A pi extension for the pi a subagent is (pi-child.mjs): its shell commands held to what the Studio's AIs may do
 * (risky-commands.mjs), an article's text written through the `studio` command, not its file tools. The Studio's own
 * pi asks the author before what loses work or stops the Studio; a subagent runs with no one to ask, so that is
 * refused too, its reason said, for the conversation that started it to ask.
 */
export default function studioGuard(pi) {
	pi.on('tool_call', (event, context) => {
		const article = articleWriteOf(event.toolName, event.input, context?.cwd ?? process.cwd());
		if (article) return { block: true, reason: article };
		if (event.toolName !== 'bash' || typeof event.input?.command !== 'string') return undefined;
		const risk = riskOf(event.input.command, context?.cwd ?? process.cwd());
		if (!risk) return undefined;
		return { block: true, reason: risk.refuse ? risk.why : `${risk.why}（子代理不能问作者，要做的话交回给主对话，由它问作者）` }; // i18n-ignore: said to the AI
	});
}
