import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_Z1, MAX_EXTRA, ROW_D, SEATS, capacity, planFor, wingDepts, wingGraph, wingZ1 } from '../../src/office/world/plan.js';

const overlap = (a, b) => a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6 && a.z0 < b.z1 - 1e-6 && b.z0 < a.z1 - 1e-6;

test('the plan a number of projects needs: pro up to 6, hq beyond it, two more rooms for each extra row, capped', () => {
  assert.deepEqual(planFor(0), { layout: 'pro', extra: 0 });
  assert.deepEqual(planFor(6), { layout: 'pro', extra: 0 });
  assert.deepEqual(planFor(7), { layout: 'hq', extra: 0 });
  assert.deepEqual(planFor(10), { layout: 'hq', extra: 0 });
  assert.deepEqual(planFor(11), { layout: 'hq', extra: 1 });
  assert.deepEqual(planFor(12), { layout: 'hq', extra: 1 });
  assert.deepEqual(planFor(13), { layout: 'hq', extra: 2 });
  assert.deepEqual(planFor(18), { layout: 'hq', extra: 4 });
  assert.deepEqual(planFor(500), { layout: 'hq', extra: MAX_EXTRA });
  assert.deepEqual(planFor(undefined), { layout: 'pro', extra: 0 });
  assert.deepEqual(planFor(-3), { layout: 'pro', extra: 0 });
  // the plan always seats the projects it was picked for (until the cap)
  for (let n = 0; n <= 18; n++) { const p = planFor(n); assert.ok(capacity(p.layout, p.extra) >= n, `${n} projects fit`); }
  assert.equal(capacity('cozy'), SEATS.cozy);
  assert.equal(capacity('hq', 3), 16);
});

test('the wing: four rooms, and two more for every extra row, each in its own place', () => {
  for (let extra = 0; extra <= MAX_EXTRA; extra++) {
    const d = wingDepts(extra);
    assert.equal(d.length, 4 + 2 * extra);
    assert.equal(Math.max(...d.map((r) => r.z1)), wingZ1(extra));
    for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) assert.ok(!overlap(d[i], d[j]), `rooms ${i} and ${j} overlap (extra ${extra})`);
    for (const r of d) {
      assert.ok(r.x0 >= -8 && r.x1 <= 14 && r.z0 >= 10.8 && r.z1 <= wingZ1(extra) + 1e-9, 'inside the building');
      assert.equal(r.pods.length, 2);
      for (const [px, pz] of r.pods) assert.ok(px > r.x0 + 1 && px < r.x1 - 1 && pz > r.z0 && pz < r.z1, 'a pod sits inside its room');
      assert.ok(r.pods[1][0] - r.pods[0][0] > 4.5, 'the two pods are apart');
      if (r.door.side === 'n') assert.ok(r.door.at > r.x0 && r.door.at < r.x1);
      else assert.ok(r.door.at > r.z0 + 1 && r.door.at < r.z1 - 1, 'a side door is within its wall');
    }
    // the rooms are the same on both sides of corridor B (x 2.3 → 4.3), and no room blocks it
    for (const r of d) assert.ok(r.x1 <= 2.3 + 1e-9 || r.x0 >= 4.3 - 1e-9);
  }
  assert.equal(wingDepts(0)[3].z1, BASE_Z1);
  assert.ok(Math.abs(wingDepts(2)[7].z1 - (BASE_Z1 + 2 * ROW_D)) < 1e-9);
});

test('the wing\'s rooms keep the order the desks, plaques and walking graph count by', () => {
  const d = wingDepts(2);
  assert.deepEqual(d.slice(0, 4).map((r) => r.door.side), ['n', 'n', 'e', 'w']);
  assert.deepEqual(d.slice(4).map((r) => r.door.side), ['e', 'w', 'e', 'w']);
  assert.ok(d[4].z0 === d[5].z0 && d[6].z0 > d[4].z0, 'a row is a left and a right room, the next row further on');
  assert.ok(d[4].door.at === d[5].door.at);
});

// every pod of the company floor (0-2) and of each room has its aisle nodes, as navigation.js builds them
const podNodesOf = (depts) => {
  const pods = [[-0.1, 1.5], [5.1, 1.5], [2.5, 6.6], ...depts.flatMap((d) => d.pods)], out = {};
  pods.forEach(([cx], p) => { for (const k of [0, 1]) for (const f of ['b', 'f']) out[`P${p}${f}${k}`] = [cx + (k ? 0.76 : -0.76), 0]; });
  return out;
};

test('the walking graph through the wing is connected, however many rooms it has, and no edge leads nowhere', () => {
  for (let extra = 0; extra <= MAX_EXTRA; extra++) {
    const depts = wingDepts(extra), { nodes, edges } = wingGraph(depts);
    // the company floor's own nodes the wing hangs on (navigation.js): the aisle ends and the pods
    const known = { ...podNodesOf(depts), L4: [0, 0], R4: [0, 0], ...nodes };
    for (const [a, b] of edges) { assert.ok(known[a], `unknown node ${a} (extra ${extra})`); assert.ok(known[b], `unknown node ${b} (extra ${extra})`); }
    const adj = new Map(); for (const [a, b] of edges) { (adj.get(a) ?? adj.set(a, []).get(a)).push(b); (adj.get(b) ?? adj.set(b, []).get(b)).push(a); }
    const seen = new Set(['L4']), q = ['L4'];
    while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
    for (const n of Object.keys(nodes)) assert.ok(seen.has(n), `${n} can be reached from the company floor (extra ${extra})`);
    for (let i = 0; i < depts.length; i++) {
      const pl = 3 + 2 * i;
      for (const p of [pl, pl + 1]) for (const f of ['b', 'f']) for (const k of [0, 1]) assert.ok(seen.has(`P${p}${f}${k}`), `pod ${p} aisle ${f}${k} can be reached (extra ${extra})`);
      const dn = nodes[`D${i}b`]; assert.ok(dn[0] >= depts[i].x0 && dn[0] <= depts[i].x1 && dn[1] > depts[i].z0 && dn[1] < depts[i].z1, 'a room\'s lane is inside it');
    }
    assert.equal(new Set(Object.keys(nodes)).size, Object.keys(nodes).length);
    // corridor B has one node at each side door's height
    for (const d of depts.filter((x) => x.door.side !== 'n')) assert.ok(Object.values(nodes).some(([x, z]) => x === 3.3 && z === d.door.at), `corridor B node at z ${d.door.at}`);
  }
});

test('the wing graph for the four rooms is the one the office always had', () => {
  const { nodes, edges } = wingGraph(wingDepts(0));
  assert.deepEqual(nodes.HB1, [3.3, 22.2]);
  assert.ok(edges.some(([a, b]) => a === 'HB1' && b === 'D2i') && edges.some(([a, b]) => a === 'HB1' && b === 'D3i'));
  assert.equal(Object.keys(nodes).filter((k) => k.startsWith('HBr')).length, 0);
});
