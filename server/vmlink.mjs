// The way Cowork's virtual machine reaches the office. Cowork runs in a VM that cannot see this computer's 127.0.0.1,
// so on Windows the office also listens on the address of the Hyper-V virtual adapter ("vEthernet (...)") that the VM
// is plugged into, and nowhere else: not the home network, not the internet. That listener does one thing: it takes
// Cowork plugin events (POST /event with the office's key) from addresses on that adapter's own subnet, and says "ok"
// to GET /health so the plugin can find it. OFFICE_VM_BIND=off turns it off.
import os from 'node:os';

const ip4 = (a) => String(a).split('.').reduce((n, x) => n * 256 + (Number(x) & 255), 0) >>> 0;

/** the addresses to listen on: IPv4 addresses of Hyper-V virtual adapters (vEthernet), with the subnet each one serves */
export function vmAddresses(ifaces = os.networkInterfaces(), env = process.env, platform = process.platform) {
  if (platform !== 'win32' || env.OFFICE_VM_BIND === 'off') return [];
  const out = [];
  for (const [name, list] of Object.entries(ifaces)) {
    if (!/^vEthernet\b/i.test(name)) continue;
    for (const n of list || []) if (n && n.family === 'IPv4' && !n.internal && n.address && n.netmask) out.push({ address: n.address, netmask: n.netmask, name });
  }
  return out;
}

/** is the remote address (maybe "::ffff:1.2.3.4") on the subnet of this adapter address, and not the host itself? */
export function onSubnet(remote, { address, netmask }) {
  const r = String(remote || '').replace(/^::ffff:/, '');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(r)) return false;
  const mask = ip4(netmask);
  return (ip4(r) & mask) === (ip4(address) & mask);
}

/** the request handler of one listener: GET /health, POST /event (key + subnet + size checked), nothing else */
export function vmHandler({ peer, keyOk, onEvent, maxBytes = 1_000_000 }) {
  return (req, res) => {
    const url = new URL(req.url, 'http://x');
    const end = (code, body = '') => { res.writeHead(code, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(body); };
    if (!onSubnet(req.socket.remoteAddress, peer)) { end(403); return; }
    if (req.method === 'GET' && url.pathname === '/health') { end(200, 'ok'); return; }
    if (req.method !== 'POST' || url.pathname !== '/event') { end(404); return; }
    if (!keyOk(req.headers['x-office-key'] || '')) { end(403); return; }
    if (Number(req.headers['content-length']) > maxBytes) { end(413); return; }
    const chunks = []; let size = 0, over = false;
    req.on('data', (c) => { size += c.length; if (size > maxBytes) { over = true; chunks.length = 0; req.destroy(); } else if (!over) chunks.push(c); });
    req.on('end', () => {
      if (over) return;
      end(204);
      try { onEvent(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { /* not JSON: ignored */ }
    });
  };
}
