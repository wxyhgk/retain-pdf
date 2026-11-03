import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { articleBundlePaths, resolveInside } from '../../../src/articles/bundle-paths.mjs';
import { ArticleRepository } from '../../../src/studio/server/articles/article-repository.mjs';
import { atomicWriteText } from '../../../src/studio/server/files/atomic-write.mjs';
import { ComputeHosts, readHost } from '../server/compute-hosts.mjs';
import { JobShell, shellPath, shellWord } from '../server/job-shell.mjs';
import { JobRuns, runScript } from '../server/job-runs.mjs';
import { crest } from '../../crest/program.mjs';
import { xtb } from '../../xtb/program.mjs';

/** The programs, as `ctx.jobs` has them with their plugins on. */
const jobPrograms = { get: (name) => [xtb, crest].find((program) => program.name === name) ?? null, list: () => [xtb, crest] };

/** The dev server's `ctx.server.files` for these articles. */
const filesOf = (blogRoot) => ({ articleFolder: (slug) => articleBundlePaths(blogRoot, slug).directory, inside: resolveInside, writeText: atomicWriteText });

// A program that behaves as xtb does, as far as the runs care: it prints as
// it goes, writes its results and scratch files, and ends with a code.
// `--steps N --sleep S --exit C` say how.
const FAKE_XTB = `#!/bin/bash
steps=3; pause=0.05; code=0; spam=0
while [ $# -gt 0 ]; do case "$1" in --steps) steps=$2; shift;; --sleep) pause=$2; shift;; --exit) code=$2; shift;; --spam) spam=$2; shift;; esac; shift; done
echo "   * xtb version 6.7.1 (fake)"
for i in $(seq 1 "$spam"); do echo "OpenBLAS Warning : Detect OpenMP Loop and this application may hang."; done
echo "threads=$OMP_NUM_THREADS"
for i in $(seq 1 "$steps"); do
  printf '%s\\n' "........................ CYCLE    $i ........................" " * total energy  :    -5.08$i Eh     change  -0.1E-03 Eh" "   gradient norm :     0.00$i Eh/α   predicted"
  sleep "$pause"
done
printf '3\\n energy: -5.085 gnorm: 0.0001 xtb: 6.7.1\\nO 0 0 0.1\\nH 0 0.77 -0.46\\nH 0 -0.77 -0.46\\n' > xtbopt.xyz
echo restart > xtbrestart
echo "normal termination of xtb"
exit "$code"
`;

// ssh as far as a test needs: options and the host are dropped, the command runs here.
const FAKE_SSH = `#!/bin/bash
while [ $# -gt 0 ]; do case "$1" in -o) shift 2;; --) shift; break;; *) break;; esac; done
host=$1; shift
[ "$host" = unreachable ] && { echo "ssh: connect to host unreachable port 22: Operation timed out" >&2; exit 255; }
exec bash -c "$*"
`;

// Slurm as far as a test needs: a job is a process, its number in jobs/.
const FAKE_SBATCH = `#!/bin/bash
for a in "$@"; do case "$a" in --chdir=*) cd "\${a#--chdir=}";; esac; done
script="\${@: -1}"
mkdir -p "$FAKE_SLURM/jobs"; id=$(( $(ls "$FAKE_SLURM/jobs" | wc -l) + 101 ))
nohup bash "$script" > /dev/null 2>&1 < /dev/null & echo $! > "$FAKE_SLURM/jobs/$id"
echo "$id"
`;
const FAKE_SQUEUE = `#!/bin/bash
while [ $# -gt 0 ]; do [ "$1" = -j ] && id=$2; shift; done
pid=$(cat "$FAKE_SLURM/jobs/$id" 2>/dev/null) || exit 0
kill -0 "$pid" 2>/dev/null && echo RUNNING
true
`;
const FAKE_SCANCEL = `#!/bin/bash
kill "$(cat "$FAKE_SLURM/jobs/$1")"
`;

