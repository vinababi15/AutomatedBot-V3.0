module.exports.config = {
    name: "grouplock",
    version: "1.4.0",
    description: "Auto react, auto nick, nick revert, bot nick, anti GC rename, anti like spam"
};

/* ================= SETTINGS ================= */

const MEMBER_NICK = "owned by skye";
const BOT_NICK = "skye was here";
const REACTIONS = ["❤️", "👍", "😆", "🔥", "😍", "😎"];

const LIKE_WARN = 3;
const LIKE_KICK = 5;
const LIKE_TIME = 6000;

/* ================= MEMORY ================= */

const groupNames = new Map();           // threadID => locked name
const expectedNick = new Map();         // threadID:userID => nickname
const likeCount = new Map();
const warned = new Set();

/* ================= HELPERS ================= */

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ================= EVENT ================= */

module.exports.handleEvent = async function ({ api, event }) {
    const threadID = event.threadID;
    const senderID = event.senderID;
    const botID = api.getCurrentUserID();

    /* ========= AUTO REACT (ALL MEMBERS, RANDOM) ========= */
    if (
        (event.type === "message" || event.type === "message_reply") &&
        senderID !== botID &&
        event.messageID
    ) {
        api.setMessageReaction(
            pick(REACTIONS),
            event.messageID,
            () => {},
            true
        );
    }

    /* ========= SAVE ORIGINAL GROUP NAME ========= */
    if (!groupNames.has(threadID) && event.type === "message") {
        const info = await api.getThreadInfo(threadID);
        groupNames.set(threadID, info.threadName);
    }

    /* ========= GROUP NAME LOCK + KICK ========= */
    if (event.logMessageType === "log:thread-name") {
        const changerID = event.author;
        const info = await api.getThreadInfo(threadID);
        const lockedName = groupNames.get(threadID);

        if (!lockedName) {
            groupNames.set(threadID, info.threadName);
            return;
        }

        if (info.threadName !== lockedName) {
            api.setTitle(lockedName, threadID);

            const botAdmin = info.adminIDs.some(a => a.id === botID);
            const userAdmin = info.adminIDs.some(a => a.id === changerID);

            if (botAdmin && !userAdmin) {
                api.removeUserFromGroup(changerID, threadID);
            }
        }
    }

    /* ========= AUTO NICK ON JOIN ========= */
    if (event.logMessageType === "log:subscribe") {
        const users = event.logMessageData.addedParticipants || [];

        for (const u of users) {
            const uid = u.userFbId;
            const key = `${threadID}:${uid}`;
            const nick = uid === botID ? BOT_NICK : MEMBER_NICK;

            expectedNick.set(key, nick);

            setTimeout(() => {
                api.changeNickname(nick, threadID, uid);
            }, 2000);
        }
    }

    /* ========= NICKNAME REVERT (ANTI CLEAR / CHANGE) ========= */
    if (event.logMessageType === "log:user-nickname") {
        const targetID = event.logMessageData.participant_id;
        if (!targetID) return;

        const key = `${threadID}:${targetID}`;
        const wantedNick =
            targetID === botID ? BOT_NICK : expectedNick.get(key);

        if (!wantedNick) return;

        // Ignore bot's own successful changes
        if (event.author === botID) return;

        setTimeout(() => {
            api.changeNickname(wantedNick, threadID, targetID);
        }, 1500);
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