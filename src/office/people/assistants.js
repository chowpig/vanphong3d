// The four standing assistants (Kế Toán, Nhân Sự, Xây Dựng, Trợ Lý): a small wooden cabin on the lawn east of the office,
// four desks along its back wall, one person at each. They never leave their desks: a desk type-types while its person
// works on something you asked (the server says so: { k: 'asst', op: 'state' }), and otherwise reads, thinks, tidies.
// Click one (or the Assistants button) to talk to them: src/office/ui/assistants.js. What they know and do: server/assistants.mjs.
import * as THREE from 'three';
import { state } from '../core/state.js';
import { rand } from '../core/env.js';
import { camera, controls, scene } from '../scene/renderer.js';
import { canvasTex, fitText, mat, put, rbox } from '../scene/blocks.js';
import { officeChair } from '../world/desks.js';
import { GY } from '../world/terrace.js';
import { Worker, npcs } from './workers.js';
import { t as tr } from '../../i18n/index.js';

export const ASST = [
  { key: 'ketoan', id: '__ketoan', color: '#4F8A5B', look: { shirt: '#9CC5A1', hair: '#3A2A20', style: 'ponytail', acc: 'glasses' } },
  { key: 'nhansu', id: '__nhansu', color: '#8A6BB8', look: { shirt: '#C8B6E2', hair: '#2B2420', style: 'bob', acc: null } },
  { key: 'xaydung', id: '__xaydung', color: '#D69A1F', look: { shirt: '#E8B84A', hair: '#3A3A40', style: 'plain', acc: 'cap' } },
  { key: 'troly', id: '__troly', color: '#3F7FB0', look: { shirt: '#7FB3D5', hair: '#5A3A22', style: 'ponytail', acc: 'glasses' } },
];
const X0 = 21, X1 = 29, Z0 = -1.6, Z1 = 3.6, DESK_Z = -0.75, GAP = 1.9, FIRST_X = 22.6;   // the cabin's floor, and its four desks along the back wall (z = -1.6)
export const deskX = (i) => FIRST_X + i * GAP;
export const people = [];
let cabinCenter = { x: (X0 + X1) / 2, z: (Z0 + Z1) / 2 };

function buildCabin() {
  const wood = mat('#B98C5E', { roughness: 0.75 }), woodD = mat('#8E6540', { roughness: 0.8 }), floor = mat('#D8B98A', { roughness: 0.85 }), dark = mat('#2B2F36', { roughness: 0.5 });
  const w = X1 - X0, d = Z1 - Z0;
  // deck: the floor on the lawn, with a border
  put(scene, rbox(w + 0.4, 0.12, d + 0.4, woodD, 0.03), X0 + w / 2, GY + 0.06, Z0 + d / 2);
  put(scene, rbox(w, 0.06, d, floor, 0.02), X0 + w / 2, GY + 0.14, Z0 + d / 2);
  // the walls on the two far sides (the camera looks from +x and +z), planks, and low rails on the near ones
  put(scene, rbox(w + 0.3, 2.6, 0.2, wood, 0.03), X0 + w / 2, GY + 1.4, Z0 - 0.1);
  put(scene, rbox(0.2, 2.6, d + 0.3, wood, 0.03), X0 - 0.1, GY + 1.4, Z0 + d / 2);
  for (let k = 1; k < 6; k++) put(scene, rbox(w + 0.31, 0.03, 0.21, woodD, 0.01), X0 + w / 2, GY + 0.2 + k * 0.4, Z0 - 0.1);
  for (let k = 1; k < 6; k++) put(scene, rbox(0.21, 0.03, d + 0.31, woodD, 0.01), X0 - 0.1, GY + 0.2 + k * 0.4, Z0 + d / 2);
  put(scene, rbox(w + 0.4, 0.5, 0.1, wood, 0.02), X0 + w / 2, GY + 0.45, Z1 + 0.2);
  put(scene, rbox(0.1, 0.5, d + 0.4, wood, 0.02), X1 + 0.2, GY + 0.45, Z0 + d / 2);
  // a window in the west wall and the sign over the desks
  put(scene, rbox(0.04, 0.9, 1.3, mat('#BFE3F2', { roughness: 0.2, emissive: '#6FA9C4', emissiveIntensity: 0.15 }), 0.02), X0 + 0.02, GY + 1.5, Z0 + d * 0.62);
  const name = tr('asst.cabin'), sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshBasicMaterial({ map: canvasTex(768, 106, (c, ww, hh) => {
    c.fillStyle = '#5B3A21'; c.fillRect(0, 0, ww, hh); c.strokeStyle = '#E2B04A'; c.lineWidth = 6; c.strokeRect(8, 8, ww - 16, hh - 16);
    c.fillStyle = '#F6EFE4'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 48px "Be Vietnam Pro", system-ui, sans-serif'; fitText(c, name, ww - 60); c.fillText(name, ww / 2, hh / 2 + 3);
  }) }));
  sign.position.set(X0 + w / 2, GY + 2.1, Z0 + 0.02); sign.userData.noMerge = true; scene.add(sign);
  // a rug and a plant at the open end
  put(scene, rbox(3.2, 0.02, 1.6, mat('#B5584B', { roughness: 0.95 }), 0.01), X0 + w / 2, GY + 0.18, Z1 - 1.1);
  put(scene, rbox(0.32, 0.3, 0.32, mat('#C9845C', { roughness: 0.8 }), 0.04), X1 - 0.5, GY + 0.31, Z1 - 0.5);
  put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), mat('#4F8A5B', { roughness: 0.9 })), X1 - 0.5, GY + 0.78, Z1 - 0.5);
  void dark;
}

