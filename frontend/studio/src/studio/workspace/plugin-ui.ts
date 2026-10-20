import type { CommandContext, StudioCommand, StudioPanel } from '@blog/kernel/ui.ts';

import { pluginCommands, pluginPanels } from '../plugins';
import { showToast } from './toast';

/**
 * Where the plugins' tabs and commands (`ctx.panels`, `ctx.commands`) show
 * in the Studio, kept in step with them: their tabs in the right column,
 * their buttons in the left one, their shortcuts. The slash menu
 * (block-slash-menu.ts) and the page's ⋯ menu (main.ts) read the commands
 * when they are made.
 */

/** Runs a command; what goes wrong is said in red, with its name. */
export function runCommand(command: StudioCommand, from: CommandContext['from']): void {
	void Promise.resolve()
		.then(() => command.run({ from }))
		.catch((error: unknown) => {
			console.error(`[plugins] 命令 ${command.id}`, error);
			showToast(`${command.label}：${error instanceof Error ? error.message : String(error)}`, true);
		});
}

/** An icon of a command: an SVG (the plugin's own code, as trusted as the rest of it), or a character. */
function setIcon(element: HTMLElement, icon: string | undefined): void {
	if (icon?.trimStart().startsWith('<svg')) element.innerHTML = icon;
	else element.textContent = icon || '•';
}

export type PluginUiHost = {
	/** The right column: its tabs are these plugins' too. */
	setPanels(panels: StudioPanel[]): void;
	/** Where the commands shown in the left column go. */
	sidebar: HTMLElement;
};

/** Once the plugins have started: follows their tabs and commands from then on. */
export function showPluginUi(host: PluginUiHost): void {
	const panels = pluginPanels();
	const commands = pluginCommands();
	if (!panels || !commands) return;

	const drawPanels = () => host.setPanels(panels.list());
	const drawSidebar = () => {
		const buttons = commands.list('sidebar').map((command) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.dataset.command = command.id;
			const icon = document.createElement('span');
			icon.setAttribute('aria-hidden', 'true');
			setIcon(icon, command.icon);
			button.append(icon, command.label);
			button.addEventListener('click', () => runCommand(command, 'sidebar'));
			return button;
		});
		host.sidebar.replaceChildren(...buttons);
		host.sidebar.hidden = buttons.length === 0;
	};
	panels.watch(drawPanels);
	commands.watch(drawSidebar);
	drawPanels();
	drawSidebar();

	// After the editor's and the Studio's own keys: what they took (defaultPrevented) is theirs.
	document.addEventListener('keydown', (event) => {
		if (event.defaultPrevented || event.isComposing || event.repeat) return;
		const command = commands.forKey(event);
		if (!command) return;
		event.preventDefault();
		runCommand(command, 'keys');
	});
}
