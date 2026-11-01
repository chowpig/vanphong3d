// Office-only backdrop: a plain lawn and a paved path running all the way round the building. No street, traffic,
// shops, trees or scenery: the office is the only thing to look at.
import * as THREE from 'three';
import { state } from '../../core/state.js';
import { mat } from '../../scene/blocks.js';
import { GY } from '../terrace.js';
import { REACH } from '../layout.js';

const PATH_GAP = 1.4, PATH_W = 2.2, CURB = 0.18;
const LAWN = ['#A9C494', '#26352E'], PAVE = ['#DAD5C8', '#4B4C55'], EDGE = ['#B8B2A2', '#383941'];

export function buildOffice(G) {
  state.envSeed = 101;
  const lawn = mat(LAWN[0], { roughness: 0.97 }), pave = mat(PAVE[0], { roughness: 0.9 }), edge = mat(EDGE[0], { roughness: 0.9 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), lawn);
  ground.rotation.x = -Math.PI / 2; ground.position.y = GY; ground.receiveShadow = true; G.add(ground);
  // the path: four slabs round the office's footprint, each on a slightly wider darker one (a kerb)
  const R = REACH(), cx0 = R.x0 - PATH_GAP - PATH_W / 2, cx1 = R.x1 + PATH_GAP + PATH_W / 2, cz0 = R.z0 - PATH_GAP - PATH_W / 2, cz1 = R.z1 + PATH_GAP + PATH_W / 2;
  const slab = (x0, x1, z0, z1, m, h, y) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), m);
    s.position.set((x0 + x1) / 2, GY + y, (z0 + z1) / 2); s.receiveShadow = true; G.add(s);
  };
  const h = PATH_W / 2;
  for (const [m, grow, height, y] of [[edge, CURB, 0.05, 0.025], [pave, 0, 0.09, 0.045]]) {
    slab(cx0 - h - grow, cx1 + h + grow, cz0 - h - grow, cz0 + h + grow, m, height, y);   // back
    slab(cx0 - h - grow, cx1 + h + grow, cz1 - h - grow, cz1 + h + grow, m, height, y);   // front
    slab(cx0 - h - grow, cx0 + h + grow, cz0 - h - grow, cz1 + h + grow, m, height, y);   // left
    slab(cx1 - h - grow, cx1 + h + grow, cz0 - h - grow, cz1 + h + grow, m, height, y);   // right
  }
  const tint = (m, pair, on) => m.color.set(pair[on ? 1 : 0]);
  return {
    update() {},
    night(on) { tint(lawn, LAWN, on); tint(pave, PAVE, on); tint(edge, EDGE, on); },
  };
}