// each desk: a top, a screen facing the chair, a nameplate in the assistant's colour and something of their trade
function buildDesk(i, a) {
  const x = deskX(i), z = DESK_Z, wood = mat('#E0C9A6', { roughness: 0.6 }), woodD = mat('#9A7650', { roughness: 0.7 }), dark = mat('#2B2F36', { roughness: 0.5 });
  const y0 = GY + 0.17;
  put(scene, rbox(1.3, 0.05, 0.62, wood, 0.015), x, y0 + 0.745, z);
  for (const sx of [-1, 1]) put(scene, rbox(0.05, 0.72, 0.58, woodD, 0.01), x + sx * 0.6, y0 + 0.36, z);
  put(scene, rbox(1.16, 0.4, 0.03, woodD, 0.01), x, y0 + 0.5, z - 0.27);
  put(scene, rbox(0.05, 0.18, 0.05, dark, 0.01), x, y0 + 0.86, z - 0.12);
  put(scene, rbox(0.56, 0.34, 0.035, dark, 0.015), x, y0 + 1.06, z - 0.14);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.29), new THREE.MeshBasicMaterial({ color: '#EAF3FA', toneMapped: false })); glow.position.set(x, y0 + 1.06, z - 0.12); glow.userData.noMerge = true; scene.add(glow);
  // the nameplate on the desk's front edge (toward the room)
  const label = tr(`asst.name.${a.key}`), np = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), new THREE.MeshBasicMaterial({ map: canvasTex(320, 76, (c, w, h) => {
    c.fillStyle = a.color; c.fillRect(0, 0, w, h); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 40px "Be Vietnam Pro", system-ui, sans-serif'; fitText(c, label, w - 24); c.fillText(label, w / 2, h / 2 + 2);
  }) }));
  np.position.set(x, y0 + 0.78, z + 0.2); np.rotation.x = -0.4; np.userData.noMerge = true; scene.add(np);
  // trade: a stack of papers and a calculator / folders / a rolled drawing and a hard hat / a notebook
  const paper = mat('#F4F1EA', { roughness: 0.95 });
  if (a.key === 'ketoan') { put(scene, rbox(0.21, 0.07, 0.25, paper, 0.006), x - 0.45, y0 + 0.805, z - 0.05).rotation.y = 0.12; put(scene, rbox(0.1, 0.02, 0.14, dark, 0.006), x + 0.5, y0 + 0.78, z + 0.12); }
  else if (a.key === 'nhansu') { for (let k = 0; k < 3; k++) put(scene, rbox(0.24, 0.025, 0.3, mat(['#E7A1B0', '#9AC1E0', '#EBD38B'][k], { roughness: 0.9 }), 0.006), x - 0.45, y0 + 0.78 + k * 0.026, z - 0.04).rotation.y = 0.1 * k - 0.1; }
  else if (a.key === 'xaydung') { put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), mat('#EDE6D6', { roughness: 0.9 })), x - 0.4, y0 + 0.8, z + 0.05).rotation.z = Math.PI / 2; put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#F2C230', { roughness: 0.5 })), x + 0.45, y0 + 0.775, z + 0.1); }
  else { put(scene, rbox(0.2, 0.025, 0.28, mat('#3F7FB0', { roughness: 0.8 }), 0.008), x - 0.45, y0 + 0.78, z + 0.02).rotation.y = -0.15; put(scene, rbox(0.1, 0.1, 0.1, mat('#F2D16B', { roughness: 0.8 }), 0.01), x + 0.5, y0 + 0.82, z - 0.05); }
  const chair = officeChair(scene, x, z + 0.7, mat(a.color, { roughness: 0.6 })); chair.rotation.y = Math.PI; chair.position.y = GY + 0.17;
}

