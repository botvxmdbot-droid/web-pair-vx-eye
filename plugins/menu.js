import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../lib/client.js";
import { Module, getEffectiveCommands, commands as commandRegistry } from "../lib/plugins.js";
import config from "../config.js";

/* -------------------------------------------------------------------------- */
/* PATH                                                                       */
/* -------------------------------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

const name = "♡ 𝗩𝗫 𝗠𝗗 𝗕𝗢𝗧 ♡";

/*
 * ============================================================================
 * MENU DP
 * ============================================================================
 *
 * আপনার DP এখানে রাখুন:
 *
 * plugins/bin/menu.jpg
 *
 * ============================================================================
 */

const MENU_DP = path.join(
  __dirname,
  "bin",
  "menu.jpg"
);


/*
 * ============================================================================
 * MENU SONG
 * ============================================================================
 *
 * আপনার গান এখানে রাখুন:
 *
 * plugins/bin/menu.mp3
 *
 * Menu পাঠালে:
 *
 * 1. প্রথমে DP যাবে
 * 2. তারপর গান পাঠানো হবে
 *
 * ============================================================================
 */

const MENU_SONG = path.join(
  __dirname,
  "bin",
  "menu.mp3"
);


/* -------------------------------------------------------------------------- */
/* RUNTIME                                                                    */
/* -------------------------------------------------------------------------- */

const runtime = (secs) => {
  const pad = (s) =>
    String(s).padStart(2, "0");

  const h = Math.floor(
    secs / 3600
  );

  const m = Math.floor(
    (secs % 3600) / 60
  );

  const s = Math.floor(
    secs % 60
  );

  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
};

const readMore =
  String.fromCharCode(8206)
    .repeat(4001);


/* -------------------------------------------------------------------------- */
/* CHECK DP                                                                   */
/* -------------------------------------------------------------------------- */

function hasMenuDP() {
  try {
    return fs.existsSync(MENU_DP);
  } catch {
    return false;
  }
}


/* -------------------------------------------------------------------------- */
/* CHECK SONG                                                                 */
/* -------------------------------------------------------------------------- */

function hasMenuSong() {
  try {
    return fs.existsSync(MENU_SONG);
  } catch {
    return false;
  }
}

