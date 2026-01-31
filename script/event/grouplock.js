module.exports.config = {
    name: "grouplock",
    version: "1.3.0",
    description: "Auto react, auto nick on join (once), bot nick, anti GC rename, anti like spam"
};

/* ================= SETTINGS ================= */

const MEMBER_NICK = "owned by skye";
const BOT_NICK = "skye was here";

const REACTIONS = ["❤️", "👍", "😆", "🔥", "😍", "😎"];

const LIKE_WARN = 3;
const LIKE_KICK = 5;
const LIKE_TIME = 6000;

/* ================= MEMORY ================= */

const groupNames = new Map();          // threadID => last name
const nickSet = new Set();             // threadID:userID
const likeCount = new Map();           // spam tracker
const warned = new Set();

/* ================= HELPERS ================= */

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ================= EVENT ================= */

module.exports.handleEvent = async function ({ api, event }) {
    const threadID = event.threadID;
    const senderID = event.senderID;
    const botID = api.getCurrentUserID();

    /* ========= AUTO REACT (RANDOM, ALL MEMBERS) ========= */
    if (
        event.type === "message" ||
        event.type === "message_reply"
    ) {
        if (event.messageID && senderID !== botID) {
            api.setMessageReaction(
                pick(REACTIONS),
                event.messageID,
                () => {},
                true // self listen
            );
        }
    }

    /* ========= STORE ORIGINAL GROUP NAME ========= */
    if (!groupNames.has(threadID) && event.type === "message") {
        const info = await api.getThreadInfo(threadID);
        groupNames.set(threadID, info.threadName);
    }

    /* ========= GROUP NAME LOCK + KICK ========= */
    if (event.logMessageType === "log:thread-name") {
        const changerID = event.author;
        const info = await api.getThreadInfo(threadID);
        const oldName = groupNames.get(threadID);

        if (!oldName) {
            groupNames.set(threadID, info.threadName);
            return;
        }

        if (info.threadName !== oldName) {
            api.setTitle(oldName, threadID);

            const botAdmin = info.adminIDs.some(a => a.id === botID);
            const userAdmin = info.adminIDs.some(a => a.id === changerID);

            if (botAdmin && !userAdmin) {
                api.removeUserFromGroup(changerID, threadID);
            }
        }
    }

    /* ========= AUTO NICKNAME (ONCE PER JOIN) ========= */
    if (event.logMessageType === "log:subscribe") {
        const users = event.logMessageData.addedParticipants || [];

        for (const u of users) {
            const uid = u.userFbId;
            const key = `${threadID}:${uid}`;

            if (nickSet.has(key)) continue;
            nickSet.add(key);

            setTimeout(() => {
                if (uid === botID) {
                    api.changeNickname(BOT_NICK, threadID, botID);
                } else {
                    api.changeNickname(MEMBER_NICK, threadID, uid);
                }
            }, 2000);
        }
    }

    /* ========= LIKE MESSAGE ANTI SPAM ========= */
    if (event.type === "message" && event.body) {
        const msg = event.body.trim().toLowerCase();
        if (msg !== "like" && msg !== "👍") return;

        const key = `${threadID}:${senderID}`;
        const now = Date.now();

        if (!likeCount.has(key)) {
            likeCount.set(key, { count: 1, time: now });
            return;
        }

        const data = likeCount.get(key);

        if (now - data.time > LIKE_TIME) {
            likeCount.set(key, { count: 1, time: now });
            warned.delete(key);
            return;
        }

        data.count++;
        data.time = now;

        if (data.count === LIKE_WARN && !warned.has(key)) {
            warned.add(key);
            api.sendMessage(
                `⚠ <@${senderID}> stop spamming like messages.`,
                threadID,
                { mentions: [{ id: senderID, tag: `<@${senderID}>` }] }
            );
        }

        if (data.count >= LIKE_KICK) {
            const info = await api.getThreadInfo(threadID);
            const botAdmin = info.adminIDs.some(a => a.id === botID);
            const userAdmin = info.adminIDs.some(a => a.id === senderID);

            if (botAdmin && !userAdmin) {
                api.removeUserFromGroup(senderID, threadID);
            }

            likeCount.delete(key);
            warned.delete(key);
        }
    }
};