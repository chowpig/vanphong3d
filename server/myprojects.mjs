// "My projects": the names of the projects the person works on (the ones in their Claude app's sidebar), kept in
// data/myprojects.json. A session whose repository, folder, title or Cowork project says one of those names sits in
// that project's area, whatever its folder is called, and the office has room for all of them even before they have a
// session. Names only: nothing is read from the Claude account.
import fs from 'node:fs';
import path from 'node:path';

export const MAX_PROJECTS = 24, MAX_NAME = 40;

/** "Hồng Phúc", "hong-phuc" and "HONG_PHUC" are the same: lower case, no accents, letters and digits only */
export const norm = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** a list from the page or the file: strings, trimmed, no empty ones or repeats, short, at most MAX_PROJECTS */
export function clean(list) {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const name = String(x ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME), k = norm(name);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(name);
    if (out.length >= MAX_PROJECTS) break;
  }
  return out;
}

export function createMyProjects(dataDir) {
  const file = path.join(dataDir, 'myprojects.json');
  let list = [];
  try { list = clean(JSON.parse(fs.readFileSync(file, 'utf8'))?.projects); } catch { /* first run */ }
  return {
    list: () => list,
    set(next) {
      list = clean(next);
      fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify({ projects: list }, null, 2));
      return list;
    },
    /** the listed project a session belongs to: the first of its clues (Cowork project, repository, folder, title) that names one, else '' */
    match(clues, { loose = false } = {}) {
      if (!list.length) return '';
      const keys = new Map(list.map((n) => [norm(n), n]));
      for (const c of clues) { const hit = keys.get(norm(c)); if (hit) return hit; }
      // loose (a Chat or Cowork conversation, which cannot say its project): a listed name as whole words in a clue,
      // e.g. the title "Tìm TV Hồng Phúc 1" belongs to HỒNG PHÚC; the longest name wins
      if (loose) {
        const found = [...keys].filter(([k]) => k && clues.some((c) => ` ${norm(c)} `.includes(` ${k} `))).sort((x, y) => y[0].length - x[0].length)[0];
        if (found) return found[1];
      }
      return '';
    },
  };
}
