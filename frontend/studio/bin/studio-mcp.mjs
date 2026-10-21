#!/usr/bin/env node
// The Studio's operations as an MCP server (stdio): each one a tool, with what it takes as its input
// schema (src/studio/ops/operations.mjs). Messages are JSON-RPC 2.0, one per line; stdout carries them
// alone, anything else goes to stderr. Registered for Claude Code in the project's .mcp.json.
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { createStudioOps } from '../src/studio/ops/studio-ops.mjs';
import { OPERATIONS } from '../src/studio/ops/operations.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ops = createStudioOps({ root });
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = [
	'「计算化学手记」博客的页面：每篇是 blog/<文件夹名>/index.md（普通 Markdown，开头 YAML 属性）。',
	'页面可以挂在别的页面下面（属性 parent），组成一棵树；新建的都是草稿。',
	'写作约定见 blog/CLAUDE.md。改页面优先用这些工具：它们会顺带改好链接、存历史版本、复制图片。',
].join('\n');

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(message) {
	const { id, method, params } = message;
	const isRequest = id !== undefined && id !== null;
	switch (method) {
		case 'initialize': {
			const asked = params?.protocolVersion;
			return reply(id, {
				protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
				capabilities: { tools: {} },
				serverInfo: { name: 'studio', version: '1.0.0' },
				instructions: INSTRUCTIONS,
			});
		}
		case 'ping':
			return reply(id, {});
		case 'tools/list':
			return reply(id, { tools: OPERATIONS.map((operation) => ({ name: operation.name, description: operation.description, inputSchema: operation.input })) });
		case 'tools/call': {
			const operation = OPERATIONS.find((entry) => entry.name === params?.name);
			if (!operation) return fail(id, -32602, `没有这个工具：${params?.name}`);
			const args = params?.arguments ?? {};
			const missing = (operation.input.required ?? []).filter((key) => args[key] === undefined);
			if (missing.length) return reply(id, { content: [{ type: 'text', text: `缺少参数：${missing.join('、')}` }], isError: true });
			try {
				const result = await operation.run(ops, args);
				const content = [{ type: 'text', text: JSON.stringify(result ?? null, null, 2) }];
				// An object goes as structured content too; a list is wrapped, as that must be an object.
				const structured = result && typeof result === 'object' ? (Array.isArray(result) ? { items: result } : result) : undefined;
				return reply(id, { content, ...(structured ? { structuredContent: structured } : {}), isError: false });
			} catch (error) {
				return reply(id, { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true });
			}
		}
		default:
			// Notifications (initialized, cancelled) need no answer.
			if (isRequest) return fail(id, -32601, `不支持的方法：${method}`);
	}
}

const lines = createInterface({ input: process.stdin });
lines.on('line', (line) => {
	if (!line.trim()) return;
	let message;
	try {
		message = JSON.parse(line);
	} catch {
		return fail(null, -32700, '不是 JSON');
	}
	handle(message).catch((error) => {
		console.error(error);
		if (message?.id !== undefined) fail(message.id, -32603, error instanceof Error ? error.message : String(error));
	});
});
