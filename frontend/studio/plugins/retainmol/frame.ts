import { t } from '@blog/i18n/index.mjs';
import type { BuiltMolecule } from '@blog/kernel/studio.ts';
import { sheetOverlay } from '@blog/ui/block-sheet.ts';
import './frame.css';

/**
 * RetainMol, the author's molecule editor, in a sheet: its 2D editor
 * (chem-structura) and its 3D builder side by side, with its inspector
 * (elements, hybridization, rings, fragments, PubChem, clean-up). It is
 * built and served by retainmol-host.mjs (server.mjs); here it is in its embedded mode,
 * which takes a structure and tells every change to it:
 *
 *     page → frame   { protocol: 'retainmol-embed', type: 'load', text, report? }
 *     frame → page   ready · changed { mol, xyz, atoms, formula } · loaded · error · save
 *
 * One frame for the page, loaded once (soon after the Studio opens) and
 * kept in the sheet's kept layer: a sheet that shows RetainMol puts it over
 * its tab and gives it its molecule, a new session each time. So a sheet
 * opens on it at once. Messages are taken only from that frame.
 */

export type RetainmolFrame = {
	/** Puts a structure in (MOL/SDF, XYZ, GJF; empty for an empty canvas); `report` sends back what it became (a flat one made 3D). */
	load(text: string, options?: { report?: boolean }): void;
	/** Lets the frame go (it stays loaded, hidden, for the next sheet). */
	dispose(): void;
};

type Attachment = {
	host: HTMLElement;
	status: HTMLElement;
	changed(molecule: BuiltMolecule): void;
	failed?(message: string): void;
	pending: { text: string; report: boolean } | null;
};

const PROTOCOL = 'retainmol-embed';

/** Where RetainMol is served (asked of the dev server), and what saves the article (⌘S pressed in the frame, which the page does not hear). */
let studio: { address(): Promise<string>; save(): void } | null = null;

export function setRetainmolStudio(given: { address(): Promise<string>; save(): void } | null): void {
	studio = given;
}

const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'night' : 'day');

let shared: Promise<{ frame: HTMLIFrameElement; origin: string }> | null = null;
let ready = false;
let attached: Attachment | null = null;
let following = 0;
/** Takes the frame and its listeners away. */
let closing: (() => void) | null = null;

function send(message: Record<string, unknown>): void {
	void shared?.then(({ frame, origin }) => frame.contentWindow?.postMessage({ protocol: PROTOCOL, ...message }, origin));
}

function deliver(attachment: Attachment): void {
	if (!ready || !attachment.pending) return;
	send({ type: 'load', ...attachment.pending });
	attachment.pending = null;
}

/** The page's one frame: RetainMol served, its frame made in the sheet's kept layer, listened to. */
function sharedFrame(): Promise<{ frame: HTMLIFrameElement; origin: string }> {
	shared ??= (async () => {
		if (!studio) throw new Error(t('RetainMol 没有准备好'));
		const address = await studio.address();
		const origin = new URL(address).origin;
		const frame = document.createElement('iframe');
		frame.className = 'retainmol-frame';
		frame.title = t('RetainMol 分子编辑器');
		frame.allow = 'clipboard-read; clipboard-write';
		frame.hidden = true;
		frame.src = `${address}/?embed=1&parent=${encodeURIComponent(location.origin)}&theme=${theme()}`;
		const listen = (event: MessageEvent) => {
			if (event.origin !== origin || event.source !== frame.contentWindow) return;
			const message = event.data as ({ protocol?: string; type?: string; message?: string } & Partial<BuiltMolecule>) | null;
			if (message?.protocol !== PROTOCOL) return;
			if (message.type === 'ready') {
				ready = true;
				if (attached) {
					attached.status.remove();
					deliver(attached);
				}
			} else if (message.type === 'changed' && typeof message.mol === 'string' && typeof message.xyz === 'string') {
				attached?.changed({ mol: message.mol, xyz: message.xyz, atoms: Number(message.atoms) || 0, formula: String(message.formula ?? '') });
			} else if (message.type === 'error') {
				attached?.failed?.(message.message ?? t('RetainMol 读不了这个结构'));
			} else if (message.type === 'save') {
				studio?.save();
			}
		};
		const retheme = () => send({ type: 'theme', theme: theme() });
		window.addEventListener('message', listen);
		window.addEventListener('themechange', retheme);
		sheetOverlay().append(frame);
		closing = () => {
			window.removeEventListener('message', listen);
			window.removeEventListener('themechange', retheme);
			frame.remove();
		};
		return { frame, origin };
	})();
	shared.catch(() => {
		shared = null;
	});
	return shared;
}

/** Keeps the frame over the tab it is given to while that tab is shown, hidden when it is not. */
function follow(frame: HTMLIFrameElement, attachment: Attachment): void {
	const turn = ++following;
	const place = () => {
		if (turn !== following || attached !== attachment) return;
		const box = attachment.host.getBoundingClientRect();
		const layer = frame.parentElement?.getBoundingClientRect();
		const shown = attachment.host.isConnected && box.width > 0 && box.height > 0 && layer;
		frame.hidden = !shown || !ready;
		if (shown) {
			const style = `left:${box.left - layer.left}px;top:${box.top - layer.top}px;width:${box.width}px;height:${box.height}px`;
			if (frame.getAttribute('style') !== style) frame.setAttribute('style', style);
		}
		requestAnimationFrame(place);
	};
	// Placed at once: what it is given next is laid out (fitted in view) at the size it is shown at.
	place();
}

/** The frame gone, and what listened to it (the plugin is taken out, or loaded again). */
export function closeRetainmol(): void {
	closing?.();
	closing = null;
	shared = null;
	ready = false;
	attached = null;
	following += 1;
}

/** Loads RetainMol now, hidden, so that the first sheet to want it has it at once. */
export function preloadRetainmol(): void {
	void sharedFrame().catch(() => {
		// Said when a sheet asks for it.
	});
}

/**
 * RetainMol over `host` (which the frame covers while it is shown) on
 * `text` (nothing: an empty canvas to build on). `changed` is told the
 * molecule after every edit.
 */
export async function openRetainmol(
	host: HTMLElement,
	{ text, report = false, changed, failed }: { text: string; report?: boolean; changed(molecule: BuiltMolecule): void; failed?(message: string): void },
): Promise<RetainmolFrame> {
	host.classList.add('retainmol');
	const status = document.createElement('p');
	status.className = 'retainmol-status';
	status.textContent = shared ? t('正在载入 RetainMol…') : t('正在准备 RetainMol…（RetainMol 的代码改过之后，第一次要重新打包，约一分钟）');
	host.replaceChildren(status);
	const attachment: Attachment = { host, status, changed, failed, pending: { text, report } };
	attached = attachment;

	const { frame } = await sharedFrame();
	if (attached !== attachment) return { load: () => {}, dispose: () => {} };
	if (ready) status.remove();
	else status.textContent = t('正在载入 RetainMol…');
	follow(frame, attachment);
	deliver(attachment);

	return {
		load: (next, options = {}) => {
			if (attached !== attachment) return;
			attachment.pending = { text: next, report: Boolean(options.report) };
			deliver(attachment);
		},
		dispose: () => {
			if (attached !== attachment) return;
			attached = null;
			following += 1;
			frame.hidden = true;
			host.classList.remove('retainmol');
		},
	};
}
