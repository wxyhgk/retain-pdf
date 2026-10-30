#!/usr/bin/env node
// The Studio's operations on the command line, for an AI in a terminal (or the author): one per command,
// its answer as JSON on stdout. `studio help` lists them; `studio help <command>` tells what one takes.
//
//   studio page-tree
//   studio create-page --title 基组的选择 --parent hf-project --body @notes.md
//   echo '新的正文' | studio update-page --slug hf-basis --body -
//   studio move-page --slug hf-basis --parent hf-project --after hf-method
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createStudioOps } from '../src/studio/ops/studio-ops.mjs';
import { commandName, OPERATIONS } from '../src/studio/ops/operations.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/** `--key value` pairs; a value `-` is stdin, `@path` that file's text; an array (tags) by commas or the flag again. */
function parseArguments(words, operation) {
	const args = {};
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		if (!word.startsWith('--')) throw new Error(`不认识的参数：${word}（参数写成 --名字 值）`);
		const [key, inline] = word.slice(2).split(/=(.*)/su);
		const schema = operation.input.properties[key];
		if (!schema) throw new Error(`${commandName(operation.name)} 没有参数 --${key}；可用的：${Object.keys(operation.input.properties).map((name) => `--${name}`).join(' ') || '（无）'}`);
		let value = inline ?? words[(index += 1)];
		if (value === undefined) throw new Error(`--${key} 后面缺少值`);
		if (value === '-') value = readFileSync(0, 'utf8');
		else if (value.startsWith('@')) value = readFileSync(value.slice(1), 'utf8');
		if (schema.type === 'number' || schema.type === 'integer') args[key] = Number(value);
		else if (schema.type === 'object') {
			try {
				args[key] = JSON.parse(value);
			} catch {
				throw new Error(`--${key} 要写成 JSON，比如 '{"方法": "B3LYP", "能量": -76.41}'`);
			}
		}
		else if (schema.type === 'array') args[key] = [...(args[key] ?? []), ...value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean)];
		else args[key] = value;
	}
	for (const required of operation.input.required ?? []) {
		if (args[required] === undefined) throw new Error(`${commandName(operation.name)} 需要 --${required}`);
	}
	return args;
}

function help(name) {
	const operation = name && OPERATIONS.find((entry) => commandName(entry.name) === name || entry.name === name);
	if (operation) {
		const lines = [`studio ${commandName(operation.name)}`, '', operation.description, ''];
		for (const [key, schema] of Object.entries(operation.input.properties)) {
			const required = operation.input.required?.includes(key) ? '（必填）' : '';
			lines.push(`  --${key}${required}  ${schema.description ?? ''}${schema.enum ? `（${schema.enum.join(' / ')}）` : ''}`);
		}
		return lines.join('\n');
	}
	return [
		'studio <命令> [--参数 值 …]：博客页面的操作，结果是 JSON。参数值写 - 读标准输入，写 @文件 读那个文件。',
		'',
		...OPERATIONS.map((entry) => `  ${commandName(entry.name).padEnd(16)} ${entry.description.split(/[。：]/u)[0]}`),
		'',
		'studio help <命令>：这个命令的参数。',
	].join('\n');
}

const [command, ...rest] = process.argv.slice(2);
if (!command || command === 'help' || command === '--help' || command === '-h') {
	console.log(help(rest[0]));
	process.exit(0);
}
const operation = OPERATIONS.find((entry) => commandName(entry.name) === command || entry.name === command);
if (!operation) {
	console.error(`不认识的命令：${command}\n\n${help()}`);
	process.exit(2);
}
try {
	const result = await operation.run(createStudioOps({ root }), parseArguments(rest, operation));
	console.log(JSON.stringify(result ?? null, null, 2));
} catch (error) {
	console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
	process.exit(1);
}
