const { setTimeout } = require("timers/promises");

// In-memory storage
const groupLocks = new Map();
const actionQueues = new Map();
const likeSpam = new Map();
const warnedUsers = new Set();

const BOT_NICKNAME = "skye was here";
const AUTO_REACTION = "👍";
const ACTION_DELAY = 1500;

// Anti-spam settings
const LIKE_LIMIT = 5;        // messages to trigger kick
const WARNING_THRESHOLD = 3; // messages to warn
const LIKE_INTERVAL = 4000;  // ms window

module.exports.config = {
  name: "grouplock",
  version: "2.0.0",
  description: "Locks group name, nicknames, auto-reacts, warns and kicks like-message spammers, auto-nicks bot"
};

/* Queue helper */
async function enqueue(threadID, action) {
  if (!actionQueues.has(threadID)) actionQueues.set(threadID, Promise.resolve());
  const queue = actionQueues.get(threadID);

  actionQueues.set(
    threadID,
    queue.then(() =>
      new Promise(async (resolve) => {
        try { await action(); } catch {}
        setTimeout(resolve, ACTION_DELAY);
      })
    )
  );
}

module.exports.handleEvent = async function ({ api, event }) {
  const threadID = event.threadID;
  const senderID = event.senderID;

  // --- AUTO REACT TO ALL MESSAGES ---
  if (event.type === "message" || event.type === "message_reply") {
    enqueue(threadID, () =>
      api.setMessageReaction(AUTO_REACTION, event.messageID, () => {}, true)
    );
  }

  // --- LIKE MESSAGE ANTI-SPAM ---
  if (event.type === "message" && event.body) {
    const text = event.body.trim().toLowerCase();
    if (text === "like" || text === "👍") {
      const key = `${threadID}:${senderID}`;
      const now = Date.now();

      if (!likeSpam.has(key)) likeSpam.set(key, []);
      const timestamps = likeSpam.get(key).filter(t => now - t < LIKE_INTERVAL);
      timestamps.push(now);
      likeSpam.set(key, timestamps);

      // --- WARNING ---
      if (timestamps.length >= WARNING_THRESHOLD && !warnedUsers.has(key)) {
        warnedUsers.add(key);
        enqueue(threadID, () =>
          api.sendMessage(
            `⚠ <@${senderID}>, stop spamming "like" messages or you will be removed!`,
            threadID,
            { mentions: [{ tag: `<@${senderID}>`, id: senderID }] }
          )
        );
      }

      // --- KICK ---
      if (timestamps.length >= LIKE_LIMIT) {
        const botID = api.getCurrentUserID();
        const info = await api.getThreadInfo(threadID);
        const whitelist = info.adminIDs.map(a => a.id);
        if (!whitelist.includes(senderID) && info.adminIDs.some(a => a.id === botID)) {
          enqueue(threadID, () => api.removeUserFromGroup(senderID, threadID));
        }
        likeSpam.delete(key);
        warnedUsers.delete(key);
      }
    }
  }

  // --- BOT AUTO NICKNAME ON JOIN ---
  if (event.logMessageType === "log:subscribe") {
    const botID = api.getCurrentUserID();
    for (const user of event.logMessageData.addedParticipants) {
      if (user.userFbId === botID) {
        enqueue(threadID, () => api.changeNickname(BOT_NICKNAME, threadID, botID));
      }
    }
  }

  // --- GROUP LOCK / NICKNAME LOCK ---
  const lock = groupLocks.get(threadID);
  if (!lock) return;

  // GROUP NAME AUTO-REVERT
  if (event.logMessageType === "log:thread-name" && lock.groupName) {
    const info = await api.getThreadInfo(threadID);
    if (info.threadName !== lock.groupName) {
      enqueue(threadID, () => api.setTitle(lock.groupName, threadID));
    }
  }

  // NICKNAME AUTO-REVERT
  if (event.logMessageType === "log:user-nickname" && lock.nickname) {
    enqueue(threadID, () =>
      api.changeNickname(lock.nickname, threadID, event.logMessageData.participant_id)
    );
  }

  // AUTO SET NICKNAME FOR NEW MEMBERS
  if (event.logMessageType === "log:subscribe" && lock.nickname) {
    for (const user of event.logMessageData.addedParticipants) {
      enqueue(threadID, () =>
        api.changeNickname(lock.nickname, threadID, user.userFbId)
      );
    }
  }
};