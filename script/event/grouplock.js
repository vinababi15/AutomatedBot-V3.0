const { setTimeout } = require("timers/promises");

/* ================= CONFIG ================= */

module.exports.config = {
    name: "grouplock",
    version: "1.0.0",
    description: "Group name lock, nickname lock, auto nick, auto react, anti-like spam"
};

/* ================= SETTINGS ================= */

const LOCKED_GROUP_NAME = "Skye owns this";
const LOCKED_NICKNAME = "owned by skye";
const BOT_NICKNAME = "skye was here";

const AUTO_REACTION = "👍";

/* Anti-spam */
const LIKE_LIMIT = 5;          // kick
const WARNING_LIMIT = 3;       // warn
const LIKE_WINDOW = 5000;      // ms

/* ================= MEMORY (NO DB) ================= */

const likeTracker = new Map();
const warned = new Set();
const queue = new Map();

/* ================= HELPERS ================= */

async function enqueue(threadID, fn) {
    if (!queue.has(threadID)) queue.set(threadID, Promise.resolve());

    queue.set(
        threadID,
        queue.get(threadID).then(() =>
            new Promise(async (res) => {
                try { await fn(); } catch {}
                setTimeout(res, 1200);
            })
        )
    );
}

/* ================= EVENT HANDLER ================= */

module.exports.handleEvent = async function ({ api, event }) {
    const threadID = event.threadID;
    const senderID = event.senderID;

    /* ---------- AUTO REACT ---------- */
    if (event.type === "message" || event.type === "message_reply") {
        enqueue(threadID, () =>
            api.setMessageReaction(AUTO_REACTION, event.messageID, () => {}, true)
        );
    }

    /* ---------- LIKE MESSAGE ANTI-SPAM ---------- */
    if (event.type === "message" && event.body) {
        const msg = event.body.trim().toLowerCase();
        if (msg === "like" || msg === "👍") {
            const key = `${threadID}:${senderID}`;
            const now = Date.now();

            if (!likeTracker.has(key)) likeTracker.set(key, []);
            const logs = likeTracker.get(key).filter(t => now - t < LIKE_WINDOW);
            logs.push(now);
            likeTracker.set(key, logs);

            /* Warn */
            if (logs.length === WARNING_LIMIT && !warned.has(key)) {
                warned.add(key);
                enqueue(threadID, () =>
                    api.sendMessage(
                        `⚠ <@${senderID}> stop spamming "like" messages!`,
                        threadID,
                        { mentions: [{ id: senderID, tag: `<@${senderID}>` }] }
                    )
                );
            }

            /* Kick */
            if (logs.length >= LIKE_LIMIT) {
                const botID = api.getCurrentUserID();
                const info = await api.getThreadInfo(threadID);

                const isAdmin = info.adminIDs.some(a => a.id === botID);
                const targetIsAdmin = info.adminIDs.some(a => a.id === senderID);

                if (isAdmin && !targetIsAdmin) {
                    enqueue(threadID, () =>
                        api.removeUserFromGroup(senderID, threadID)
                    );
                }

                likeTracker.delete(key);
                warned.delete(key);
            }
        }
    }

    /* ---------- BOT AUTO NICK ---------- */
    if (event.logMessageType === "log:subscribe") {
        const botID = api.getCurrentUserID();
        for (const u of event.logMessageData.addedParticipants) {
            if (u.userFbId === botID) {
                enqueue(threadID, () =>
                    api.changeNickname(BOT_NICKNAME, threadID, botID)
                );
            }
        }
    }

    /* ---------- AUTO NICK NEW MEMBERS ---------- */
    if (event.logMessageType === "log:subscribe") {
        for (const u of event.logMessageData.addedParticipants) {
            enqueue(threadID, () =>
                api.changeNickname(LOCKED_NICKNAME, threadID, u.userFbId)
            );
        }
    }

    /* ---------- NICKNAME LOCK ---------- */
    if (event.logMessageType === "log:user-nickname") {
        enqueue(threadID, () =>
            api.changeNickname(
                LOCKED_NICKNAME,
                threadID,
                event.logMessageData.participant_id
            )
        );
    }

    /* ---------- GROUP NAME LOCK ---------- */
    if (event.logMessageType === "log:thread-name") {
        const info = await api.getThreadInfo(threadID);
        if (info.threadName !== LOCKED_GROUP_NAME) {
            enqueue(threadID, () =>
                api.setTitle(LOCKED_GROUP_NAME, threadID)
            );
        }
    }
};