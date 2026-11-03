// Moving the view without dragging: the wheel zooms a little at a time (it eases toward the goal, like the + and -
// buttons), and W A S D (or the arrow keys) slide the view along and across the floor, Shift for faster. In first
// person the same keys walk (interact/first-person.js) and the wheel does nothing here.
import { state } from '../core/state.js';
import { GROW, LAYOUT } from '../core/env.js';
import { BASE_ZOOM, camera, controls, renderer } from '../scene/renderer.js';
import { setView } from '../ui/camera-bar.js';
import { fp } from './first-person.js';

const WHEEL_RATE = 0.0008;                     // zoom per wheel unit: one notch (100) is about 8 %
const PAN_SPEED = 9;                           // floor units a second at the standard zoom
const KEYS = /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/;
const held = new Set();
const typing = (e) => e.target?.closest?.('input, textarea, select, [contenteditable="true"]');
const _f = { x: 0, z: 0 };
const drag = { x: 0, z: 0 };   // what the right button's drag has asked for since the last frame, in floor units

/** the zoom a wheel turn asks for from where the view is (or is already heading), within the camera's limits */
export const zoomAfter = (from, deltaY, deltaMode = 0, min = 0.1, max = 10) => {
  const unit = deltaMode === 1 ? 33 : deltaMode === 2 ? 240 : 1, dy = Math.max(-300, Math.min(300, deltaY * unit));
  return Math.max(min, Math.min(max, from * Math.exp(-dy * WHEEL_RATE)));
};

/** where the view's centre can go: the building and a little of its surroundings */
const bounds = () => ({ x0: -10, x1: 17, z0: -10, z1: (LAYOUT === 'hq' ? 28.3 + GROW : 11.3) + 6 });

/** slide the focus point for dt seconds of the held keys (called every frame by the loop; the loop eases the camera to it) */
export function panStep(dt, focus) {
  if (fp.on) return;
  if (drag.x || drag.z) {   // (the right button dragged: the view follows the hand)
    const b = bounds();
    focus.x = Math.max(b.x0, Math.min(b.x1, focus.x + drag.x)); focus.z = Math.max(b.z0, Math.min(b.z1, focus.z + drag.z));
    drag.x = drag.z = 0; state.lastUserCam = performance.now(); setView(null);
  }
  if (!held.size || state.selectedId) return;
  const k = (a, b) => (held.has(a) || held.has(b) ? 1 : 0);
  const fwd = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), side = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
  if (!fwd && !side) return;
  // "forward" is where the camera looks, along the floor
  _f.x = controls.target.x - camera.position.x; _f.z = controls.target.z - camera.position.z;
  const len = Math.hypot(_f.x, _f.z) || 1; _f.x /= len; _f.z /= len;
  const speed = PAN_SPEED * dt * (BASE_ZOOM / camera.zoom) * (held.has('ShiftLeft') || held.has('ShiftRight') ? 2.2 : 1), n = Math.hypot(fwd, side) || 1;
  const b = bounds();
  focus.x = Math.max(b.x0, Math.min(b.x1, focus.x + ((_f.x * fwd - _f.z * side) / n) * speed));
  focus.z = Math.max(b.z0, Math.min(b.z1, focus.z + ((_f.z * fwd + _f.x * side) / n) * speed));
  state.lastUserCam = performance.now(); setView(null);
}

/** the floor distance a drag of (dx, dy) screen pixels moves the view: the scene follows the hand, so the view goes the other way */
export function dragToFloor(dx, dy, perPixel, sinElev, fx, fz) {
  const k = perPixel, back = (dy * k) / Math.max(0.2, sinElev);
  // right of the view on the floor is (-fz, fx); forward is (fx, fz)
  return { x: -(-fz) * dx * k + fx * back, z: -fx * dx * k + fz * back };
}

export function setupCamKeys() {
  // the right button held and dragged on the 3D view: the view slides across the floor (the left button turns it)
  const cv = renderer.domElement;
  let from = null;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => { if (e.button === 2 && !fp.on) { from = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch { /* gone */ } } });
  cv.addEventListener('pointermove', (e) => {
    if (!from) return;
    if (!(e.buttons & 2)) { from = null; return; }
    const dx = e.clientX - from.x, dy = e.clientY - from.y; from = { x: e.clientX, y: e.clientY };
    _f.x = controls.target.x - camera.position.x; _f.z = controls.target.z - camera.position.z;
    const len = Math.hypot(_f.x, _f.z) || 1, perPixel = (camera.top - camera.bottom) / camera.zoom / (cv.clientHeight || 1);
    const m = dragToFloor(dx, dy, perPixel, Math.cos(controls.getPolarAngle()), _f.x / len, _f.z / len);
    drag.x += m.x; drag.z += m.z;
  });
  const end = (e) => { if (e.button === 2 || e.type === 'pointercancel') from = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  addEventListener('keydown', (e) => {
    if (fp.on || typing(e) || e.metaKey || e.ctrlKey || e.altKey || !KEYS.test(e.code)) return;
    held.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => { held.delete(e.code); if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') held.delete(e.code); });
  addEventListener('keydown', (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') held.add(e.code); });
  addEventListener('blur', () => held.clear());
  // the wheel over the 3D view: our own eased zoom instead of the controls' stepwise one
  addEventListener('wheel', (e) => {
    if (e.target !== renderer.domElement || fp.on) return;
    e.preventDefault(); e.stopImmediatePropagation();
    state.zoomGoal = zoomAfter(state.zoomGoal ?? camera.zoom, e.deltaY, e.deltaMode, controls.minZoom, controls.maxZoom);
    state.lastUserCam = performance.now(); setView(null);
  }, { capture: true, passive: false });
}
