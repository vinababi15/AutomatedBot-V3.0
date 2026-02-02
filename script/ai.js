const axios = require("axios");

module.exports.config = {
  name: "ai",
  version: "1.1.0",
  hasPermssion: 0, // 0 = everyone
  credits: "Vern",
  description: "Chat with AI (Gemini) and describe images",
  commandCategory: "fun",
  usages: "ai <text> or send a photo",
  cooldowns: 3
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, attachments, body } = event;

  let prompt = args.join(" "); // text prompt
  let imageUrl = null;

  // Check if there is an image attachment
  if (attachments && attachments.length > 0) {
    const imageAttachment = attachments.find(a => a.type === "photo");
    if (imageAttachment) {
      imageUrl = imageAttachment.url;
      prompt = `Describe this photo: ${imageUrl}`;
    }
  }

  if (!prompt) {
    return api.sendMessage(
      "📌 Usage:\n- ai <text prompt>\n- send a photo and I will describe it.",
      threadID,
      messageID
    );
  }

  try {
    const apiUrl = `https://wudysoft.xyz/api/ai/gemini/v7?prompt=${encodeURIComponent(prompt)}`;
    const response = await axios.get(apiUrl);

    if (response.data && response.data.output) {
      return api.sendMessage(
        `🤖 AI says:\n${response.data.output}`,
        threadID,
        messageID
      );
    } else {
      return api.sendMessage(
        "❌ AI did not return a response.",
        threadID,
        messageID
      );
    }
  } catch (err) {
    console.error("AI command error:", err.message);
    return api.sendMessage(
      `❌ Failed to get AI response.\nError: ${err.message}`,
      threadID,
      messageID
    );
  }
};