const BENGALI_MENU =
  `╭━━━〔 𝗩𝗫 𝗠𝗗 𝗕𝗢𝗧 • বাংলা গ্রুপ 〕━━━╮\n` +
  `┃ ✨ এক ডটের অজানা লেখা common text হিসেবে যাবে\n` +
  `┃ 💬 .hello / .hi / .যা খুশি — normal text\n` +
  `┃ 🎞️ .sticker / .bsticker — anime sticker\n` +
  `┃ 🏷️ .tagsticker @member — tag reaction\n` +
  `┃ ↩️ .replysticker — reply reaction\n` +
  `┃ 💋 .kiss @member — anime kiss sticker\n` +
  `┃ 💃 .dance — নাচ\n` +
  `┃ 🤗 .hug @member — জড়িয়ে ধরা\n` +
  `┃ ❤️ .love @member — ভালোবাসা\n` +
  `┃ 💍 .propose @member — প্রপোজ\n` +
  `┃ 💞 .couple @a @b — জুটি\n` +
  `┃ 😂 .roast @member — মজার roast\n` +
  `┃ 🫵 .slap / .bonk @member — মজার reaction\n` +
  `┃ 🤝 .highfive @member — হাই-ফাইভ\n` +
  `┃ 😉 .wink / .blush — reaction\n` +
  `┃ 😭 .cry / .sad — কান্না\n` +
  `┃ 😡 .angry / .রাগ — রাগ\n` +
  `┃ 🌸 .shayari — বাংলা শায়েরি\n` +
  `┃ 📖 .golpo — বাংলা গল্প\n` +
  `┃ 🤣 .joke — বাংলা কৌতুক\n` +
  `┃ 🧠 .fact — মজার তথ্য\n` +
  `┃ 🎯 .truth / .dare — Truth & Dare\n` +
  `┃ 🧩 .quiz — বাংলা কুইজ\n` +
  `┃ 👥 .groupinfo — গ্রুপের তথ্য\n` +
  `┃ 👑 .adminlist — অ্যাডমিন তালিকা\n` +
  `┃ 🪙 .coin / .dice — খেলাধুলা\n` +
  `┃ 🖼️ .animephoto Naruto — anime ছবি\n` +
  `┃ ▶️ .ytbangla গান — YouTube সার্চ\n` +
  `┃ 🎵 .গান <নাম> — গান শুনুন\n` +
  `┃ ✍️ .saysticker <লেখা> — নিজের লেখা sticker\n` +
  `┃ 😎 .মুড — আজকের mood\n` +
  `┃ 📜 .rules — গ্রুপের নিয়ম\n` +
  `┃ 🛠️ .grouphelp — বাংলা গ্রুপ সাহায্য\n` +
  `┃ 👻 .d — নতুন বাংলা ভূতের গল্প (শুধু লেখা)\n` +
  `┃ ❤️ .a — নতুন বাংলা প্রেমের গল্প (শুধু লেখা)\n` +
  `┃ 😂 .b — নতুন বাংলা মজার গল্প (শুধু লেখা)\n` +
  `┃ 🕵️ .t — নতুন বাংলা রহস্য/থ্রিলার গল্প\n` +
  `┃ 💙 .e — নতুন বাংলা আবেগের গল্প\n` +
  `┃ 🤝 .f — নতুন বাংলা বন্ধুত্বের গল্প\n` +
  `┃ 📚 .g — পড়াশোনা ও অনুপ্রেরণার গল্প\n` +
  `┃ 🏛️ .h — ইতিহাস ও ঐতিহ্যের গল্প\n` +
  `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;


/* -------------------------------------------------------------------------- */
/* BUILD COMMAND LIST                                                         */
/* -------------------------------------------------------------------------- */

const REQUESTED_COMMANDS = {
  owner: ["setgoodbyetype","setownertype","setwelcometype","swgc","swgcall","swgcv2","swgcv2all","anticall"],
  search: ["playch","searchthatsong","yts","play3"],
  group: ["antibot","antihidetag","antijudol","antispam","antiremove","antiphising","antitoxic","jadwalgroup","grouptime","groupclose","groupopen","notifopengroup","setppgc","setintro","getpp","delppgc","linkblast","stickerblast","stopbulk"],
  panel: ["listadminv1","listadminv2","listadminv3","listadminv4","listadminv5"]
};

function buildGroupedCommands(message) {
  const cmds = getEffectiveCommands();

  // Gaming commands are shown in the full/category menu only when Gaming is
  // enabled for the current group. The setting is per bot + group.
  const botNum =
    message?.botnum ||
    message?.conn?.user?.id ||
    message?.conn?.user?.jid ||
    "";
  const cleanBotNum = String(botNum).split("@")[0].split(":")[0].replace(/\D/g, "");
  const gamingKey = message?.isGroup
    ? `gaming:${message.from}:enabled`
    : null;
  const aiGroupKey = message?.isGroup
    ? `aifather:${message.from}:enabled`
    : null;
  const gamingOn =
    !!gamingKey &&
    !!cleanBotNum &&
    db.get(cleanBotNum, gamingKey, false) === true;
  const aiGroupOn =
    !!aiGroupKey &&
    !!cleanBotNum &&
    db.get(cleanBotNum, aiGroupKey, false) === true;

  const grouped = cmds
    .filter((cmd) => {
      if (!cmd || !cmd.command || cmd.command === "undefined") return false;
      const pkg = String(cmd.package || "").toLowerCase();
      if (pkg === "gaming" && !gamingOn) return false;
      if (pkg === "aigroup" && !aiGroupOn) return false;
      return true;
    })
    .reduce((acc, cmd) => {
      const pkg = String(cmd.package || "uncategorized").toLowerCase();
      if (!acc[pkg]) acc[pkg] = [];
      acc[pkg].push(cmd.command);
      return acc;
    }, {});

  // These are the commands explicitly requested for this Miku build.  Keep
  // them visible even if another plugin with the same name was disabled by a
  // feature flag; the real command is still registered by its own plugin.
  for (const [pkg, requested] of Object.entries(REQUESTED_COMMANDS)) {
    if (!grouped[pkg]) grouped[pkg] = [];
    for (const command of requested) {
      if (!grouped[pkg].includes(command)) grouped[pkg].push(command);
    }
  }

  return grouped;
}


/* -------------------------------------------------------------------------- */
/* MENU COMMAND                                                               */
/* -------------------------------------------------------------------------- */

Module({
  command: "menu",
  package: "general",
  description:
    "সব কমান্ড বা নির্দিষ্ট বিভাগ দেখায়"
})(async (message, match) => {

  try {

    /* ---------------------------------------------------------------------- */
    /* REACTION                                                               */
    /* ---------------------------------------------------------------------- */

    try {
      await message.react("🤖");
    } catch {}


    /* ---------------------------------------------------------------------- */
    /* BOT INFORMATION                                                        */
    /* ---------------------------------------------------------------------- */

    const time =
      new Date().toLocaleTimeString(
        "en-ZA",
        {
          timeZone:
            "Africa/Johannesburg",
        }
      );

    const isPublic =
      db.get(
        message.botnum,
        "mode",
        true
      ) === true;

    const userName =
      message.pushName ||
      "User";

    const usedGB = (
      (
        os.totalmem() -
        os.freemem()
      ) /
      1073741824
    ).toFixed(2);

    const totGB = (
      os.totalmem() /
      1073741824
    ).toFixed(2);

    const ram =
      `${usedGB} / ${totGB} GB`;


    /* ---------------------------------------------------------------------- */
    /* COMMAND GROUPS                                                         */
    /* ---------------------------------------------------------------------- */

    const grouped =
      buildGroupedCommands(message);

    const categories =
      Object.keys(grouped)
        .sort();

    let menuText = "";


    /* ---------------------------------------------------------------------- */
    /* SPECIFIC PACKAGE                                                       */
    /* ---------------------------------------------------------------------- */

    const requestedPackage = String(match || "").trim().toLowerCase();
    const isBengaliMenu = [
      "bangla",
      "bengali",
      "বাংলা",
      "বাংলাfun",
      "gfun",
      "group-fun",
    ].includes(requestedPackage);

    if (isBengaliMenu) {
      menuText += `\n${BENGALI_MENU}\n`;
    } else if (
      match &&
      grouped[requestedPackage]
    ) {

      const pack = requestedPackage;

      menuText +=
        `\n*╭────❒ ${pack.toUpperCase()} ❒⁠⁠⁠⁠*\n`;

      grouped[pack]
        .sort((a, b) => a.localeCompare(b))
        .forEach((cmdName) => {
          menuText += `*├◈ ${cmdName}*\n`;
        });

      menuText += `*┕──────────────────❒*\n`;

    }


    /* ---------------------------------------------------------------------- */
    /* FULL MENU                                                              */
    /* ---------------------------------------------------------------------- */

    else {

      /*
       * ======================================================================
       * NEW MENU HEADER
       * ======================================================================
       */

      const totalCommands = categories.reduce(
        (sum, cat) => sum + grouped[cat].length,
        0
      );

      menuText +=
        `\n` +
        `╭━━━〔 ✦ 𝗩𝗫 𝗠𝗗 𝗕𝗢𝗧 ✦ 〕━━━╮\n` +
        `┃ 👤 User     : @${userName}\n` +
        `┃ 🤖 Bot      : 𝗩𝗫 𝗠𝗗 𝗕𝗢𝗧\n` +
        `┃ 🧠 Version  : 1.0.0\n` +
        `┃ ⚡ Mode     : ${isPublic ? "PUBLIC" : "PRIVATE"}\n` +
        `┃ 📦 Commands : ${totalCommands}\n` +
        `┃ 👑 Owner    : 𝗠𝗢𝗡𝗦𝗧𝗘𝗥 \n` +
        `┃ 👑 2nd Owner: 𝗟𝗢𝗖𝗞 𝗕𝗜𝗧 𝗚𝗔𝗡𝗚\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
        `\n` +
        `╭━━〔 📚 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗠𝗘𝗡𝗨 〕━━╮\n` +
        `┃ 💡 Type *${config.prefix || "."}menu <category>* for one section\n` +
        `┃ ✨ Type *${config.prefix || "."}menu* for everything\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;


      /* -------------------------------------------------------------------- */
      /* PACKAGE NOT FOUND                                                    */
      /* -------------------------------------------------------------------- */

      if (
        match &&
        !grouped[
          String(match)
            .toLowerCase()
        ]
      ) {

        menuText +=
          `\n🍌 *Package not found: ${match}*\n\n`;

        menuText +=
          `*Available Packages*:\n`;

        categories.forEach(
          (cat) => {

            menuText +=
              `├◈ ${cat}\n`;

          }
        );

      }


      /* -------------------------------------------------------------------- */
      /* ALL PACKAGES                                                         */
      /* -------------------------------------------------------------------- */

      else {

        for (
          const cat of categories
        ) {

          menuText +=
            `\n╭━━〔 ✦ ${cat.toUpperCase()} ✦ 〕━━╮\n`;

          grouped[cat]
            .sort((a, b) =>
              a.localeCompare(b)
            )
            .forEach(
              (cmdName) => {

                if (
                  cat === "group" &&
                  cmdName === "gstatus"
                ) {

                  menuText +=
                    `┃ ✧ *${cmdName}* _(${"gs / groupstatus / gcstatus"})_\n`;

                } else {

                  menuText +=
                    `┃ ✧ *${cmdName}*\n`;

                }

              }
            );

          menuText +=
            `╰━━━━━━━━━━━━━━━━━━━━╯\n`;
        }
      }

      /* -------------------------------------------------------------------- */
      /* BENGALI ANIME VIDEO STICKER / GROUP FUN                            */
      /* -------------------------------------------------------------------- */

      menuText += `\n${BENGALI_MENU}\n`;

      menuText +=
        `\n╭━━〔 💖 𝗩𝗫 𝗠𝗗 𝗕𝗢𝗧 〕━━╮\n` +
        `┃ 🌸 Made with love & code\n` +
        `┃ 📲 Telegram: @vx_md_bot_1\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯`;
    }


    /* ---------------------------------------------------------------------- */
    /* SEND MENU DP                                                           */
    /* ---------------------------------------------------------------------- */

    if (hasMenuDP()) {

      await message.conn.sendMessage(
        message.from,
        {
          image:
            fs.readFileSync(
              MENU_DP
            ),

          caption:
            menuText,

          mimetype:
            "image/jpeg",

          contextInfo: {
            forwardingScore: 2,

            isForwarded: true,

            forwardedNewsletterMessageInfo: {
              newsletterJid:
                "120363410099245350@newsletter",

              newsletterName:
                "© 𝗩𝗫 𝗠𝗗 𝗕𝗢𝗧",

              serverMessageId: 6,
            },
          },
        },
        {
          quoted:
            message.key
              ? {
                  key:
                    message.key,

                  message: {
                    conversation:
                      "Menu",
                  },
                }
              : undefined,
        }
      );

    } else {

      /* -------------------------------------------------------------------- */
      /* DP NOT FOUND                                                         */
      /* -------------------------------------------------------------------- */

      console.error(
        `[MENU] DP not found: ${MENU_DP}`
      );

      await message.conn.sendMessage(
        message.from,
        {
          text:
            menuText +
            `\n\n⚠️ *মেনুর ছবি পাওয়া যায়নি!*\n` +
            `📁 প্রয়োজনীয় ফাইল:\n` +
            `\`plugins/bin/menu.jpg\``,
        },
        {
          quoted:
            message.key
              ? {
                  key:
                    message.key,

                  message: {
                    conversation:
                      "Menu",
                  },
                }
              : undefined,
        }
      );
    }


    /* ---------------------------------------------------------------------- */
    /* SEND MENU SONG                                                         */
    /* ---------------------------------------------------------------------- */

    if (hasMenuSong()) {

      try {

        await message.conn.sendMessage(
          message.from,
          {
            audio:
              fs.readFileSync(
                MENU_SONG
              ),

            mimetype:
              "audio/mpeg",

            fileName:
              "VX-MD-MENU.mp3",

            ptt: false,

            contextInfo: {
              forwardingScore: 2,

              isForwarded: true,

              forwardedNewsletterMessageInfo: {
                newsletterJid:
                  "120363410099245350@newsletter",

                newsletterName:
                  "© 𝗩𝗫 𝗠𝗗 𝗕𝗢𝗧",

                serverMessageId: 7,
              },
            },
          },
          {
            quoted:
              message.key
                ? {
                    key:
                      message.key,

                    message: {
                      conversation:
                        "Menu Song",
                    },
                  }
                : undefined,
          }
        );

      } catch (songError) {

        console.error(
          "❌ Menu song send error:",
          songError
        );

      }

    } else {

      console.log(
        `[MENU] Song not found: ${MENU_SONG}`
      );

    }


    /* ---------------------------------------------------------------------- */
    /* SUCCESS REACTION                                                       */
    /* ---------------------------------------------------------------------- */

    try {
      await message.react("✅");
    } catch {}


  } catch (err) {

    console.error(
      "❌ Menu command error:",
      err?.stack ||
        err?.message ||
        err
    );

    try {

      await message.conn.sendMessage(
        message.from,
        {
          text:
            `❌ মেনুতে সমস্যা:\n\n` +
            `${
              err?.message ||
              err
            }`,
        }
      );

    } catch {}
  }
});


