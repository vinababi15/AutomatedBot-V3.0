module.exports.config = {
    name: "nickall",
    version: "1.1.0",
    hasPermssion: 1,
    credits: "Vern",
    description: "Set nickname for all users in the group (multi-admin)",
    commandCategory: "group",
    usages: "[nickname]",
    cooldowns: 5
};

// ADMIN UIDs HERE
const ADMIN_UIDS = [
    "61577300994025",
    "61578929660413",
    "61561982970881",
    "100006386820939"
];

module.exports.run = async function ({ api, event, args }) {
    try {
        // Admin check
        if (!ADMIN_UIDS.includes(event.senderID)) {
            return api.sendMessage(
                "❌ You are not allowed to use this command.",
                event.threadID,
                event.messageID
            );
        }

        // 📝 Nickname input
        const nickname = args.join(" ");
        if (!nickname) {
            return api.sendMessage(
                "⚠️ Please provide a nickname.\nExample: nickall Sky",
                event.threadID,
                event.messageID
            );
        }

        // 👥 Get all members
        const threadInfo = await api.getThreadInfo(event.threadID);
        const members = threadInfo.participantIDs;

        // ✏️ Change nickname for all
        for (const uid of members) {
            await api.changeNickname(
                nickname,
                event.threadID,
                uid
            );
        }

        api.sendMessage(
            `✅ Nickname set for ${members.length} members.\nNickname: ${nickname}`,
            event.threadID
        );

    } catch (error) {
        console.error(error);
        api.sendMessage(
            "❌ Failed to set nicknames.",
            event.threadID
        );
    }
};