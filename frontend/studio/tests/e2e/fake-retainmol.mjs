// RetainMol as the browser tests need it: a page that speaks its embedded
// mode's messages (RetainMol's app/embed.ts) without starting RetainMol. It
// shows what it was given; 改结构 sends back methanol as built (BUILT_XYZ,
// BUILT_MOL in studio.ts); 保存 is ⌘S in its frame. The Studio is pointed at
// it with STUDIO_RETAINMOL_URL.
import { createServer } from 'node:http';

import { BUILT_MOL, BUILT_XYZ } from './built-molecule.mjs';

const page = `<!doctype html><meta charset="utf-8"><title>retainmol</title>
<p id="loaded">（空）</p><button id="build">改结构</button><button id="save">保存</button>
<script>
const origin = new URL(new URLSearchParams(location.search).get('parent')).origin;
const post = (message) => parent.postMessage({ protocol: 'retainmol-embed', ...message }, origin);
const built = { mol: ${JSON.stringify(BUILT_MOL)}, xyz: ${JSON.stringify(BUILT_XYZ)}, atoms: 6, formula: 'CH4O' };
addEventListener('message', (event) => {
  if (event.origin !== origin || event.data?.protocol !== 'retainmol-embed' || event.data.type !== 'load') return;
  document.querySelector('#loaded').textContent = event.data.text.split('\\n').slice(0, 2).join(' / ');
  post({ type: 'loaded', atoms: 3 });
  if (event.data.report) post({ type: 'changed', ...built });
});
document.querySelector('#build').onclick = () => post({ type: 'changed', ...built });
document.querySelector('#save').onclick = () => post({ type: 'save' });
post({ type: 'ready' });
</script>`;

const port = Number(process.env.FAKE_RETAINMOL_PORT ?? 4999);
createServer((request, response) => {
	response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
	response.end(page);
}).listen(port, '127.0.0.1', () => console.log(`fake RetainMol on http://127.0.0.1:${port}`));
