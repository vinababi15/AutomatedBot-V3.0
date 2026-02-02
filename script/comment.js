module.exports.config = {
  name: "comment",
  version: "2.1.0",
  hasPermssion: 1,
  credits: "Vern + ChatGPT",
  description: "Admin-only auto comment system with reaction. Supports full Facebook URLs or raw post IDs.",
  commandCategory: "admin",
  usages: "autocomment <mode> <postURL|postID> <args>",
  cooldowns: 3
};

// 🔐 MULTIPLE ADMIN UIDS
const ADMIN_UIDS = [
  "61577300994025",
  "61578929660413"
];

// 🔐 ADMIN CHECK
const isAdmin = (uid) => ADMIN_UIDS.includes(uid);

// ⏱️ SLEEP
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 💬 COMMENT LIST (ROTATION)
const COMMENT_LIST = [
  "dog kita aaa",
  "wag ka maiyak dog",
  "focus ka sakin buldog ko",
  "aso ka why",
  "im the strongest of all dummy dogs",
  "durog ka wala ka palag"
];

// ❤️ REACT TYPES
const REACTS = ["LIKE", "LOVE", "HAHA", "WOW", "ANGRY"];

// 🔗 Extract post ID from full Facebook URL
function normalizePostID(input) {
  if (!input) return input;
  // Match /posts/<id> or /pfbid<id>
  const postMatch = input.match(/(?:posts\/|pfbid)([a-zA-Z0-9]+)/);
  if (postMatch) return postMatch[0].includes("pfbid") ? postMatch[0] : postMatch[1];
  return input; // fallback: assume raw postID
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // 🔐 ADMIN ONLY
  if (!isAdmin(senderID)) {
    return api.sendMessage("❌ Admin only command.", threadID, messageID);
  }

  if (args.length < 2) {
    return api.sendMessage(
      "📌 USAGE:\n" +
      "autocomment one <postID|URL> <text>\n" +
      "autocomment spam <postID|URL> <count> <delay_ms> <text>\n" +
      "autocomment list <postID|URL> <count> <delay_ms>\n" +
      "autocomment react <postID|URL> <text>\n" +
      "autocomment tag <postID|URL> <uid> <text>",
      threadID,
      messageID
    );
  }

  const mode = args.shift().toLowerCase();
  const rawPostID = args.shift();
  const postID = normalizePostID(rawPostID);

  try {

    // 🟢 ONE COMMENT
    if (mode === "one") {
      const text = args.join(" ");
      await api.comment(text, postID);
      return api.sendMessage("✅ Comment sent.", threadID, messageID);
    }

    // 🔥 SPAM COMMENT
    if (mode === "spam") {
      const count = parseInt(args.shift());
      const delay = parseInt(args.shift());
      const text = args.join(" ");

      for (let i = 0; i < count; i++) {
        await api.comment(text, postID);
        await sleep(delay);
      }

      return api.sendMessage(`🔥 Spam done (${count} comments).`, threadID);
    }

    // 🔁 LIST ROTATION
    if (mode === "list") {
      const count = parseInt(args.shift());
      const delay = parseInt(args.shift());

      for (let i = 0; i < count; i++) {
        const msg = COMMENT_LIST[i % COMMENT_LIST.length];
        await api.comment(msg, postID);
        await sleep(delay);
      }

      return api.sendMessage("🔁 List comments sent.", threadID);
    }

    // ❤️ REACT + COMMENT
    if (mode === "react") {
      const text = args.join(" ");
      const react = REACTS[Math.floor(Math.random() * REACTS.length)];

      await api.setPostReaction(postID, react);
      await api.comment(text, postID);

      return api.sendMessage(
        `❤️ Reacted (${react}) and commented.`,
        threadID
      );
    }

    // 🏷️ TAG USER IN COMMENT
    if (mode === "tag") {
      const uid = args.shift();
      const text = args.join(" ");

      const tagText = `${text}`;
      const mentions = [{ id: uid, tag: "" }];

      await api.comment(tagText, postID, mentions);

      return api.sendMessage(
        `🏷️ Tagged user and commented.`,
        threadID
      );
    }

    return api.sendMessage("❌ Unknown mode.", threadID);

  } catch (err) {
    console.error(err);
    return api.sendMessage(
      "❌ Failed. Check post ID / URL / permissions.",
      threadID
    );
  }
};