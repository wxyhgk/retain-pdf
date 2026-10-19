#!/usr/bin/env node
// Brings RetainMol's 3D molecule editor (@retainmol/core, @retainmol/viewer)
// into third_party/retainmol/, as the packages npm installs from:
//
//     npm run retainmol:update [-- ../RetainMol]
//
// The last commit of that checkout is cloned into a temporary folder and
// built there, so the checkout itself (its uncommitted work, its dist/) is
// left as it is. Kept here: the two packages as npm packs them, the Tailwind
// utilities the viewer's overlays use (without Tailwind's reset of the page),
// and which commit they are from. Then `npm install` takes them up.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const source = resolve(repository, process.argv[2] ?? '../RetainMol');
const target = join(repository, 'third_party', 'retainmol');
const work = mkdtempSync(join(tmpdir(), 'retainmol-'));
const clone = join(work, 'retainmol');
const run = (command, args, cwd = clone) => execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).trim();
const say = (text) => console.log(`[retainmol] ${text}`);

try {
	say(`cloning the last commit of ${source}`);
	run('git', ['clone', '--quiet', '--no-hardlinks', source, clone], work);
	const commit = run('git', ['rev-parse', 'HEAD']);
	const date = run('git', ['log', '-1', '--format=%ci']);
	say(`commit ${commit.slice(0, 10)} (${date}); installing its dependencies`);
	run('npm', ['ci', '--prefer-offline', '--ignore-scripts', '--no-audit', '--no-fund']);
	for (const name of ['@retainmol/core', '@retainmol/viewer']) {
		say(`building ${name}`);
		run('npm', ['run', 'build', '--workspace', name]);
	}

	rmSync(target, { recursive: true, force: true });
	mkdirSync(target, { recursive: true });
	const packs = {};
	for (const folder of ['core', 'viewer']) {
		const file = run('npm', ['pack', '--silent', '--pack-destination', target], join(clone, 'packages', folder)).split('\n').at(-1);
		packs[folder] = file;
		say(`packed ${file}`);
	}

	// The viewer's overlays are written with Tailwind's classes; the Studio has no Tailwind.
	// Its theme and utilities only, no preflight: nothing of the page around it is reset.
	say('making the Tailwind utilities the viewer uses');
	// Made where RetainMol's app has Tailwind installed, so that its version is the one the viewer was written for.
	const app = join(clone, 'apps', 'retainmol');
	const css = join(app, 'studio-viewer.css');
	writeFileSync(css, `@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities);\n@source "../../packages/viewer/dist";\n`);
	const version = JSON.parse(run('npm', ['ls', 'tailwindcss', '--json', '--depth', '0'], app)).dependencies?.tailwindcss?.version ?? '4';
	run('npx', ['--yes', `@tailwindcss/cli@${version}`, '-i', css, '-o', join(target, 'viewer.css'), '--minify'], app);

	writeFileSync(
		join(target, 'SOURCE.md'),
		[
			'# RetainMol',
			'',
			`由 \`npm run retainmol:update\` 从 RetainMol 生成（https://github.com/wxyhgk/retain-mol），不要手改。`,
			'',
			`- 提交：\`${commit}\`（${date}）`,
			`- 包：\`${packs.core}\`、\`${packs.viewer}\``,
			'- `viewer.css`：viewer 界面用到的 Tailwind 工具类（不含 Tailwind 的全局重置）',
			'',
		].join('\n'),
	);
	say(`done: ${readdirSync(target).join(', ')}`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
