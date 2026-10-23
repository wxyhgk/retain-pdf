import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ensembleTable, parseCrestOutput } from '../parsers/crest.ts';
import { parseG98Modes, parseVibSpectrum, parseXtbOutput } from '../parsers/xtb.ts';
import { formulaOf, frameToXyz, parseXyzFrames } from '../parsers/xyz-frames.ts';

// Real outputs: xtb 6.7.1 and CREST 3.0.2 from conda-forge, on water and ethanol.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('a single point: the summary, the orbitals, the dipole, the time', () => {
	const out = parseXtbOutput(fixture('xtb-sp.out'));
	assert.equal(out.version, '6.7.1');
	assert.equal(out.call, 'xtb water.xyz --gfn 2');
	assert.equal(out.terminated, true);
	assert.deepEqual(out.errors, []);
	assert.equal(out.energy, -5.070370761845);
	assert.equal(out.gradientNorm, 0.007221585093);
	assert.equal(out.gap, 14.629673576893);
	assert.equal(out.homo, -12.1769);
	assert.equal(out.lumo, 2.4528);
	assert.equal(out.dipole, 2.271);
	assert.equal(out.optimization, null);
	assert.equal(out.solvation, null);
	assert.equal(out.enthalpy, null);
	assert.equal(out.wallTime, 0.006);
});

test('an optimization in water: its steps as printed, converged, and the steps file', () => {
	const out = parseXtbOutput(fixture('xtb-opt.out'));
	assert.deepEqual(out.solvation, { model: 'ALPB', solvent: 'water' });
	assert.equal(out.optimization?.converged, true);
	assert.equal(out.optimization?.cycles, 6);
	assert.deepEqual(out.optimization?.steps.map((step) => step.cycle), [1, 2, 3, 4, 5, 6]);
	assert.equal(out.optimization?.steps.at(-1)?.energy, -5.0850213);
	assert.equal(out.optimization?.steps.at(-1)?.gradientNorm, 0.000021);
	assert.equal(out.energy, -5.085021284719);
	assert.deepEqual(out.warnings, []);

	const frames = parseXyzFrames(fixture('xtbopt.log'));
	assert.equal(frames.length, 6);
	assert.equal(frames[0].energy, -5.084828277923);
	assert.equal(frames[0].gradientNorm, 0.009232527912);
	assert.equal(frames[5].atoms[1].symbol, 'H');
	assert.equal(formulaOf(frames[0].atoms), 'H2O');
	assert.deepEqual(parseXyzFrames(frameToXyz(frames[5])).map((frame) => frame.atoms), [frames[5].atoms.map((atom) => ({ ...atom, x: Number(atom.x.toFixed(6)), y: Number(atom.y.toFixed(6)), z: Number(atom.z.toFixed(6)) }))]);
	// A file being written: the last frame cut short is left out.
	assert.equal(parseXyzFrames(fixture('xtbopt.log').split('\n').slice(0, -3).join('\n')).length, 5);
});

test('optimization and frequencies: thermochemistry, the spectrum without translations and rotations, the modes to animate', () => {
	const out = parseXtbOutput(fixture('xtb-ohess.out'));
	assert.equal(out.enthalpy, -11.310998471416);
	assert.equal(out.freeEnergy, -11.341580349588);
	assert.equal(out.rrho, 0.052758199589);
	assert.equal(out.imaginary, 0);
	assert.equal(out.optimization?.converged, true);

	const spectrum = parseVibSpectrum(fixture('vibspectrum'));
	assert.equal(spectrum.length, 21);
	assert.deepEqual(spectrum[0], { mode: 7, frequency: 226.01, intensity: 2.49541 });
	assert.deepEqual(spectrum.at(-1), { mode: 27, frequency: 3540.59, intensity: 6.10236 });

	const normal = parseG98Modes(fixture('g98.out'));
	assert.ok(normal);
	assert.equal(formulaOf(normal.atoms), 'C2H6O');
	assert.equal(normal.modes.length, 21);
	assert.equal(normal.modes[0].frequency, 226.006);
	assert.equal(normal.modes[1].intensity, 140.5693);
	assert.deepEqual(normal.modes[0].displacements[0], [0.01, -0, 0.01]);
	assert.deepEqual(normal.modes[2].displacements[8], [0.06, 0.25, -0.09]);
});

test('when xtb stops: not converged is a warning, a fatal error is its lines', () => {
	const unconverged = parseXtbOutput(fixture('xtb-unconverged.out'));
	assert.equal(unconverged.optimization?.converged, false);
	assert.equal(unconverged.optimization?.cycles, 2);
	assert.deepEqual(unconverged.warnings, ['结构优化在 2 步内没有收敛']);

	const failed = parseXtbOutput(fixture('xtb-error.out'));
	assert.equal(failed.terminated, false);
	assert.equal(failed.energy, null);
	assert.deepEqual(failed.errors.slice(0, 3), ['[ERROR] Program stopped due to fatal error', "-2- reading geometry input 'bad.xyz' failed", '-1- Error: Could not parse coordinates from xyz file']);
});

test('CREST: how it ended, and the ensemble with energies above the lowest and populations', () => {
	// n-butanol on a 16-thread server: 15 conformers.
	const out = parseCrestOutput(fixture('crest.out'));
	assert.equal(out.version, '3.0.2');
	assert.equal(out.terminated, true);
	assert.deepEqual(out.errors, []);
	assert.equal(out.conformers, 15);
	assert.equal(out.lowest, -17.723);
	assert.equal(out.call, 'crest input.xyz --gfn2 -T 16');
	assert.ok(out.wallTime !== null && out.wallTime > 10 && out.wallTime < 120);

	const ensemble = ensembleTable(parseXyzFrames(fixture('crest_conformers.xyz')));
	assert.equal(ensemble.length, 15);
	assert.deepEqual(ensemble.slice(0, 3).map((row) => [row.index, Number(row.relative.toFixed(2)), Number(row.population.toFixed(3))]), [[1, 0, 0.224], [2, 0.11, 0.185], [3, 0.3, 0.136]]);
	assert.ok(Math.abs(ensemble.reduce((sum, row) => sum + row.population, 0) - 1) < 1e-12);

	const frame = (energy: string) => `2\n        ${energy}\nH 0 0 0\nH 0 0 0.74\n`;
	const table = ensembleTable(parseXyzFrames(frame('-1.000000') + frame('-0.999000') + frame('-1.000000')));
	assert.deepEqual(table.map((row) => Number(row.relative.toFixed(3))), [0, 0.628, 0]);
	assert.deepEqual(table.map((row) => Number(row.population.toFixed(3))), [0.426, 0.148, 0.426]);
	assert.deepEqual(ensembleTable(parseXyzFrames('2\nno energy\nH 0 0 0\nH 0 0 1\n')), []);
});
