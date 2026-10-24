// A stand-in for the coding agents (claude, codex, pi): started in the terminal, it says where it is; run by itself
// (Alt+Enter, `-p`), it does what it is told the way blog/AGENTS.md asks: the lines it names in index.md become the
// result, and ai/work/log.md gets a line saying whether it went on from the last talk.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
if (!args.includes('-p')) {
	console.log(`fake-claude in ${basename(process.cwd())} for ${process.env.STUDIO_ARTICLE ?? 'none'}`);
	process.exit(0);
}
const prompt = args.at(-1);
const [, start, end] = /第 (\d+)(?:–(\d+))? 行/u.exec(prompt) ?? [];
const asked = prompt.split('\n')[2] ?? '';
const lines = readFileSync('index.md', 'utf8').split('\n');
lines.splice(Number(start) - 1, Number(end ?? start) - Number(start) + 1, `结果：${asked}（替身）`);
writeFileSync('index.md', lines.join('\n'));
mkdirSync('ai/work', { recursive: true });
appendFileSync('ai/work/log.md', `- ${asked}；接着上次：${args.includes('--continue') ? '是' : '否'}\n`);
console.log(`做完了：${asked}`);
