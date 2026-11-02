// Helpers of `my-office chat-setup` and `my-office cowork-plugin`: finding the Claude desktop app's config file, adding the
// office's MCP tool to it (a backup first), and packing the Cowork plugin into a .plugin archive. Pure and small, so they can be tested.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** where the Claude desktop app keeps claude_desktop_config.json on this system: every place it has been seen */
export function configCandidates({ platform = process.platform, env = process.env, home = '', readdir = (d) => fs.readdirSync(d) } = {}) {
  const file = 'claude_desktop_config.json', out = [];
  const list = (dir, filter) => { try { return readdir(dir).filter(filter); } catch { return []; } };
  if (platform === 'win32') {
    if (env.APPDATA) out.push(path.join(env.APPDATA, 'Claude', file));
    if (env.LOCALAPPDATA) {
      // the store build keeps the app's data in Claude-Data\<package id>\ (or in the package's own LocalCache)
      for (const d of list(path.join(env.LOCALAPPDATA, 'Claude-Data'), () => true)) out.push(path.join(env.LOCALAPPDATA, 'Claude-Data', d, file));
      for (const d of list(path.join(env.LOCALAPPDATA, 'Packages'), (n) => /^Claude_/.test(n))) out.push(path.join(env.LOCALAPPDATA, 'Packages', d, 'LocalCache', 'Roaming', 'Claude', file));
    }
  } else if (platform === 'darwin') out.push(path.join(home, 'Library', 'Application Support', 'Claude', file));
  else out.push(path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Claude', file));
  return out;
}

/** the entry for the office's tool: the full path of the node that runs it, so the app needs nothing on its PATH */
export const mcpEntry = (nodePath, root) => ({ command: nodePath, args: [path.join(root, 'mcp', 'office-mcp.mjs')] });

/** the config with the office's tool added under mcpServers, everything else as it was; throws when it is not an object */
export function withMcp(cfg, entry) {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new Error('the config is not a JSON object');
  if (cfg.mcpServers !== undefined && (typeof cfg.mcpServers !== 'object' || cfg.mcpServers === null || Array.isArray(cfg.mcpServers))) throw new Error('mcpServers is not an object');
  return { ...cfg, mcpServers: { ...(cfg.mcpServers || {}), 'my-office': entry } };
}

/** a zip archive of the files ({ name: 'dir/file', data: Buffer }): deflated, UTF-8 names, forward slashes (what a .plugin needs) */
export function makeZip(files) {
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunks = [], central = []; let offset = 0;
  const time = 0, date = ((2026 - 1980) << 9) | (1 << 5) | 1;   // (a fixed stamp: the same files make the same archive)
  for (const f of files) {
    const name = Buffer.from(f.name.replace(/\\/g, '/'), 'utf8'), raw = Buffer.from(f.data), packed = zlib.deflateRawSync(raw), crc = crc32(raw);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8); head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(raw.length, 22); head.writeUInt16LE(name.length, 26);
    chunks.push(head, name, packed);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += head.length + name.length + packed.length;
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, dir, end]);
}

/** the files of the Cowork plugin (cowork-plugin/ without its data folder), plus the office's key as data/token */
export function pluginFiles(root, token) {
  const base = path.join(root, 'cowork-plugin'), out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (e.name !== 'data') walk(path.join(dir, e.name), r); } else out.push({ name: r, data: fs.readFileSync(path.join(base, r)) });
    }
  };
  walk(base, '');
  out.push({ name: 'data/token', data: Buffer.from(String(token).trim()) });
  return out;
}
