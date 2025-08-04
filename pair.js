const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

// Config
const NUMBER_LINK = "https://wa.me/94776907496";
const IMAGE_URL = "https://raw.githubusercontent.com/shashika2008/-/refs/heads/main/file_000000007a5461f7b6d4c867938ac29b.png";

// Helper: Delete session folder
async function removeFile(filePath) {
  try {
    await fs.promises.rm(filePath, { recursive: true, force: true });
  } catch {}
}

// Helper: Random MEGA filename
function randomMegaId(length = 6, numberLength = 4) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  const number = Math.floor(Math.random() * Math.pow(10, numberLength))
    .toString()
    .padStart(numberLength, "0");
  return `${result}${number}`;
}

// Custom Caption Function
function getCustomCaption(sessionId) {
  return `┏━━━◥◣◆◢◤━━━━┓
Black wolf ﮩ٨ـﮩﮩ٨ـsl bot
╰┈➤ ❝ [powered by Shashika]

┗━━━◢◤◆◥◣━━━━┛


°•.•╔✿════๏⊙๏════✿╗•.•°
,💀 sessions id hear💀
.•°•.•. .•.•°•.
🖇️This is your session id🖇️
📍 Copy this id 👉 past into config.js fill 📍

${sessionId}

.•°•╚✿════๏⊙๏════✿╝•°•.

╔════▣◎▣════╗
Contact us ~(${NUMBER_LINK})
╚════▣◎▣════╝

°•.•╔✿════๏⊙๏════✿╗•.
        Thank you for joining .
               Black Wolf 
       ✿༻༺✿·.━⋅━⋅━╯`;
}

// Route
router.get("/", async (req, res) => {
  try {
    let num = req.query.number;
    if (!num || typeof num !== "string" || !num.match(/^\+?[0-9]+$/)) {
      return res.status(400).send({ error: "Invalid or missing number" });
    }

    num = num.replace(/[^0-9]/g, "");
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
      },
      printQRInTerminal: false,
      logger: pino({ level: "fatal" }),
      browser: Browsers.macOS("Safari"),
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        try {
          await delay(4000);
          const user_jid = jidNormalizedUser(sock.user.id);
          const mega_url = await upload(
            fs.createReadStream("./session/creds.json"),
            `${randomMegaId()}.json`
          );
          const sessionId = mega_url.replace("https://mega.nz/file/", "");
          const caption = getCustomCaption(sessionId);

          // Send Image + Caption
          await sock.sendMessage(user_jid, {
            image: { url: IMAGE_URL },
            caption,
          });

          // Optional: Send session ID & warning text
          await sock.sendMessage(user_jid, { text: sessionId });
          await sock.sendMessage(user_jid, {
            text: "🛑 Do not share this code with anyone 🛑",
          });

          await removeFile("./session");
        } catch (e) {
          console.error("Error sending session:", e);
          exec("pm2 restart prabath");
        }
      } else if (
        connection === "close" &&
        lastDisconnect?.error?.output?.statusCode !== 401
      ) {
        await delay(10000);
        console.log("Reconnecting after disconnect...");
      }
    });

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(num);
      return res.send({ code });
    } else {
      return res.send({ message: "Already registered" });
    }
  } catch (err) {
    console.error("Fatal error in pair.js:", err);
    exec("pm2 restart Robin-md");
    await removeFile("./session");
    if (!res.headersSent) {
      return res.status(503).send({ error: "Service Unavailable" });
    }
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  exec("pm2 restart Robin");
});

module.exports = router;
