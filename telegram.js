// Public Telegram pairing bot - koi bhi user apna WhatsApp number link kar sakta hai
const TelegramBot = require('./lib/tgclient');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { startSession, dropSession, logoutSession, isActive, isConnected, activeCount } = require('./lib/sessionManager');

if (!config.tgToken || config.tgToken.startsWith('PASTE_')) {
  console.error('❌ Telegram disabled: Railway → Variables me TG_TOKEN (BotFather token) add karein.');
  module.exports = null;
  return;
}

// IPv4 force: Railway par kabhi kabhi api.telegram.org IPv6 par atak jata hai (bot chup ho jata hai).
// polling:false -> pehle webhook hatayenge, token check karenge, phir hi polling start hogi.
config.tgToken = String(config.tgToken).trim().replace(/^["']|["']$/g, '');   // Railway variable me space/quote ho to hata do
const tg = new TelegramBot(config.tgToken);
tg.on('error', (e) => console.error('[Telegram bot error]', e?.message || e));

// index.js ka health server isse /status par dikhata hai (Railway domain kholkar bot ka haal dekh sakte ho)
const status = (global.__tgStatus = { username: '', polling: false, tokenOk: false, startError: '' });
tg.on('message', (m) => console.log(`[Telegram] ← ${m.chat?.type || '?'} ${m.from?.username || m.from?.id || '?'}: ${String(m.text || '').slice(0, 60)}`));
global.__tgStats = () => ({ updatesReceived: tg.stats.updates, lastUpdateAgoSec: tg.stats.lastUpdateAt ? Math.round((Date.now() - tg.stats.lastUpdateAt) / 1000) : null, lastPollError: tg.stats.lastError || null });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastPollLog = 0;
let stopping = false;
tg.on('polling_error', (e) => {
  const code = e?.code || '';
  const desc = e?.description || e?.message || String(e);
  // Har second ek hi error se logs na bharein: 30 sec me ek baar dikhao
  if (Date.now() - lastPollLog < 30000) return;
  lastPollLog = Date.now();
  if (/409/.test(desc) || /Conflict/i.test(desc)) {
    console.error('[Telegram] ❌ 409 Conflict: ye BOT TOKEN kahin aur (purana Railway deploy / panel / PC / dusra service) bhi chal raha hai. ' +
      'Dusri jagah band karo ya BotFather me /revoke se naya token lo aur Railway Variables me TG_TOKEN update karo.');
  } else if (/401|Unauthorized/i.test(desc)) {
    console.error('[Telegram] ❌ 401 Unauthorized: TG_TOKEN galat ya revoke ho chuka hai. BotFather se sahi token lekar Railway Variables → TG_TOKEN me daalo.');
  } else {
    console.error(`[Telegram polling error] ${code} ${desc}`);
  }
});

// Token verify -> webhook hatao -> commands set -> polling (fail ho to khud retry karta rahega)
async function startTelegram() {
  for (let attempt = 1; !stopping; attempt++) {
    try {
      const me = await tg.getMe();
      status.tokenOk = true;
      // Agar is token par pehle kabhi webhook laga ho to getUpdates (polling) kaam hi nahi karta => bot kuch reply nahi deta
      try { await tg.deleteWebHook(); } catch (e) { console.error('[Telegram] deleteWebhook:', e?.message || e); }
      try {
        await tg.setMyCommands([
          { command: 'start', description: 'Start / help' },
          { command: 'help', description: 'Show commands' },
          { command: 'pair', description: 'Pair WhatsApp number' },
          { command: 'unpair', description: 'Disconnect your linked number' },
        ]);
      } catch (e) { console.error('[Telegram] setMyCommands:', e?.message || e); }
      await tg.startPolling();
      botUsername = me.username || '';
      status.username = botUsername; status.polling = true;
      if (botUsername && !process.env.TELEGRAM_PAIR_LINK && !process.env.TG_LINK) {
        // Menu / buttons me hamesha is asli bot ka link jaye
        config.telegramLink = `https://t.me/${botUsername}`;
        process.env.TELEGRAM_PAIR_LINK = config.telegramLink;
      }
      console.log('==============================================================');
      console.log(`✅ Telegram connected: @${botUsername || me.first_name} (id ${me.id})`);
      console.log(`👉 Telegram me ye bot search karo: @${botUsername}   |   link: https://t.me/${botUsername}`);
      console.log('👉 Phir bhejo: /pair 919XXXXXXXXX');
      console.log('==============================================================');
      return;
    } catch (e) {
      const desc = e?.response?.body?.description || e?.message || String(e);
      const fatal = e?.statusCode === 401 || e?.statusCode === 404;
      status.startError = desc;
      console.error(`[Telegram] startup try ${attempt} fail: ${desc}`);
      if (fatal) {
        console.error('[Telegram] ❌ TOKEN GALAT HAI. Railway → Variables → TG_TOKEN me BotFather ka sahi token daalo.');
        return;
      }
      await sleep(Math.min(5000 * attempt, 30000));
    }
  }
}
let botUsername = '';
startTelegram();

// Railway redeploy par SIGTERM aata hai: polling band karo taaki naya deploy 409 conflict me na phase
const shutdown = async () => {
  stopping = true;
  try { await tg.stopPolling(); } catch {}
  process.exit(0);
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

// number -> telegram userId (taaki sirf owner hi apna number unpair kar sake)
const OWN_FILE = path.join(__dirname, 'data', 'tgusers.json');
fs.mkdirSync(path.dirname(OWN_FILE), { recursive: true });
let owners = {};
try { owners = JSON.parse(fs.readFileSync(OWN_FILE, 'utf8')); } catch {}
const saveOwners = () => fs.writeFileSync(OWN_FILE, JSON.stringify(owners, null, 2));

const md = { parse_mode: 'Markdown' };

// ---- WhatsApp channel / Telegram buttons + DP ----
const ui = require('./lib/ui');
const waButtons = () => {
  const rows = ui.channelLinks().filter((c) => c.link).map((c, i) => [{ text: `📢 ${c.name || 'WhatsApp Channel ' + (i + 1)}`, url: c.link }]);
  if (config.telegramLink) rows.push([{ text: '✈️ Telegram', url: config.telegramLink }]);
  return rows.length ? { inline_keyboard: rows } : undefined;
};
const pairDp = () => config.tgPairDp || ui.dpUrl();
const successDp = () => config.tgSuccessDp || ui.dpUrl();
// DP + caption + buttons; photo na jaye to sirf text. autoDeleteSec ke baad message delete.
// copyText dene par neeche "Copy" button aata hai (Telegram copy_text button).
const AUTO_DELETE_SEC = 60;
const later = (chatId, m, sec = AUTO_DELETE_SEC) => {
  if (m?.message_id) setTimeout(() => tg.deleteMessage(chatId, m.message_id).catch(() => {}), sec * 1000);
  return m;
};
async function sendDp(chatId, photo, caption, { copyText, autoDelete = AUTO_DELETE_SEC, replyTo } = {}) {
  const kb = waButtons()?.inline_keyboard || [];
  if (copyText) kb.unshift([{ text: '📋 কপি করুন (Copy)', copy_text: { text: copyText } }]);
  const reply_markup = kb.length ? { inline_keyboard: kb } : undefined;
  const rp = replyTo ? { reply_to_message_id: replyTo, allow_sending_without_reply: true } : {};
  let m;
  try { m = await tg.sendPhoto(chatId, photo, { caption, parse_mode: 'Markdown', reply_markup, ...rp }); }
  catch (e) {
    console.error('TG photo:', e.message);
    m = await tg.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup, ...rp });
  }
  return autoDelete ? later(chatId, m, autoDelete) : m;
}

tg.onText(/^\/(start|help)(?:@\w+)?(?:\s|$)/i, (msg) => {
  tg.sendMessage(msg.chat.id,
    `👋 *${config.botName}* me swagat hai!\n\n` +
    `Apna WhatsApp number country code ke saath bhejo:\n\n` +
    `\`/pair 919XXXXXXXXX\`\n\n` +
    `• + ya space mat lagana\n` +
    `• Bot hatane ke liye: \`/unpair 919XXXXXXXXX\`\n\n` +
    `👑 Owner: ${config.ownerName}`, { ...md, reply_markup: waButtons() });
});

// number -> abhi tak ke code wale messages (naya /pair aaye to purana code turant hata do, taaki galti se purana code na dale)
const liveCodeMsgs = new Map();
const isGroupChat = (msg) => msg.chat.type === 'group' || msg.chat.type === 'supergroup';

// /pair  ya  /pair@BotName  — private chat aur Telegram group dono me chalega
tg.onText(/^\/pair(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;          // anonymous admin ke liye fallback
  const inGroup = isGroupChat(msg);
  const replyTo = msg.message_id;
  const rt = { reply_to_message_id: replyTo, allow_sending_without_reply: true };
  const number = (match[1] || '').replace(/\D/g, '');

  if (number.length < 10 || number.length > 15)
    return tg.sendMessage(chatId, '❌ সঠিক নম্বর দিন।\nউদাহরণ: `/pair 919876543210`', { ...md, ...rt }).catch(() => {});

  // Cooldown / limit nahi: jitni baar /pair karoge utni baar naya code milega (group me sabhi users ke liye unlimited)
  if (isConnected(number)) return tg.sendMessage(chatId, '⚠️ এই নম্বরটি আগে থেকেই কানেক্টেড আছে।', rt).catch(() => {});
  if (config.maxSessions > 0 && !inGroup && !isActive(number) && activeCount() >= config.maxSessions) return tg.sendMessage(chatId, '⚠️ সার্ভার পূর্ণ আছে, একটু পরে চেষ্টা করুন।', rt).catch(() => {});

  // Pehle ka atka hua / adhura pairing ya logout ke baad bacha session hatao => hamesha fresh code
  // (purane code ke messages bhi chat se hata do — sirf sabse naya code hi valid hota hai)
  const prev = liveCodeMsgs.get(number);
  if (prev) {
    liveCodeMsgs.delete(number);
    Promise.all(prev.list.map((x) => Promise.resolve(x).catch(() => null))).then((arr) =>
      arr.forEach((m) => m?.message_id && tg.deleteMessage(prev.chatId, m.message_id).catch(() => {}))).catch(() => {});
  }
  if (isActive(number)) dropSession(number);

  const waitMsg = await tg.sendMessage(chatId, '⏳ পেয়ারিং কোড তৈরি হচ্ছে, একটু অপেক্ষা করুন...', { reply_markup: waButtons(), ...rt }).catch(() => null);
  later(chatId, waitMsg);
  const codeMsgs = [waitMsg]; // connect hone par inhe delete karna hai
  liveCodeMsgs.set(number, { chatId, list: codeMsgs });

  try {
    await startSession(number, {
      onFail: () => {
        // code expire hua / connection toota — purana code hata kar batao
        const cur = liveCodeMsgs.get(number);
        if (cur && cur.list === codeMsgs) liveCodeMsgs.delete(number);
        Promise.all(codeMsgs.map((x) => Promise.resolve(x).catch(() => null))).then((arr) =>
          arr.forEach((m) => m?.message_id && tg.deleteMessage(chatId, m.message_id).catch(() => {}))).catch(() => {});
        tg.sendMessage(chatId, '⚠️ কোডটি মেয়াদোত্তীর্ণ বা সংযোগ বিচ্ছিন্ন হয়েছে। নতুন কোডের জন্য আবার `/pair ' + number + '` দিন।', { ...md, ...rt }).catch(() => {});
      },
      onCode: (code) => {
        owners[number] = userId;
        saveOwners();
        codeMsgs.push(sendDp(chatId, pairDp(),
          `📱 *নম্বর:* +${number}\n🔑 *আপনার পেয়ারিং কোড:*\n\n\`${code}\`\n\n` +
          `WhatsApp খুলুন → *Settings → Linked Devices → Link a Device →* ` +
          `"Link with phone number instead" → এই কোডটি দিন।\n\n` +
          `⚠️ কোডটি অল্প সময়ের মধ্যে মেয়াদ শেষ হয়ে যাবে।\n🗑️ এই মেসেজ ${AUTO_DELETE_SEC} সেকেন্ড পরে মুছে যাবে।`,
          { copyText: code, replyTo }).catch((e) => { console.error('TG code:', e.message); return null; }));
      },
      onOpen: async () => {
        // connect hote hi pairing code wala message Telegram se hata do
        const list = await Promise.race([
          Promise.all(codeMsgs.map((x) => Promise.resolve(x).catch(() => null))),
          new Promise((r) => setTimeout(() => r([]), 8000)),   // code msg 8 sec me na mile to success rukna nahi chahiye
        ]);
        await Promise.all(list.map((m) => m?.message_id ? tg.deleteMessage(chatId, m.message_id).catch(() => {}) : null));
        codeMsgs.length = 0;
        const okText = `✅ *WhatsApp সফলভাবে কানেক্ট হয়েছে!*\n📱 নম্বর: +${number}\nএখন WhatsApp-এ *${config.prefix}menu* পাঠান।\n🗑️ এই মেসেজ ${AUTO_DELETE_SEC} সেকেন্ড পরে মুছে যাবে।`;
        // Success: jis chat (group/private) me pair kiya wahan dikhao
        const sent = sendDp(chatId, successDp(), okText, { replyTo }).catch((e) => console.error('TG success:', e.message));
        // Group se pair kiya ho to personal chat me bhi success bhejo (user ne bot start kiya ho to)
        if (inGroup && msg.from?.id) sendDp(msg.from.id, successDp(), okText).catch(() => {});
        return sent;
      },
    });
  } catch (e) {
    console.error('pair error:', e.message);
    if (e.message === 'PAIR_BUSY') return tg.sendMessage(chatId, '⏳ এই নম্বরের জন্য কোড তৈরি হচ্ছে, ৫–১০ সেকেন্ড পরে আবার `/pair ' + number + '` দিন।', { ...md, ...rt }).catch(() => {});
    dropSession(number);
    tg.sendMessage(chatId, '❌ কোড তৈরি করা যায়নি। নম্বর যাচাই করুন এবং একটু পরে আবার চেষ্টা করুন।', rt).catch(() => {});
  }
});

tg.onText(/^\/unpair(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
  const number = (match[1] || '').replace(/\D/g, '');
  if (!isActive(number)) return tg.sendMessage(msg.chat.id, '❌ Ye number active nahi hai.');
  if (owners[number] !== msg.from.id) return tg.sendMessage(msg.chat.id, '❌ Ye number aapne link nahi kiya.');
  await logoutSession(number);
  delete owners[number];
  saveOwners();
  tg.sendMessage(msg.chat.id, '✅ Disconnect ho gaya.');
});


// Catch-all text handler: Telegram me normal text/galat command bhejne par bhi reply mile.
// Valid slash commands ko existing handlers process karte hain.
tg.on('message', async (msg) => {
  try {
    if (!msg?.text || msg.from?.is_bot) return;
    const text = msg.text.trim();
    // Known commands are handled by onText above; don't send duplicate replies.
    if (/^\/(?:start|help|pair|unpair)(?:@\w+)?(?:\s|$)/i.test(text)) return;
    if (text.startsWith('/')) {
      await tg.sendMessage(msg.chat.id,
        '❓ এই কমান্ডটি চিনতে পারিনি।\n\n' +
        'ব্যবহার করুন:\n' +
        '/start — শুরু / সাহায্য\n' +
        '/pair 919XXXXXXXXX — WhatsApp কানেক্ট\n' +
        '/unpair 919XXXXXXXXX — নিজের কানেকশন বন্ধ করুন',
        { reply_to_message_id: msg.message_id, allow_sending_without_reply: true });
      return;
    }
    await tg.sendMessage(msg.chat.id,
      '👋 আমি Telegram Pair Bot।\n\n' +
      'WhatsApp কানেক্ট করতে পাঠান:\n/pair 919XXXXXXXXX\n\n' +
      'সাহায্যের জন্য /help পাঠান।',
      { reply_to_message_id: msg.message_id, allow_sending_without_reply: true });
  } catch (e) {
    console.error('[Telegram message handler]', e?.response?.body?.description || e?.message || e);
  }
});

console.log('📨 Telegram pairing bot chal raha hai');
module.exports = tg;
