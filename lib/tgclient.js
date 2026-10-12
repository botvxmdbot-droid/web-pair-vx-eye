// Chhota, bina-dependency Telegram Bot API client (node-telegram-bot-api ki jagah).
// Kyun: Railway par purani `request` library + IPv6 + Node 20/22 ki wajah se polling chup-chaap ruk jati thi.
// Ye seedha https (IPv4 force) se baat karta hai, har step ka saaf log deta hai, aur khud retry karta hai.
const https = require('https');
const http = require('http');
const fs = require('fs');
const { EventEmitter } = require('events');

class TgError extends Error {
  constructor(method, status, body, cause) {
    const desc = body?.description || cause?.message || `HTTP ${status}`;
    super(`${method}: ${desc}`);
    this.code = body ? 'ETELEGRAM' : (cause?.code || 'EFATAL');
    this.statusCode = status || 0;
    this.description = desc;
    this.parameters = body?.parameters;
  }
}

class TgClient extends EventEmitter {
  constructor(token, opts = {}) {
    super();
    this.token = token;
    this.base = new URL((opts.baseUrl || process.env.TG_API_BASE || 'https://api.telegram.org').replace(/\/$/, ''));
    this.lib = this.base.protocol === 'http:' ? http : https;
    this.agent = new this.lib.Agent({ keepAlive: true, family: 4, maxSockets: 20 });
    this.handlers = [];
    this.offset = 0;
    this.polling = false;
    this.stats = { updates: 0, lastUpdateAt: 0, lastError: '', lastErrorAt: 0, pollLoops: 0 };
  }

  _call(method, params = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const body = Buffer.from(JSON.stringify(params));
      const req = this.lib.request({
        protocol: this.base.protocol, hostname: this.base.hostname, port: this.base.port || undefined,
        path: `${this.base.pathname.replace(/\/$/, '')}/bot${this.token}/${method}`,
        method: 'POST', agent: this.agent, family: 4,
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let j = null;
          try { j = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
          if (j?.ok) return resolve(j.result);
          reject(new TgError(method, res.statusCode, j || { description: `HTTP ${res.statusCode}` }));
        });
        res.on('error', (e) => reject(new TgError(method, 0, null, e)));
      });
      req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('request timeout'), { code: 'ETIMEDOUT' })));
      req.on('error', (e) => reject(new TgError(method, 0, null, e)));
      req.end(body);
    });
  }

  // ---- API ----
  getMe() { return this._call('getMe'); }
  deleteWebHook(o = {}) { return this._call('deleteWebhook', { drop_pending_updates: true, ...o }); }
  setMyCommands(commands) { return this._call('setMyCommands', { commands }); }
  sendMessage(chat_id, text, o = {}) { return this._call('sendMessage', { chat_id, text: String(text), ...o }); }
  async sendPhoto(chat_id, photo, o = {}) {
    if (typeof photo === 'string' && !/^https?:\/\//i.test(photo) && fs.existsSync(photo)) {
      throw new Error('local photo path not supported, use a URL');
    }
    return this._call('sendPhoto', { chat_id, photo, ...o });
  }
  deleteMessage(chat_id, message_id) { return this._call('deleteMessage', { chat_id, message_id }); }

  // ---- handlers ----
  onText(re, cb) { this.handlers.push({ re, cb }); }

  _dispatch(update) {
    const msg = update.message || update.edited_message;
    if (!msg) return;
    this.emit('message', msg);
    if (typeof msg.text === 'string') {
      for (const h of this.handlers) {
        const m = h.re.exec(msg.text);
        if (m) Promise.resolve().then(() => h.cb(msg, m)).catch((e) => console.error('[Telegram] handler error:', e?.stack || e?.message || e));
      }
    }
  }

  // ---- polling ----
  async startPolling() {
    if (this.polling) return;
    this.polling = true;
    this._loop();
  }
  async stopPolling() { this.polling = false; }

  async _loop() {
    let fails = 0;
    while (this.polling) {
      this.stats.pollLoops++;
      try {
        // allowed_updates: pehle kisi aur host ne restrict kiya ho to bhi 'message' aaye
        const ups = await this._call('getUpdates', { offset: this.offset, timeout: 25, allowed_updates: ['message', 'edited_message'] }, 45000);
        fails = 0;
        for (const u of ups) {
          this.offset = Math.max(this.offset, u.update_id + 1);
          this.stats.updates++;
          this.stats.lastUpdateAt = Date.now();
          try { this._dispatch(u); } catch (e) { console.error('[Telegram] dispatch error:', e?.message || e); }
        }
      } catch (e) {
        fails++;
        this.stats.lastError = e.message;
        this.stats.lastErrorAt = Date.now();
        this.emit('polling_error', e);
        const wait = e.statusCode === 409 ? 5000 : Math.min(1000 * fails, 10000);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
}

module.exports = TgClient;