const WATER = '3\nwater\nO 0 0 0.1173\nH 0 0.7572 -0.4692\nH 0 -0.7572 -0.4692\n';

async function fixture(t) {
	const project = await mkdtemp(join(tmpdir(), 'studio-jobs-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	await new ArticleRepository(blogRoot).create({ slug: 'note', title: 'Note' });
	const bin = join(project, 'bin');
	await mkdir(bin);
	for (const [name, text] of Object.entries({ xtb: FAKE_XTB, ssh: FAKE_SSH, sbatch: FAKE_SBATCH, squeue: FAKE_SQUEUE, scancel: FAKE_SCANCEL })) {
		await writeFile(join(bin, name), text);
		await chmod(join(bin, name), 0o755);
	}
	const previous = { PATH: process.env.PATH, FAKE_SLURM: process.env.FAKE_SLURM };
	process.env.PATH = `${bin}:${process.env.PATH}`;
	process.env.FAKE_SLURM = join(project, 'slurm');
	t.after(() => Object.assign(process.env, previous));
	const hosts = new ComputeHosts(join(project, '.studio-settings.json'));
	const programs = { xtb: join(bin, 'xtb') };
	await hosts.save([
		{ name: 'local', kind: 'local', workdir: join(project, 'work-local'), threads: 2, programs },
		{ name: 'far', label: '远处', kind: 'ssh', ssh: 'far-box', workdir: join(project, 'work-far'), threads: 8, programs },
		{ name: 'queue', kind: 'ssh', ssh: 'login', scheduler: 'slurm', partition: 'batch', workdir: join(project, 'work-queue'), threads: 4, programs },
		{ name: 'gone', kind: 'ssh', ssh: 'unreachable', workdir: join(project, 'work-gone'), programs },
	]);
	const shellFor = (host) => new JobShell(host, { ssh: join(bin, 'ssh') });
	const stateFile = join(project, '.studio-jobs.json');
	const runs = new JobRuns(filesOf(blogRoot), { programs: jobPrograms, hosts, stateFile, shellFor, intervals: { local: 30, ssh: 30, slurm: 30 }, limits: { live: 20_000, tail: 4_000, result: 50_000 } });
	t.after(() => runs.close());
	const article = join(blogRoot, 'note');
	return { project, blogRoot, hosts, shellFor, stateFile, runs, article };
}

const record = async (article, id, run) => JSON.parse(await readFile(join(article, 'assets', 'jobs', id, run, 'run.json'), 'utf8'));

async function until(read, check, timeout = 8000) {
	const end = Date.now() + timeout;
	for (;;) {
		const value = await read();
		if (check(value)) return value;
		if (Date.now() > end) assert.fail(`not reached in time: ${JSON.stringify(value)}`);
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
	}
}

test('a run here: kept in the article with what was run, its output and results, its scratch left behind', async (t) => {
	const { runs, article, project } = await fixture(t);
	const started = await runs.start('note', { id: 'water-opt', program: 'xtb', args: '--opt tight', host: 'local', body: WATER });
	assert.equal(started.state, 'preparing');
	assert.match(started.run, /^\d{8}-\d{6}$/u);
	assert.equal(started.command, 'xtb input.xyz --opt tight --parallel 2');
	assert.equal(await readFile(join(article, 'assets/jobs/water-opt', started.run, 'input.xyz'), 'utf8'), WATER);

	const done = await until(() => record(article, 'water-opt', started.run), (value) => value.state === 'done');
	assert.equal(done.exitCode, 0);
	assert.equal(done.host, 'local');
	assert.ok(done.started && done.finished);
	assert.deepEqual(done.files, ['input.xyz', 'xtb.out', 'xtbopt.xyz']);
	const output = await readFile(join(article, 'assets/jobs/water-opt', started.run, 'xtb.out'), 'utf8');
	assert.match(output, /threads=2\n[\s\S]*CYCLE {4}3[\s\S]*normal termination of xtb/u);
	// The machine's own folder keeps the whole run, the script included.
	assert.ok((await readdir(join(project, 'work-local/note/water-opt', started.run))).includes('xtbrestart'));
	assert.deepEqual(JSON.parse(await readFile(join(project, '.studio-jobs.json'), 'utf8')).runs, {});
	assert.deepEqual((await runs.list('note', 'water-opt')).map((run) => run.state), ['done']);
});

test('a run that fails, one stopped, and one started again: each is kept', async (t) => {
	const { runs, article } = await fixture(t);
	const failed = await runs.start('note', { id: 'job-a', program: 'xtb', args: '--exit 3', host: 'local', body: WATER });
	const failedRecord = await until(() => record(article, 'job-a', failed.run), (value) => value.state === 'failed');
	assert.equal(failedRecord.exitCode, 3);

	const long = await runs.start('note', { id: 'job-a', program: 'xtb', args: '--steps 200 --sleep 0.05', host: 'local', body: WATER });
	assert.notEqual(long.run, failed.run);
	await until(() => record(article, 'job-a', long.run), (value) => value.state === 'running');
	await until(() => readFile(join(article, 'assets/jobs/job-a', long.run, 'xtb.out'), 'utf8').catch(() => ''), (text) => text.includes('CYCLE    2'));
	await runs.cancel('note', 'job-a', long.run);
	const stopped = await until(() => record(article, 'job-a', long.run), (value) => value.state === 'cancelled');
	assert.equal(stopped.error, null);
	assert.ok(stopped.files.includes('xtb.out'));
	assert.deepEqual((await runs.list('note', 'job-a')).map((run) => run.state), ['cancelled', 'failed']);
});

test('a run on a machine reached by ssh: its output followed as it grows', async (t) => {
	const { runs, article } = await fixture(t);
	const started = await runs.start('note', { id: 'far-job', program: 'xtb', args: '--steps 30 --sleep 0.05', host: 'far', threads: 6, body: WATER });
	assert.equal(started.hostLabel, '远处');
	assert.equal(started.command, 'xtb input.xyz --steps 30 --sleep 0.05 --parallel 6');
	// Partway: the output so far is here already.
	const partial = await until(() => readFile(join(article, 'assets/jobs/far-job', started.run, 'xtb.out'), 'utf8').catch(() => ''), (text) => text.includes('CYCLE    3'));
	assert.doesNotMatch(partial, /normal termination/u);
	const done = await until(() => record(article, 'far-job', started.run), (value) => value.state === 'done');
	assert.deepEqual(done.files, ['input.xyz', 'xtb.out', 'xtbopt.xyz']);
	const output = await readFile(join(article, 'assets/jobs/far-job', started.run, 'xtb.out'), 'utf8');
	// Brought over piece by piece, and whole.
	assert.equal(output.match(/CYCLE/gu).length, 30);
});

test('a run handed to Slurm: queued, then run, then done; and stopped with scancel', async (t) => {
	const { runs, article } = await fixture(t);
	const started = await runs.start('note', { id: 'queued', program: 'xtb', args: '--steps 4', host: 'queue', body: WATER });
	assert.equal(started.scheduler, 'slurm');
	const done = await until(() => record(article, 'queued', started.run), (value) => value.state === 'done');
	assert.equal(done.exitCode, 0);
	assert.ok(done.started);

	const long = await runs.start('note', { id: 'queued', program: 'xtb', args: '--steps 400 --sleep 0.05', host: 'queue', body: WATER });
	await until(() => record(article, 'queued', long.run), (value) => value.state === 'running');
	await runs.cancel('note', 'queued', long.run);
	await until(() => record(article, 'queued', long.run), (value) => value.state === 'cancelled');
});

test('the Studio stopped and started again: a run still going is taken up; one whose process went is lost', async (t) => {
	const { runs, article, blogRoot, hosts, shellFor, stateFile, project } = await fixture(t);
	const started = await runs.start('note', { id: 'resumed', program: 'xtb', args: '--steps 12 --sleep 0.05', host: 'local', body: WATER });
	await until(() => record(article, 'resumed', started.run), (value) => value.state === 'running');
	runs.close();
	const again = new JobRuns(filesOf(blogRoot), { programs: jobPrograms, hosts, stateFile, shellFor, intervals: { local: 30 } });
	t.after(() => again.close());
	await again.resume();
	const done = await until(() => record(article, 'resumed', started.run), (value) => value.state === 'done');
	assert.match(await readFile(join(article, 'assets/jobs/resumed', started.run, 'xtb.out'), 'utf8'), /CYCLE {4}12/u);
	assert.equal(done.exitCode, 0);

	const killed = await again.start('note', { id: 'killed', program: 'xtb', args: '--steps 400 --sleep 0.05', host: 'local', body: WATER });
	await until(() => record(article, 'killed', killed.run), (value) => value.state === 'running');
	const pid = Number(await readFile(join(project, 'work-local/note/killed', killed.run, '.pid'), 'utf8'));
	// Killed with the program, as a reboot would: no exit code is left.
	await shellFor(await hosts.get('local')).exec(`kill -STOP ${pid}; pkill -KILL -P ${pid}; kill -KILL ${pid}`);
	const lost = await until(() => record(article, 'killed', killed.run), (value) => value.state === 'lost');
	assert.match(lost.error, /进程不在了/u);
});

test('an output grown too big: its end is kept, saying so; the whole of it stays on the machine', async (t) => {
	const { runs, article, project } = await fixture(t);
	const started = await runs.start('note', { id: 'noisy', program: 'xtb', args: '--spam 2000', host: 'far', body: WATER });
	const done = await until(() => record(article, 'noisy', started.run), (value) => value.state === 'done');
	assert.ok(done.files.includes('xtb.out'));
	const kept = await readFile(join(article, 'assets/jobs/noisy', started.run, 'xtb.out'), 'utf8');
	assert.match(kept, /^\[Studio\] xtb\.out 有 0\.1 MB，这里只有最后 0\.0 MB；完整的文件留在计算机器的运行目录里。\n/u);
	assert.ok(kept.length < 4_200);
	assert.match(kept, /normal termination of xtb\n$/u);
	const whole = await readFile(join(project, 'work-far/note/noisy', started.run, 'xtb.out'), 'utf8');
	assert.ok(whole.length > 100_000);
	// Nothing of macOS's tar on the other end.
	assert.deepEqual((await readdir(join(project, 'work-far/note/noisy', started.run))).filter((name) => name.startsWith('._')), []);
});

test('a machine out of reach: the run fails to start, saying why', async (t) => {
	const { runs, article } = await fixture(t);
	const started = await runs.start('note', { id: 'nowhere', program: 'xtb', args: '', host: 'gone', body: WATER });
	const failed = await until(() => record(article, 'nowhere', started.run), (value) => value.state === 'failed');
	assert.match(failed.error, /^没能开始：.*Operation timed out/u);
});

test('what a run is given is checked first', async (t) => {
	const { runs, article } = await fixture(t);
	const run = (request) => runs.start('note', { id: 'ok', program: 'xtb', host: 'local', body: WATER, ...request });
	await assert.rejects(run({ id: '../up' }), /名字/u);
	await assert.rejects(run({ program: 'g16' }), /不认识的程序 g16/u);
	await assert.rejects(run({ host: 'mars' }), /没有叫 mars 的计算机器/u);
	await assert.rejects(run({ args: '--opt\nrm -rf ~' }), /一行/u);
	await assert.rejects(run({ body: '' }), /还没有结构/u);
	await assert.rejects(run({ body: 'water\nO 0 0 0\n' }), /原子数/u);
	await assert.rejects(run({ body: '@file ../other/secret.xyz' }), /不是页面 img\/ 或 assets\/ 里的文件/u);
	await assert.rejects(run({ body: '@file ./assets/missing.xyz' }), /找不到/u);
	await assert.rejects(run({ body: '@file ./assets/notes.txt' }), /结构文件只能是/u);
	await assert.rejects(runs.start('nope', { id: 'ok', program: 'xtb', host: 'local', body: WATER }), /找不到页面/u);

	// A structure that is a file of the article goes as that file.
	await writeFile(join(article, 'assets', 'mol.sdf'), 'sdf\n');
	const fromFile = await run({ body: '@file ./assets/mol.sdf' });
	assert.equal(fromFile.input, 'input.sdf');
	await until(() => record(article, 'ok', fromFile.run), (value) => value.state === 'done');
});

test('the script a run executes, and the machines as written', () => {
	const script = runScript({ folder: '~/studio-jobs/note/a/1', host: { programs: { xtb: '/opt/x tb/bin/xtb' }, setup: 'module load xtb' }, command: ['xtb', 'input.xyz', "--name=it's"], output: 'xtb.out', threads: 4 });
	assert.equal(script, [
		'#!/bin/bash',
		`cd "$HOME"/'studio-jobs/note/a/1' || exit 1`,
		`export PATH='/opt/x tb/bin':"$PATH"`,
		'module load xtb',
		'export OMP_NUM_THREADS=4 MKL_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 OMP_MAX_ACTIVE_LEVELS=1 OMP_STACKSIZE=4G',
		'ulimit -s unlimited 2>/dev/null',
		`'xtb' 'input.xyz' '--name=it'\\''s' > 'xtb.out' 2>&1`,
		'echo $? > .exit',
		'',
	].join('\n'));
	assert.equal(shellPath('/scratch/a'), `'/scratch/a'`);
	assert.equal(shellWord(`a'b`), `'a'\\''b'`);
	assert.throws(() => readHost({ name: 'Bad Name' }), /小写/u);
	assert.throws(() => readHost({ name: 'a', kind: 'ssh', ssh: '-oProxyCommand=x' }), /ssh 地址/u);
	assert.throws(() => readHost({ name: 'a', workdir: 'relative' }), /完整路径/u);
	assert.deepEqual(readHost({ name: 'q', kind: 'ssh', ssh: 'me@box', scheduler: 'slurm', partition: 'batch', time: '24:00:00', threads: 16 }), {
		name: 'q', label: 'q', kind: 'ssh', scheduler: 'slurm', workdir: '~/studio-jobs', threads: 16, programs: {}, setup: '', ssh: 'me@box', partition: 'batch', time: '24:00:00',
	});
});

test('a run goes on with its article renamed meanwhile (published, renamed by the CLI), and two started at once each have their folder', async (t) => {
	const { runs, blogRoot } = await fixture(t);
	const [first, second] = await Promise.all([
		runs.start('note', { id: 'water-opt', program: 'xtb', args: '--steps 20 --sleep 0.05', host: 'local', body: WATER }),
		runs.start('note', { id: 'water-opt', program: 'xtb', args: '--steps 1', host: 'local', body: WATER }),
	]);
	assert.notEqual(first.run, second.run);
	await until(() => record(join(blogRoot, 'note'), 'water-opt', first.run), (value) => value.state === 'running');
	await rename(join(blogRoot, 'note'), join(blogRoot, 'water'));
	const done = await until(() => record(join(blogRoot, 'water'), 'water-opt', first.run), (value) => value.state === 'done');
	assert.deepEqual(done.files, ['input.xyz', 'xtb.out', 'xtbopt.xyz']);
	assert.match(await readFile(join(blogRoot, 'water', 'assets/jobs/water-opt', first.run, 'xtb.out'), 'utf8'), /normal termination of xtb/u);
});
