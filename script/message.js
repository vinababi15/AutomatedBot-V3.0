const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "message",
  version: "2.0.0",
  hasPermssion: 1,
  credits: "Vern",
  description: "Admin-controlled private messaging bot with target accept flow and custom messages",
  commandCategory: "admin",
  usages: "message <targetID> <text>",
  cooldowns: 3
};

// 🔐 Admin UIDs
const ADMIN_UIDS = [
  "61577300994025",
  "61578929660413"
];
const isAdmin = (uid) => ADMIN_UIDS.includes(uid);

// 💾 Data files
const targetsFile = path.join(__dirname, "privateTargets.json");
let targetsData = {};
if (fs.existsSync(targetsFile)) {
  targetsData = JSON.parse(fs.readFileSync(targetsFile, "utf8"));
}

// ⏱ Sleep utility
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 💾 Save targets
const saveTargets = () => {
  fs.writeFileSync(targetsFile, JSON.stringify(targetsData, null, 2), "utf8");
};

// 📝 Active conversations (only after target accepts)
let activeConversations = {};

module.exports.run = async function({ api, event, args }) {
  const { threadID, senderID, messageID } = event;

  if (!isAdmin(senderID)) return api.sendMessage("❌ Admin only command.", threadID, messageID);
  if (args.length < 2) {
    return api.sendMessage("📌 Usage: message <targetID> <text>", threadID, messageID);
  }

  const targetID = args.shift();
  const text = args.join(" ");

  // Save message to send for this target
  if (!targetsData[targetID]) targetsData[targetID] = [];
  targetsData[targetID].push({ fromAdmin: senderID, text });
  saveTargets();

  // Attempt to send initial message
  try {
    await api.sendMessage(text, targetID);
    return api.sendMessage(`✅ Message sent to target ID: ${targetID}. Bot will continue once target accepts.`, threadID, messageID);
  } catch (err) {
    return api.sendMessage(`❌ Failed to send message. Target may be in Message Requests: ${err.message}`, threadID, messageID);
  }
};

module.exports.handleEvent = async function({ api, event }) {
  const { senderID, threadID, body, messageID } = event;
  if (!body || senderID === api.getCurrentUserID()) return;

  // 1️⃣ If sender is a target who accepted the message
  if (targetsData[senderID]) {
    // Activate conversation if not already
    if (!activeConversations[senderID]) activeConversations[senderID] = true;

    // Forward message to all admins
    for (const adminID of ADMIN_UIDS) {
      await sleep(300);
      await api.sendMessage(`📩 Target ID ${senderID} replied:\n"${body}"`, adminID);
    }
    return;
  }

  // 2️⃣ If admin is sending a reply to target
  if (isAdmin(senderID) && body.startsWith("/reply")) {
    // Format: /reply <targetID> <message>
    const parts = body.split(" ");
    if (parts.length < 3) return;
    const targetID = parts[1];
    const text = parts.slice(2).join(" ");

    if (!activeConversations[targetID]) {
      return api.sendMessage(`❌ Target ID ${targetID} has not accepted the message yet.`, threadID);
    }

    await api.sendMessage(text, targetID);
    return api.sendMessage(`✅ Message sent to target ID ${targetID}.`, threadID);
  }

  // 3️⃣ Log unknown users to admins
  if (!isAdmin(senderID) && !targetsData[senderID]) {
    for (const adminID of ADMIN_UIDS) {
      await sleep(300);
      await api.sendMessage(`👤 User ID ${senderID} sent a message:\n"${body}"`, adminID);
    }
  }
};