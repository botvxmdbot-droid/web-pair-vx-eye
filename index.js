require('./lib/persist').setup();                           // Railway Volume (sessions/data redeploy par bache rahen)
const http = require('http');
const config = require('./config');
const { loadBaileys } = require('./lib/baileysLoader');

process.on('uncaughtException', (e) => console.error('uncaughtException:', e?.stack || e?.message || e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e?.stack || e?.message || e));

// Railway ko ek chalta hua port chahiye hota hai (web service); ye bas "OK" bolta hai
if (process.env.PORT) {
  http.createServer((req, res) => {
    // Railway domain kholo -> bot ka haal (token/secret nahi dikhta)
    const t = global.__tgStatus || {};
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, uptimeSec: Math.round(process.uptime()), node: process.version, telegram: { botUsername: t.username || null, tokenOk: !!t.tokenOk, polling: !!t.polling, startError: t.startError || null, ...(global.__tgStats ? global.__tgStats() : {}) } }, null, 2));
  })
    .listen(Number(process.env.PORT), '0.0.0.0', () => console.log(`🌐 health server port ${process.env.PORT}`));
}

(async () => {
  // Sabse pehle Baileys load + version check (baaki saari files iske baad load hoti hain)
  const b = await loadBaileys();
  console.log(`📦 Baileys ${b.version || '?'} | Node ${process.version}`);
  if (!b.groupStatus) {
    console.error(`⚠️  Ye Baileys version group status (.swgc/.gcstatus) support nahi karta.\n    Fix: ${b.fix}   (Node 20+ chahiye)`);
  }

  require('./telegram');                                   // Telegram public pairing
  const { restoreAll } = require('./lib/sessionManager');

  console.log(`🚀 ${config.botName} start ho gaya (owner: ${config.ownerName})`);
  restoreAll();                                            // purane connected numbers wapas chalao
  require('./lib/mediaDownload').ensureYtDlp().catch((e) => console.error('[yt-dlp]', e.message));   // song/video ke liye yt-dlp (background)
})().catch((e) => {
  console.error('❌ Start nahi ho paya:', e.message);
  process.exit(1);
});
