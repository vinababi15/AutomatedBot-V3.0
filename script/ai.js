const axios = require("axios");

module.exports.config = {
  name: "ai",
  version: "1.2.0",
  hasPermssion: 0, // everyone
  credits: "Vern",
  description: "Chat with AI and describe photos fully customizable by user",
  commandCategory: "fun",
  usages: "ai <prompt> or send a photo",
  cooldowns: 3
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, attachments, body, senderName } = event;

  let prompt = args.join(" ");

  // Check for image attachments
  if (attachments && attachments.length > 0) {
    const imageAttachment = attachments.find(a => a.type === "photo");
    if (imageAttachment) {
      const imageUrl = imageAttachment.url;
      prompt = `Describe this photo in detail like a human: ${imageUrl}`;
    }
  }

  if (!prompt) {
    return api.sendMessage(
      "📌 Usage:\n- ai <text prompt>\n- send a photo to get it described by AI.",
      threadID,
      messageID
    );
  }

  try {
    // Gemini API expects JSON POST
    const response = await axios.post("https://wudysoft.xyz/api/ai/gemini/v7", {
      prompt: prompt,
      // optional: you can add more parameters if supported like temperature, max_tokens, etc.
    });

    if (response.data && response.data.output) {
      return api.sendMessage(
        `🤖 AI response for ${senderName}:\n${response.data.output}`,
        threadID,
        messageID
      );
    } else {
      return api.sendMessage(
        "❌ AI did not return a valid response. Try again with another prompt.",
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