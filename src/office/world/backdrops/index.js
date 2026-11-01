// Choosing the backdrop: only the office itself.
import * as THREE from 'three';
import { state } from '../../core/state.js';
import { $, hhmm, officeNow } from '../../core/env.js';
import { scene } from '../../scene/renderer.js';
import { buildOffice } from './office.js';
import { viewTex } from '../windows.js';
import { wxChip } from '../../life/weather.js';
import { isNightHour, night, setNight } from '../room-update.js';
import { renderSessionHead } from '../../ui/session-drawer.js';
import { loadMac, pollMac } from '../../ui/mac-drawer.js';
import { buildGrid, fp } from '../../interact/first-person.js';
import { t as tr } from '../../../i18n/index.js';

export let THEMES;
export let THEME;
export function setScene(name, apply = true) {
  const t = THEMES[name] || THEMES.office;
  if (!t.group) { t.group = new THREE.Group(); t.group.userData.noMerge = true; scene.add(t.group); t.live = t.build(t.group); t.live.night(night); }
  if (!t.wins) t.wins = [viewTex(t.view, false), viewTex(t.view, true)];
  for (const x of Object.values(THEMES)) if (x.group) x.group.visible = x === t;
  THEME = t;
  try { localStorage.setItem('office-scene', name); } catch { /* storage blocked */ }
  for (const b of document.querySelectorAll('[data-scene]')) b.setAttribute('aria-pressed', String(b.dataset.scene === name));
  if (fp.grid) fp.grid = buildGrid();
  if (apply) setNight(night);
}

export function setup() {
  /* ---------- backdrop: the office alone (a lawn and a path round the building) ---------- */
  THEMES = {
    office: { label: tr('world.scene.office'), build: buildOffice, fog: ['#D4DEE6', '#16223E'], view: 'sky' },
  };
  THEME = THEMES.office;
  setScene('office', false);
  if (!state.nightManual) setNight(isNightHour()); else setNight(night);
  setInterval(() => {
    { const v = hhmm(officeNow().getTime()) + wxChip(), c = $('clock'); if (c.textContent !== v) c.textContent = v; }   // (changes once a minute)
    if (!state.nightManual && night !== isNightHour()) setNight(isNightHour());
    if (state.selectedId) renderSessionHead();
  }, 1000);
  $('clock').textContent = hhmm(officeNow().getTime()) + wxChip();
  loadMac();
   state.macTimer = setInterval(pollMac, 30000);
}
