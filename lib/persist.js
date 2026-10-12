// Railway par har redeploy me container ka disk saaf ho jata hai => linked WhatsApp sessions + settings ud jate the.
// Railway me Volume lagao (Service -> Settings -> Volumes -> Mount path: /data) to ye file
// `sessions/` aur `data/` folders ko us volume me save karne lagti hai (symlink), koi aur change nahi chahiye.
const fs = require('fs');
const path = require('path');

function setup() {
  const vol = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (!vol) {
    console.log('[persist] ⚠️ Volume nahi laga hai: redeploy/restart par linked WhatsApp numbers hat jayenge. ' +
      'Railway → Service → Settings → Volumes → Add Volume (mount path /data) lagao.');
    return;
  }
  const root = path.join(__dirname, '..');
  try {
    fs.mkdirSync(vol, { recursive: true });
    for (const name of ['sessions', 'data']) {
      const target = path.join(vol, name);
      const link = path.join(root, name);
      fs.mkdirSync(target, { recursive: true });
      let st = null;
      try { st = fs.lstatSync(link); } catch {}
      if (st?.isSymbolicLink()) {
        if (fs.realpathSync(link) === fs.realpathSync(target)) continue;
        fs.unlinkSync(link);
      } else if (st) {
        if (!fs.readdirSync(target).length) { try { fs.cpSync(link, target, { recursive: true }); } catch {} }
        fs.rmSync(link, { recursive: true, force: true });
      }
      fs.symlinkSync(target, link, 'dir');
    }
    console.log(`[persist] ✅ sessions + data permanent folder me save honge: ${vol}`);
  } catch (e) {
    console.error('[persist] volume setup fail:', e?.message || e);
  }
}

module.exports = { setup };
