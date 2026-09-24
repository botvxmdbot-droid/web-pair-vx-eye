import fs from "fs";
import path from "path";
import { Module } from "../lib/plugins.js";
import config from "../config.js";

// The raw plugin message has NO `isOwner` flag, so the old check
// (`message.isOwner`) was always false and every try ended with "Owner only".
// Same owner logic as the other owner commands (bot itself / OWNER_NUMBER / SUDO).
function isOwnerMessage(m) {
  if (m?.isFromMe || m?.isfromMe || m?.fromMe || m?.key?.fromMe || m?.isOwner) return true;
  const num = String(m?.sender || "").split("@")[0].split(":")[0].replace(/\D/g, "");
  const owners = [config.owner, config.sudo]
    .map((x) => String(x || "").replace(/\D/g, ""))
    .filter(Boolean);
  return Boolean(num) && owners.includes(num);
}

const WELCOME_VIDEO_PATHS = [
  path.join(process.cwd(), "media", "welcome.mp4"),
  path.join(process.cwd(), "plugins", "bin", "welcome.mp4"),
];

function isVideoMessage(msg) {
  const mime = String(
    msg?.content?.mimetype ||
    msg?.msg?.mimetype ||
    msg?.mimetype ||
    ""
  ).toLowerCase();

  return (
    msg?.type === "videoMessage" ||
    mime.startsWith("video/") ||
    mime.includes("mp4")
  );
}

Module({
  command: "setwelcomevideo",
  aliases: ["welcomemp4", "setwlcvideo", "welcomevideo"],
  package: "owner",
  description: "WhatsApp se MP4 welcome video change karein (reply to MP4)",
})(async (message) => {
  try {
    if (!isOwnerMessage(message)) {
      return message.send?.("❌ Owner only.");
    }

    const quoted = message.quoted || (isVideoMessage(message) ? message : null);
    if (!quoted) {
      return message.send?.(
        "❌ MP4 welcome video par reply karke command bhejein.\n\n" +
        "Example: .setwelcomevideo"
      );
    }

    if (!isVideoMessage(quoted)) {
      return message.send?.(
        "❌ Sirf video/MP4 message par reply karein."
      );
    }

    await message.react?.("⏳");

    const buffer = await quoted.download?.();
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Video download failed");
    }

    // Keep the same filename/path used by the existing welcome system.
    // Write both supported locations so the change works with either runtime path.
    for (const target of WELCOME_VIDEO_PATHS) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buffer);
    }

    await message.react?.("✅");
    return message.send?.(
      "✅ *WELCOME MP4 VIDEO UPDATED*\n\n" +
      "WhatsApp se bheja hua MP4 ab V6 Video Welcome mein use hoga.\n" +
      "Ye global bot welcome video hai, isliye sab groups mein same video chalega."
    );
  } catch (err) {
    console.error("[setwelcomevideo] error:", err?.stack || err);
    await message.react?.("❌");
    return message.send?.(
      "❌ Welcome MP4 update nahi ho saka.\n" +
      `Reason: ${err?.message || "Unknown error"}`
    );
  }
});
