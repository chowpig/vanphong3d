// "Open a folder": the computer's own folder dialog, shown on the screen of the machine that runs the office (Windows,
// macOS, and Linux with zenity or kdialog), so a working folder is chosen, never typed. Only this computer can ask for it.
// -> { ok: true, path } | { ok: false, code: 'cancelled' | 'unsupported' | 'busy' | 'failed' }
import { spawn as nodeSpawn } from 'node:child_process';

const WIN = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::EnableVisualStyles(); $o = New-Object System.Windows.Forms.Form; $o.TopMost = $true; $o.ShowInTaskbar = $false; $o.StartPosition = "CenterScreen"; $o.Size = New-Object System.Drawing.Size(1, 1); $o.Show(); $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowNewFolderButton = $true; if ($f.ShowDialog($o) -eq "OK") { [Console]::Out.Write($f.SelectedPath) }';

/** [command, args] to run for a platform's folder dialog, or null where there is none. */
export function dialogFor(platform, title = 'Folder') {
  if (platform === 'win32') return ['powershell.exe', ['-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-Command', WIN]];
  if (platform === 'darwin') return ['osascript', ['-e', `POSIX path of (choose folder with prompt "${String(title).replace(/["\\]/g, '')}")`]];
  return ['zenity', ['--file-selection', '--directory', `--title=${title}`]];
}

export function createPicker({ platform = process.platform, spawn = nodeSpawn, timeout = 5 * 60e3 } = {}) {
  let busy = false;
  return function pick(title) {
    if (busy) return Promise.resolve({ ok: false, code: 'busy' });
    const cmd = dialogFor(platform, title); if (!cmd) return Promise.resolve({ ok: false, code: 'unsupported' });
    busy = true;
    return new Promise((resolve) => {
      let out = '', done = false, proc, timer = 0;
      const finish = (r) => { if (done) return; done = true; busy = false; clearTimeout(timer); resolve(r); };
      try { proc = spawn(cmd[0], cmd[1], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: false }); } catch { finish({ ok: false, code: 'unsupported' }); return; }
      timer = setTimeout(() => { try { proc.kill(); } catch { /* gone */ } finish({ ok: false, code: 'cancelled' }); }, timeout);
      proc.stdout.on('data', (c) => { if (out.length < 4096) out += c; });
      proc.on('error', () => finish({ ok: false, code: 'unsupported' }));
      proc.on('exit', () => {
        const p = out.trim().replace(/[\\/]+$/, (m) => (/^[A-Za-z]:[\\/]*$/.test(out.trim()) ? m : ''));
        finish(p ? { ok: true, path: p } : { ok: false, code: 'cancelled' });
      });
    });
  };
}