export function setup() {
  buildCabin();
  ASST.forEach((a, i) => {
    buildDesk(i, a);
    const seat = { x: deskX(i), z: DESK_Z + 0.7, face: Math.PI, node: null, sit: true };
    const p = new (class Assistant extends Worker {
      constructor() {
        super({ name: tr(`asst.name.${a.key}`), pants: '#3A3F4F', shoes: '#2B2B30', outfit: 'shirt', ...a.look }, { id: a.id });
        this.staff = true; this.asst = a.key; this.busy = false; this.nextIdle = 0;
        this.pos.set(seat.x, seat.z); this.spot = seat; this.face = this.faceTarget = seat.face; this.pose = 'sit'; this.station = 'home'; this.anim = 'read';
        this.tagEl.classList.add('tag--staff'); this.tagDot.style.background = a.color;
        npcs.push(this);
      }
      gy() { return GY + 0.17; }   // (the deck's top: lower than the office floor, on the lawn)
      tick() {
        if (this.phase === 'walk') return;
        if (this.busy) { if (this.anim !== 'type') this.anim = 'type'; return; }
        if (state.sim > this.nextIdle) { this.anim = ['read', 'think', 'type', 'read', 'tidy'][Math.floor(Math.random() * 5)]; this.nextIdle = state.sim + rand(6, 14); }
      }
    })();
    people.push(p);
  });
}

/** The server says an assistant is busy (answering, or on a job) or free. */
export function setBusy(key, on) {
  const p = people.find((x) => x.asst === key); if (!p || p.busy === on) return;
  p.busy = on; p.anim = on ? 'type' : 'idle'; p.nextIdle = state.sim + 2;
  const lines = tr(`asst.bubble.${on ? 'work' : 'done'}`, null, 'list');
  if (lines.length) { const text = String(lines[Math.floor(Math.random() * lines.length)]); p.say('idle', text); setTimeout(() => { if (p.lastSay?.text === text) p.hush(); }, 4200); }
}
/** The camera over to the cabin (the panel's "see them"): the view's centre moves, its angle and zoom stay. */
export function viewCabin(key) {
  const p = people.find((x) => x.asst === key), at = p ? { x: p.pos.x, z: p.pos.y } : cabinCenter;
  if (!controls) return;
  const off = camera.position.clone().sub(controls.target);
  controls.target.set(at.x, 0.8, at.z); camera.position.copy(controls.target).add(off); camera.lookAt(controls.target); controls.update?.();
}