/* -------------------------------------------------------------------------- */
/* LIST COMMAND                                                               */
/* -------------------------------------------------------------------------- */

Module({
  command: "list",
  package: "general",
  description:
    "সব কমান্ডের তালিকা দেখায়",
})(async (message) => {

  try {

    const commands =
      getEffectiveCommands()
        .filter(
          (cmd) =>
            cmd &&
            cmd.command &&
            cmd.command !==
              "undefined"
        )
        .map(
          (cmd) =>
            cmd.command
        )
        .join("\n");

    await message.conn.sendMessage(
      message.from,
      {
        text:
          `*📜 LIST OF COMMANDS*\n\n` +
          commands,
      }
    );

  } catch (err) {

    console.error(
      "❌ List command error:",
      err
    );

    await message.conn.sendMessage(
      message.from,
      {
        text:
          `❌ Error: ${
            err?.message || err
          }`,
      }
    );
  }
});


/* -------------------------------------------------------------------------- */
/* ALIVE COMMAND                                                              */
/* -------------------------------------------------------------------------- */

Module({
  command: "alive",
  package: "general",
  description:
    "বট চালু আছে কি না দেখায়",
})(async (message) => {

  try {

    const hostname =
      os.hostname();

    const time =
      new Date().toLocaleTimeString(
        "en-ZA",
        {
          timeZone:
            "Africa/Johannesburg",
        }
      );

    const ramUsedMB = (
      process.memoryUsage()
        .heapUsed /
      1024 /
      1024
    ).toFixed(2);

    const uptime =
      process.uptime();

    const hours =
      Math.floor(
        uptime / 3600
      );

    const minutes =
      Math.floor(
        (uptime % 3600) / 60
      );

    const seconds =
      Math.floor(
        uptime % 60
      );

    const ctx =
      `*${name}* is online\n\n` +

      `*Time:* ${time}\n` +

      `*Host:* ${hostname}\n` +

      `*RAM Usage:* ${ramUsedMB} MB\n` +

      `*Uptime:* ` +
      `${hours}h ${minutes}m ${seconds}s`;


    /* ---------------------------------------------------------------------- */
    /* ALIVE WITH SAME PERSONAL DP                                            */
    /* ---------------------------------------------------------------------- */

    if (hasMenuDP()) {

      await message.conn.sendMessage(
        message.from,
        {
          image:
            fs.readFileSync(
              MENU_DP
            ),

          caption:
            ctx,

          mimetype:
            "image/jpeg",
        }
      );

    } else {

      await message.conn.sendMessage(
        message.from,
        {
          text: ctx,
        }
      );
    }

  } catch (err) {

    console.error(
      "❌ Alive command error:",
      err
    );

    await message.conn.sendMessage(
      message.from,
      {
        text:
          `❌ Error: ${
            err?.message || err
          }`,
      }
    );
  }
});
