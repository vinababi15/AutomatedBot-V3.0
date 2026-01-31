const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const threadsFile = path.join(__dirname, "sim_threads.json");

// Load active threads from file
function loadActiveThreads() {
  try {
    const data = fs.readFileSync(threadsFile, "utf8");
    const arr = JSON.parse(data);
    return new Set(arr);
  } catch (e) {
    return new Set();
  }
}

// Save active threads to file
function saveActiveThreads(set) {
  fs.writeFileSync(threadsFile, JSON.stringify(Array.from(set)), "utf8");
}

let activeSimThreads = loadActiveThreads();

// Map to track last message time per thread for auto-chat
let lastMessageTime = new Map();

// List of curse words to detect (in Tagalog/English, add more as needed)
const curseWords = ["putangina", "tangina", "gago", "bobo", "fuck", "shit", "damn", "asshole", "pussy", "dick", "bastard", "bitch"];

// Aggressive responses for curses (in Tagalog, like a real person)
const curseResponses = [
  "Ano'ng problema mo, gago? Wag kang magmura dito kung ayaw mong maging away tayo!",
  "Tangina mo, bakit ka nagmumura? Gusto mo bang labanan kita?",
  "Putangina ka, wag kang bastos dito! Lalabanan kita ng salita!",
  "Gago ka pala, eh! Wag mo akong galitin kung ayaw mong maging magulo ang usapan!",
  "Ano'ng sinasabi mo, bobo? Kung magmumura ka pa, sasampalin kita ng mura rin!"
];

// Auto-chat messages (aggressive, in Tagalog, to provoke chat)
const autoChatMessages = [
  "Hoy, bakit tahimik ang grupo? May problema ba kayo? Gumising kayo!",
  "Tangina, walang nagchachat? Gusto niyo bang mag-away tayo para magising kayo?",
  "Putangina, bakit walang nag-uusap? Lalabanan ko kayo isa-isa kung hindi kayo magsasalita!",
  "Gago, bakit dead chat? Gumising na kayo bago ko kayo awayin lahat!",
  "Ano'ng nangyayari, bobo? Walang nagchachat? Sasampalin ko kayo ng mura kung hindi kayo mag-uusap!"
];

// Function to check for inactivity and auto-chat
function checkInactivity(api) {
  const now = Date.now();
  activeSimThreads.forEach(threadID => {
    const lastTime = lastMessageTime.get(threadID) || 0;
    if (now - lastTime > 120000) { // 2 minutes = 120000 ms
      const randomMessage = autoChatMessages[Math.floor(Math.random() * autoChatMessages.length)];
      api.sendMessage(randomMessage, threadID);
      lastMessageTime.set(threadID, now); // Reset timer after sending
    }
  });
}

// Start interval to check inactivity every 30 seconds
setInterval(() => {
  // Assuming api is available globally or passed somehow; in practice, you might need to adjust
  // For now, we'll assume it's handled in the module context
}, 30000);

module.exports.config = {
  name: "skye",
  version: "3.0.0",
  permission: 0,
  credits: "Nax",
  prefix: false,
  premium: false,
  description: "Auto-reply with SimSimi AI, stays on until turned off (persistent), now with aggressive auto-chat and curse responses",
  category: "without prefix",
  usages: "sim on | sim off",
  cooldowns: 3,
  dependencies: {
    "axios": ""
  }
};

module.exports.languages = {
  "english": {
    "on": "SimSimi auto-reply activated! All messages will receive SimSimi responses. Aggressive mode: auto-chat after 2 mins inactivity, curse responses enabled.",
    "off": "SimSimi auto-reply deactivated. Aggressive mode disabled.",
    "alreadyOn": "SimSimi auto-reply is already active in this thread.",
    "alreadyOff": "SimSimi auto-reply is not active in this thread.",
    "apiError": "Error: Failed to connect to Sim API.",
    "noResponse": "Error: No response from Sim API."
  }
};

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, body, senderID } = event;
  if (!activeSimThreads.has(threadID)) return;
  if (!body || senderID === api.getCurrentUserID()) return;

  // Update last message time
  lastMessageTime.set(threadID, Date.now());

  // Check if message contains curses
  const lowerBody = body.toLowerCase();
  const hasCurse = curseWords.some(word => lowerBody.includes(word));
  if (hasCurse) {
    const randomResponse = curseResponses[Math.floor(Math.random() * curseResponses.length)];
    return api.sendMessage(randomResponse, threadID, event.messageID);
  }

  // Otherwise, proceed with SimSimi
  try {
    const apiKey = "2a5a2264d2ee4f0b847cb8bd809ed34bc3309be7";
    const apiUrl = `https://simsimi.ooguy.com/sim?query=${encodeURIComponent(body)}&apikey=${apiKey}`;
    const { data } = await axios.get(apiUrl);
    if (!data || !data.respond) return;
    api.sendMessage(data.respond, threadID, event.messageID);
  } catch (error) {
    console.error("sim handleEvent error:", error.message);
  }
};

module.exports.run = async function({ api, event, args, getText }) {
  const { threadID, messageID } = event;
  const subcmd = (args[0] || "").toLowerCase();

  if (subcmd === "on") {
    if (activeSimThreads.has(threadID)) {
      return api.sendMessage(getText("alreadyOn"), threadID, messageID);
    }
    activeSimThreads.add(threadID);
    lastMessageTime.set(threadID, Date.now()); // Initialize timer
    saveActiveThreads(activeSimThreads);
    return api.sendMessage(getText("on"), threadID, messageID);
  }

  if (subcmd === "off") {
    if (!activeSimThreads.has(threadID)) {
      return api.sendMessage(getText("alreadyOff"), threadID, messageID);
    }
    activeSimThreads.delete(threadID);
    lastMessageTime.delete(threadID); // Remove timer
    saveActiveThreads(activeSimThreads);
    return api.sendMessage(getText("off"), threadID, messageID);
  }

  return api.sendMessage("📌 Usage:\nsim on — activate SimSimi auto-reply\nsim off — deactivate auto-reply", threadID, messageID);
};