// The security guard (bảo vệ), on the floor all day and night: he walks the aisles on his own, stops now and then to look
// around, check a door or note something in his book, and says what he is up to. (The street guard at the booth went with
// the street; the janitor's rounds, repeated through the day, are in staff.js.) Nothing to click: he is part of the scenery.
import { state } from '../core/state.js';
import { PRO, rand, replay } from '../core/env.js';
import { NODES } from './navigation.js';
import { staffKit } from './staff.js';
import { t as tr } from '../../i18n/index.js';

const STOPS = () => (PRO ? ['LB', 'L2', 'M2', 'R2', 'L1', 'M1', 'R1', 'PA1', 'PA3'] : ['U0', 'U2', 'V0', 'V2', 'GL1', 'GL2', 'K', 'L']).filter((k) => NODES?.[k]);
export let guard = null;

export function setup() {
  const { Staff, arrive } = staffKit();
  let last = '';
  const next = () => { const list = STOPS().filter((k) => k !== last); return list[Math.floor(Math.random() * list.length)] || last; };
  guard = new (class Guard extends Staff {
    step() {
      if (replay.on) return;
      if (this.offstage && !this.coming) { this.coming = true; arrive(this, () => { this.coming = false; this.patrol(); }); return; }
      if (this.offstage || this.coming || this.phase === 'walk' || this.liftHold) return;
      if (this.moveAt && state.sim >= this.moveAt) { this.moveAt = 0; this.patrol(); }
      else if (!this.moveAt) this.moveAt = state.sim + rand(3, 6);
    }
    patrol() {
      const k = next(); if (!k) return;
      last = k; this.hush();
      const [x, z] = NODES[k], here = this.pos;
      this.goTo({ x, z, face: Math.atan2(x - here.x, z - here.y) + rand(-0.8, 0.8), node: k }, () => {
        const act = Math.random();
        this.anim = act < 0.45 ? 'idle' : act < 0.75 ? 'read' : 'think';
        this.faceTarget = rand(-Math.PI, Math.PI);
        if (Math.random() < 0.6) { const lines = tr('asst.guard', null, 'list'), text = String(lines[Math.floor(Math.random() * lines.length)] || ''); if (text) { this.say('idle', text); setTimeout(() => { if (this.lastSay?.text === text) this.hush(); }, 4500); } }
        this.moveAt = state.sim + rand(6, 13);
      });
    }
  })({ name: tr('asst.guardName'), shirt: '#35507A', hair: '#2B2B2B', style: 'plain', acc: 'cap', outfit: 'shirt', pants: '#1F2937', shoes: '#1B1B1E' }, '__baove');
}
