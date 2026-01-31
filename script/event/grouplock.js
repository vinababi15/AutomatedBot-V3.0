// In-memory storage
const groupLocks = new Map();
const actionQueues = new Map();
const likeSpam = new Map();

const BOT_NICKNAME = "skye was here";
const ACTION_DELAY = 1500;

// Like-spam settings
const LIKE_LIMIT = 5;
const LIKE_INTERVAL = 4000;
const AUTO_REACTION = "👍";

/* Queue handler */
async function enqueue(threadID, action) {
  if (!actionQueues.has(threadID)) {
    actionQueues.set(threadID, Promise.resolve());
  }

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

module.exports.config = {
  name: "grouplock",
  version: "1.7.0"
};

module.exports.handleEvent = async function ({ api, event }) {
  const threadID = event.threadID;
  const senderID = event.senderID;

  /* 👍 AUTO REACT TO ALL MESSAGES */
  if (event.type === "message" || event.type === "message_reply") {
    enqueue(threadID, () =>
      api.setMessageReaction(
        AUTO_REACTION,
        event.messageID,
        () => {},
        true
      )
    );
  }

  /* 🚫 LIKE MESSAGE SPAM DETECTION */
  if (event.type === "message" && event.body) {
    const text = event.body.trim().toLowerCase();

    if (text === "like" || text === "👍") {
      const now = Date.now();
      const key = `${threadID}:${senderID}`;

      if (!likeSpam.has(key)) likeSpam.set(key, []);

      const timestamps = likeSpam
        .get(key)
        .filter(t => now - t < LIKE_INTERVAL);

      timestamps.push(now);
      likeSpam.set(key, timestamps);

      if (timestamps.length >= LIKE_LIMIT) {
        const botID = api.getCurrentUserID();
        const info = await api.getThreadInfo(threadID);

        if (info.adminIDs.some(a => a.id === botID)) {
          enqueue(threadID, () =>
            api.removeUserFromGroup(senderID, threadID)
          );
        }

        likeSpam.delete(key);
      }
    }
  }

  /* 🤖 BOT AUTO NICKNAME */
  if (event.logMessageType === "log:subscribe") {
    const botID = api.getCurrentUserID();
    for (const user of event.logMessageData.addedParticipants) {
      if (user.userFbId === botID) {
        enqueue(threadID, () =>
          api.changeNickname(BOT_NICKNAME, threadID, botID)
        );
      }
    }
  }

  const lock = groupLocks.get(threadID);
  if (!lock) return;

  /* 🔒 GROUP NAME LOCK */
  if (event.logMessageType === "log:thread-name" && lock.groupName) {
    const info = await api.getThreadInfo(threadID);
    if (info.threadName !== lock.groupName) {
      enqueue(threadID, () =>
        api.setTitle(lock.groupName, threadID)
      );
    }
  }

  /* 🔒 NICKNAME LOCK */
  if (event.logMessageType === "log:user-nickname" && lock.nickname) {
    enqueue(threadID, () =>
      api.changeNickname(
        lock.nickname,
        threadID,
        event.logMessageData.participant_id
      )
    );
  }

  /* 🆕 AUTO NICK FOR NEW MEMBERS */
  if (event.logMessageType === "log:subscribe" && lock.nickname) {
    for (const user of event.logMessageData.addedParticipants) {
      enqueue(threadID, () =>
        api.changeNickname(lock.nickname, threadID, user.userFbId)
      );
    }
  }
};

module.exports.run = async function ({ api, event, args }) {
  const threadID = event.threadID;
  const cmd = args.shift()?.toLowerCase();

  if (cmd === "name") {
    const name = args.join(" ");
    if (!name) return api.sendMessage("❌ Missing group name.", threadID);

    groupLocks.set(threadID, {
      ...(groupLocks.get(threadID) || {}),
      groupName: name
    });

    enqueue(threadID, () => api.setTitle(name, threadID));
    return api.sendMessage(`🔒 Group name locked:\n${name}`, threadID);
  }

  if (cmd === "nick") {
    const nickname = args.join(" ");
    if (!nickname) return api.sendMessage("❌ Missing nickname.", threadID);

    groupLocks.set(threadID, {
      ...(groupLocks.get(threadID) || {}),
      nickname
    });

    const info = await api.getThreadInfo(threadID);
    for (const uid of info.participantIDs) {
      enqueue(threadID, () =>
        api.changeNickname(nickname, threadID, uid)
      );
    }

    return api.sendMessage(`🔒 Nickname locked:\n${nickname}`, threadID);
  }

  if (cmd === "off") {
    groupLocks.delete(threadID);
    return api.sendMessage("🔓 Group lock disabled.", threadID);
  }

  api.sendMessage(
`Usage:
grouplock name <group name>
grouplock nick <nickname>
grouplock off`,
    threadID
  );
};