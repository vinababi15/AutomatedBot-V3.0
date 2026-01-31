const { setTimeout } = require("timers/promises");

/* ================= CONFIG ================= */

module.exports.config = {
    name: "grouplock",
    version: "1.1.0",
    description: "Group lock, auto nickname, anti GC rename, auto react, anti-like spam"
};

/* ================= SETTINGS ================= */

const LOCKED_NICKNAME = "owned by skye";
const BOT_NICKNAME = "skye was here";
const AUTO_REACTION = "👍";

/* Anti spam */
const LIKE_LIMIT = 5;
const WARN_LIMIT = 3;
const LIKE_WINDOW = 5000;

/* ================= MEMORY (NO DB) ================= */

const lastGroupName = new Map();   // threadID => name
const likeLogs = new Map();
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
    const botID = api.getCurrentUserID();

    /* ================= AUTO REACT (ALL MESSAGES + SELF) ================= */
    if (
        event.type === "message" ||
        event.type === "message_reply" ||
        event.type === "message_unsend"
    ) {
        if (event.messageID) {
            enqueue(threadID, () =>
                api.setMessageReaction(
                    AUTO_REACTION,
                    event.messageID,
                    () => {},
                    true // self listen
                )
            );
        }
    }

    /* ================= LIKE MESSAGE ANTI SPAM ================= */
    if (event.type === "message" && event.body) {
        const msg = event.body.trim().toLowerCase();
        if (msg === "like" || msg === "👍") {
            const key = `${threadID}:${senderID}`;
            const now = Date.now();

            if (!likeLogs.has(key)) likeLogs.set(key, []);
            const arr = likeLogs.get(key).filter(t => now - t < LIKE_WINDOW);
            arr.push(now);
            likeLogs.set(key, arr);

            if (arr.length === WARN_LIMIT && !warned.has(key)) {
                warned.add(key);
                enqueue(threadID, () =>
                    api.sendMessage(
                        `⚠ <@${senderID}> stop spamming like messages.`,
                        threadID,
                        { mentions: [{ id: senderID, tag: `<@${senderID}>` }] }
                    )
                );
            }

            if (arr.length >= LIKE_LIMIT) {
                const info = await api.getThreadInfo(threadID);
                const botAdmin = info.adminIDs.some(a => a.id === botID);
                const userAdmin = info.adminIDs.some(a => a.id === senderID);

                if (botAdmin && !userAdmin) {
                    enqueue(threadID, () =>
                        api.removeUserFromGroup(senderID, threadID)
                    );
                }

                likeLogs.delete(key);
                warned.delete(key);
            }
        }
    }

    /* ================= BOT AUTO NICK ================= */
    if (event.logMessageType === "log:subscribe") {
        for (const u of event.logMessageData.addedParticipants || []) {
            if (u.userFbId === botID) {
                enqueue(threadID, () =>
                    api.changeNickname(BOT_NICKNAME, threadID, botID)
                );
            }
        }
    }

    /* ================= AUTO NICK NEW MEMBERS ================= */
    if (event.logMessageType === "log:subscribe") {
        for (const u of event.logMessageData.addedParticipants || []) {
            if (u.userFbId !== botID) {
                enqueue(threadID, () =>
                    api.changeNickname(LOCKED_NICKNAME, threadID, u.userFbId)
                );
            }
        }
    }

    /* ================= NICKNAME LOCK ================= */
    if (event.logMessageType === "log:user-nickname") {
        const targetID = event.logMessageData.participant_id;
        if (targetID !== botID) {
            enqueue(threadID, () =>
                api.changeNickname(LOCKED_NICKNAME, threadID, targetID)
            );
        }
    }

    /* ================= GROUP NAME LOCK + KICK ================= */
    if (event.logMessageType === "log:thread-name") {
        const changerID = event.author;
        const info = await api.getThreadInfo(threadID);

        // Save original name once
        if (!lastGroupName.has(threadID)) {
            lastGroupName.set(threadID, info.threadName);
            return;
        }

        const lockedName = lastGroupName.get(threadID);
        const isAdmin = info.adminIDs.some(a => a.id === changerID);
        const botAdmin = info.adminIDs.some(a => a.id === botID);

        // Revert name
        if (info.threadName !== lockedName) {
            enqueue(threadID, () =>
                api.setTitle(lockedName, threadID)
            );

            // Kick changer if not admin
            if (botAdmin && !isAdmin) {
                enqueue(threadID, () =>
                    api.removeUserFromGroup(changerID, threadID)
                );
            }
        }
    }
};