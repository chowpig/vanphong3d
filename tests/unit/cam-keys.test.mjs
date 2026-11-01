import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// the wheel's easing formula, copied out of src/office/interact/cam-keys.js (the file imports the 3D scene, so it cannot be loaded here)
const src = readFileSync(new URL('../../src/office/interact/cam-keys.js', import.meta.url), 'utf8');
const body = /export const zoomAfter = \(([^)]*)\) => \{([\s\S]*?)\n\};/.exec(src);
const rate = Number(/WHEEL_RATE = ([0-9.]+)/.exec(src)[1]);
const zoomAfter = new Function(`const WHEEL_RATE = ${rate}; return (${body[1]}) => {${body[2]}\n};`)();

test('one wheel notch zooms by a few percent, in and out the same, and stays within the limits', () => {
  const inOne = zoomAfter(1, -100), outOne = zoomAfter(1, 100);
  assert.ok(inOne > 1.05 && inOne < 1.12, `in: ${inOne}`);
  assert.ok(Math.abs(inOne * outOne - 1) < 1e-9, 'in then out comes back');
  assert.equal(zoomAfter(3.39, -100, 0, 0.5, 3.4), 3.4);
  assert.equal(zoomAfter(0.51, 100, 0, 0.5, 3.4), 0.5);
  assert.ok(zoomAfter(1, -100000) > 1 && zoomAfter(1, -100000) < 1.5, 'one huge spin cannot jump across the whole range');
  assert.ok(zoomAfter(1, -3, 1) > zoomAfter(1, -3, 0), 'a line-based wheel counts for more than pixels');
});
