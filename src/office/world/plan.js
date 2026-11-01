// The floor plan's arithmetic, with no 3D and no page in it, so it can be tested on its own: the headquarters wing's
// rooms (the four it always has, plus as many pairs more as the projects need), the walking graph through it, and how
// many projects each plan seats.

export const BASE_Z1 = 26;   // where the wing ends with its four rooms
export const ROW_D = 7.6;    // the depth of one more row of two rooms
export const MAX_EXTRA = 4;  // rows of two rooms that can be added: up to 18 projects have an area of their own
export const SEATS = { cozy: 3, pro: 6, hq: 10 };   // projects with an area of their own, by plan (hq: 2 more per extra row)

export const capacity = (layout, extra = 0) => (layout === 'hq' ? SEATS.hq + 2 * extra : SEATS[layout] ?? SEATS.pro);
export const wingZ1 = (extra = 0) => BASE_Z1 + ROW_D * extra;
export const wingDepth = (extra = 0) => wingZ1(extra) + 8;   // the whole building, back wall (z -8) to the wing's end

/** The plan a number of projects needs: the company floor seats 6, the wing 4 rooms more, then 2 for each extra row. */
export function planFor(projects) {
  const n = Math.max(0, Math.floor(Number(projects) || 0));
  if (n <= SEATS.pro) return { layout: 'pro', extra: 0 };
  return { layout: 'hq', extra: Math.min(MAX_EXTRA, Math.max(0, Math.ceil((n - SEATS.hq) / 2))) };
}

export const WING = { z0: 9, corA: [9, 10.8], corB: [2.3, 4.3], split: 18.4, doors: [-2.4, 7.4] };

/** The wing's department rooms. The four first rooms: two at the back (doors north, onto corridor A) and two in front
 *  (doors on the side, onto corridor B). Each extra row adds a room on each side of corridor B, door to the side. */
export function wingDepts(extra = 0) {
  const base = [
    { x0: -8, x1: 2.3, z0: 10.8, z1: 18.4, cx: -2.85, door: { side: 'n', at: -2.4 } },
    { x0: 4.3, x1: 14, z0: 10.8, z1: 18.4, cx: 9.15, door: { side: 'n', at: 9.15 } },
    { x0: -8, x1: 2.3, z0: 18.4, z1: 26, cx: -3.05, door: { side: 'e', at: 22.2 } },
    { x0: 4.3, x1: 14, z0: 18.4, z1: 26, cx: 9.5, door: { side: 'w', at: 22.2 } },
  ];
  for (let r = 0; r < extra; r++) {
    const z0 = BASE_Z1 + ROW_D * r, z1 = BASE_Z1 + ROW_D * (r + 1), at = z0 + 3.8;
    base.push({ x0: -8, x1: 2.3, z0, z1, cx: -3.05, door: { side: 'e', at } }, { x0: 4.3, x1: 14, z0, z1, cx: 9.5, door: { side: 'w', at } });
  }
  return base.map((d) => ({ ...d, cz: (d.z0 + d.z1) / 2, pods: [[d.cx - 2.65, (d.z0 + d.z1) / 2], [d.cx + 2.65, (d.z0 + d.z1) / 2]] }));
}

/** The corridor-B node a room's side door opens onto: the first front row's is HB1, the extra rows' follow it. */
export const corridorNode = (d, i) => (d.door.side === 'n' ? null : i < 4 ? 'HB1' : `HBr${Math.floor((i - 4) / 2)}`);

/** Walking graph of the wing: corridor A along the company floor (z 9.9), corridor B down the middle (x 3.3), and in
 *  each room a door, a lane between its two pods and the aisles behind each row of chairs. Pod p's aisle nodes are
 *  P{p}b0…; the company floor has pods 0-2, the rooms' pods follow (room i: 3 + 2i and 4 + 2i). */
export function wingGraph(depts) {
  const nodes = { HAL: [-2.4, 9.9], HB0: [3.3, 9.9], HAR: [7.4, 9.9], HB1: [3.3, 22.2] };
  const edges = [['L4', 'HAL'], ['R4', 'HAR'], ['HAL', 'HB0'], ['HB0', 'HAR'], ['HB0', 'HB1']];
  const extraRows = Math.max(0, (depts.length - 4) / 2);
  for (let r = 0; r < extraRows; r++) {
    const at = depts[4 + 2 * r].door.at;
    nodes[`HBr${r}`] = [3.3, at]; edges.push([r ? `HBr${r - 1}` : 'HB1', `HBr${r}`]);
  }
  depts.forEach((d, i) => {
    const pl = 3 + i * 2, pr = pl + 1, zb = d.cz - 1.8, zf = d.cz + 1.8, lane = d.door.side === 'n' ? d.door.at : d.cx;
    nodes[`D${i}b`] = [lane, zb]; nodes[`D${i}f`] = [lane, zf];
    edges.push([`D${i}b`, `D${i}f`], [`D${i}b`, `P${pl}b1`], [`P${pl}b1`, `P${pl}b0`], [`D${i}b`, `P${pr}b0`], [`P${pr}b0`, `P${pr}b1`],
      [`D${i}f`, `P${pl}f1`], [`P${pl}f1`, `P${pl}f0`], [`D${i}f`, `P${pr}f0`], [`P${pr}f0`, `P${pr}f1`]);
    if (d.door.side === 'n') {   // through the room's back wall from corridor A, into the lane
      nodes[`D${i}i`] = [lane, d.z0 + 1.0];
      if (lane !== -2.4) { nodes[`HA${i}`] = [lane, 9.9]; edges.push(['HAR', `HA${i}`], [`HA${i}`, `D${i}i`]); } else edges.push(['HAL', `D${i}i`]);
      edges.push([`D${i}i`, `D${i}b`]);
    } else {                     // from corridor B through a side wall, then along that wall to both aisles
      const x = d.door.side === 'e' ? d.x1 - 0.4 : d.x0 + 0.5, near = d.door.side === 'e' ? pr : pl, k = d.door.side === 'e' ? 1 : 0;
      nodes[`D${i}i`] = [x, d.door.at]; nodes[`D${i}sb`] = [x, zb]; nodes[`D${i}sf`] = [x, zf];
      edges.push([corridorNode(d, i), `D${i}i`], [`D${i}i`, `D${i}sb`], [`D${i}i`, `D${i}sf`], [`D${i}sb`, `P${near}b${k}`], [`D${i}sf`, `P${near}f${k}`]);
    }
  });
  return { nodes, edges };
}
