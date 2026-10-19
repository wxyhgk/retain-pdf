import './retainmol-frame.css';

/**
 * RetainMol, the author's molecule editor, in a frame of a sheet: Ketcher's
 * 2D sketch and its 3D builder side by side, with its inspector (elements,
 * hybridization, rings, fragments, PubChem, clean-up). It runs as a project
 * of its own (retainmol-host.mjs starts it); here it is in its embedded
 * mode, which takes a structure and tells every change to it:
 *
 *     page → frame   { protocol: 'retainmol-embed', type: 'load', text, report? }
 *     frame → page   ready · changed { mol, xyz, atoms, formula } · loaded · error · save
 *
 * Messages are taken only from that frame, at RetainMol's address.
 */

export type BuiltMolecule = { mol: string; xyz: string; atoms: number; formula: string };

export type RetainmolFrame = {
	/** Puts a structure in (MOL/SDF, XYZ, GJF); `report` sends back what it became (a flat one made 3D). */
	load(text: string, options?: { report?: boolean }): void;
	dispose(): void;
};

const PROTOCOL = 'retainmol-embed';

/** What saves the article (⌘S pressed in the frame, which the page does not hear). */
let saveArticle: (() => void) | null = null;

export function setRetainmolSave(save: () => void): void {
	saveArticle = save;
}

async function retainmolUrl(): Promise<string> {
	const response = await fetch('/api/studio/retainmol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
	const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
	if (!response.ok || !data.url) throw new Error(data.error || 'RetainMol 没能启动');
	return data.url;
}

const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'night' : 'day');

/**
 * RetainMol in `host`, which it fills, on `text` (nothing: an empty canvas
 * to build on). `changed` is told the molecule after every edit.
 */
export async function openRetainmol(
	host: HTMLElement,
	{ text, report = false, changed, failed }: { text: string; report?: boolean; changed(molecule: BuiltMolecule): void; failed?(message: string): void },
): Promise<RetainmolFrame> {
	host.classList.add('retainmol');
	const status = document.createElement('p');
	status.className = 'retainmol-status';
	status.textContent = '正在启动 RetainMol…（第一次要构建它的包，约一分钟）';
	host.replaceChildren(status);

	const url = await retainmolUrl();
	const origin = new URL(url).origin;
	const frame = document.createElement('iframe');
	frame.className = 'retainmol-frame';
	frame.title = 'RetainMol 分子编辑器';
	frame.src = `${url}/?embed=1&parent=${encodeURIComponent(location.origin)}&theme=${theme()}`;
	frame.allow = 'clipboard-read; clipboard-write';
	status.textContent = '正在载入 RetainMol…';
	host.append(frame);

	const send = (message: Record<string, unknown>) => frame.contentWindow?.postMessage({ protocol: PROTOCOL, ...message }, origin);
	let pending: { text: string; report: boolean } | null = text.trim() ? { text, report } : null;
	let ready = false;

	const onMessage = (event: MessageEvent) => {
		if (event.origin !== origin || event.source !== frame.contentWindow) return;
		const data = event.data as ({ protocol?: string; type?: string; message?: string } & Partial<BuiltMolecule>) | null;
		if (data?.protocol !== PROTOCOL) return;
		if (data.type === 'ready') {
			ready = true;
			status.remove();
			if (pending) send({ type: 'load', ...pending });
			pending = null;
		} else if (data.type === 'changed' && typeof data.mol === 'string' && typeof data.xyz === 'string') {
			changed({ mol: data.mol, xyz: data.xyz, atoms: Number(data.atoms) || 0, formula: String(data.formula ?? '') });
		} else if (data.type === 'error') {
			failed?.(data.message ?? 'RetainMol 读不了这个结构');
		} else if (data.type === 'save') {
			saveArticle?.();
		}
	};
	window.addEventListener('message', onMessage);
	const onTheme = () => send({ type: 'theme', theme: theme() });
	window.addEventListener('themechange', onTheme);

	return {
		load: (next, options = {}) => {
			if (ready) send({ type: 'load', text: next, report: Boolean(options.report) });
			else pending = { text: next, report: Boolean(options.report) };
		},
		dispose: () => {
			window.removeEventListener('message', onMessage);
			window.removeEventListener('themechange', onTheme);
			frame.remove();
			host.classList.remove('retainmol');
		},
	};
}
