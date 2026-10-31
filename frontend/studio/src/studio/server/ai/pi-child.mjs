#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { studioSettingsFile } from '../locale-settings.mjs';
import { PiModels } from './panel-models.mjs';

/**
 * pi started again as a process of its own by the pi in the Studio's server (pi-agent.mjs): what pi's extensions start
 * when they start pi. Its subagent extension runs `process.argv[1]` with pi's options, taking that for pi's own
 * program; in the Studio's server that was the server itself (serve.mjs), and each subagent started a second Studio,
 * which fell over. So pi-agent.mjs names this one there, and this is pi, as the Studio's pi is:
 *
 * - the environment the Studio gives its AIs (`studio` on PATH, the notes, the drive, git that pushes nowhere: what
 *   pi-agent.mjs leaves in STUDIO_PI_CHILD_ENV), and the key of each service pi may use (.studio-settings.json, as
 *   panel-models.mjs reads it; never handed over in the environment, which every program the Studio starts sees);
 * - what may not be done refused (pi-child-guard.mjs): a subagent has no one to ask, so what the Studio's pi asks the
 *   author first (deleting folders, throwing changes away, stopping a server) it may not do at all;
 * - then pi's own command line, with the options it was given.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CLI = join(ROOT, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'bundle', 'cli.js');
const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'pi-child-guard.mjs');

/** The environment the Studio's pi runs in, its keys left out (pi-agent.mjs `childEnv`). */
function handedOver() {
	try {
		const env = JSON.parse(process.env.STUDIO_PI_CHILD_ENV ?? '{}');
		return env && typeof env === 'object' && !Array.isArray(env) ? env : {};
	} catch {
		return {};
	}
}

Object.assign(process.env, handedOver());
delete process.env.STUDIO_PI_CHILD_ENV;
try {
	Object.assign(process.env, await new PiModels(studioSettingsFile(ROOT), join(ROOT, 'node_modules', '.bin')).env());
} catch {
	// No key filled in for the service chosen: pi says so itself, as it starts.
}
process.argv = [process.argv[0], CLI, '--extension', GUARD, ...process.argv.slice(2)];
await import(pathToFileURL(CLI).href);
