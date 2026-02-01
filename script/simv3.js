const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const threadsFile = path.join(__dirname, "sim_threads.json");

// 🔐 ADMIN UIDS (ADD MORE IF YOU WANT)
const ADMIN_UIDS = [
  "61577300994025",
  "61577300994025",
  "61561982970881",
  "61578929660413"

];

// 🔐 ADMIN CHECK
function isAdmin(uid) {
  return ADMIN_UIDS.includes(uid);
}

// Load active threads
function loadActiveThreads() {
  try {
    const data = fs.readFileSync(threadsFile, "utf8");
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

// Save active threads
function saveActiveThreads(set) {
  fs.writeFileSync(threadsFile, JSON.stringify([...set]), "utf8");
}

let activeSimThreads = loadActiveThreads();
let lastMessageTime = new Map();

// 🚫 Curse words
const curseWords = [
  "putangina", "tangina", "gago", "bobo", "fuck",
  "shit", "damn", "asshole", "pussy", "dick", "bitch"
];

// 🔥 Curse responses
const curseResponses = [
  "Ano problema mo? Admin lang kausap ko.",
  "Wag ka magmura, admin ka pa naman.",
  "Kalma ka lang, admin.",
  "Ayusin mo pananalita mo."
];

// 🤖 Auto chat messages (admin only)
const autoChatMessages = [
  "Admin, tahimik dito ah.",
  "Boss buhay pa ba?",
  "Admin chat ka naman.",
  "Gising admin."
];

// ⏱ Auto inactivity check (ADMIN THREADS ONLY)
function checkInactivity(api) {
  const now = Date.now();
  activeSimThreads.forEach(threadID => {
    const last = lastMessageTime.get(threadID) || 0;
    if (now - last > 120000) {
      const msg = autoChatMessages[Math.floor(Math.random() * autoChatMessages.length)];
      api.sendMessage(msg, threadID);
      lastMessageTime.set(threadID, now);
    }
  });
}

setInterval(() => {
  // handled internally by handleEvent
}, 30000);

module.exports.config = {
  name: "skye",
  version: "3.1.0",
  permission: 1,
  credits: "Nax + ChatGPT",
  prefix: false,
  description: "Admin-only SimSimi auto reply",
  category: "without prefix",
  usages: "sim on | sim off",
  cooldowns: 3
};

module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, body, senderID } = event;

  // ❌ Ignore if bot
  if (!body || senderID === api.getCurrentUserID()) return;

  // 🔐 ONLY ADMIN
  if (!isAdmin(senderID)) return;

  // ❌ If sim not active
  if (!activeSimThreads.has(threadID)) return;

  lastMessageTime.set(threadID, Date.now());

  const lower = body.toLowerCase();

  // 🔥 Curse detect
  if (curseWords.some(w => lower.includes(w))) {
    const reply = curseResponses[Math.floor(Math.random() * curseResponses.length)];
    return api.sendMessage(reply, threadID, event.messageID);
  }

  // 🤖 SimSimi
  try {
    const apiKey = "2a5a2264d2ee4f0b847cb8bd809ed34bc3309be7";
    const url = `https://simsimi.ooguy.com/sim?query=${encodeURIComponent(body)}&apikey=${apiKey}`;
    const { data } = await axios.get(url);
    if (!data || !data.respond) return;
    api.sendMessage(data.respond, threadID, event.messageID);
  } catch (e) {
    console.error(e.message);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // 🔐 ADMIN ONLY COMMAND
  if (!isAdmin(senderID)) {
    return api.sendMessage("❌ Admin only.", threadID, messageID);
  }

  const sub = (args[0] || "").toLowerCase();

  if (sub === "on") {
    if (activeSimThreads.has(threadID)) {
      return api.sendMessage("✅ Already ON.", threadID, messageID);
    }
    activeSimThreads.add(threadID);
    lastMessageTime.set(threadID, Date.now());
    saveActiveThreads(activeSimThreads);
    return api.sendMessage("✅ Sim ON (Admin only).", threadID, messageID);
  }

  if (sub === "off") {
    if (!activeSimThreads.has(threadID)) {
      return api.sendMessage("❌ Already OFF.", threadID, messageID);
    }
    activeSimThreads.delete(threadID);
    lastMessageTime.delete(threadID);
    saveActiveThreads(activeSimThreads);
    return api.sendMessage("❌ Sim OFF.", threadID, messageID);
  }

  return api.sendMessage(
    "📌 Usage:\nsim on\nsim off",
    threadID,
    messageID
  );
};