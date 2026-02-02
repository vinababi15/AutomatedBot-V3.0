const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "spotify",
  version: "2.0.0",
  hasPermssion: 0, // everyone can use
  credits: "Vern",
  description: "Search any song on Spotify and get cover + playable audio preview",
  commandCategory: "fun",
  usages: "spotify <song name>",
  cooldowns: 3
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID } = event;
  const query = args.join(" ");
  if (!query) return api.sendMessage(
    "📌 Usage:\nspotify <song name>\nExample: spotify Hiling Mark Carpio",
    threadID,
    messageID
  );

  try {
    // API call to fetch Spotify info
    const url = `https://norch-project.gleeze.com/api/spotify?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);

    if (!data || !data.result || data.result.length === 0) {
      return api.sendMessage(`❌ No results found for "${query}".`, threadID, messageID);
    }

    const song = data.result[0];

    // Prepare message text
    const msgText = 
      `🎵 Spotify Search Result:\n\n` +
      `Title: ${song.title}\n` +
      `Artist: ${song.artist}\n` +
      `Album: ${song.album}\n` +
      `Preview URL: ${song.url || "N/A"}`;

    const attachments = [];

    // Download cover image if exists
    if (song.cover) {
      const coverData = await axios.get(song.cover, { responseType: "arraybuffer" });
      const coverPath = path.join(__dirname, `spotify_cover_${Date.now()}.jpg`);
      await fs.writeFile(coverPath, Buffer.from(coverData.data, "utf-8"));
      attachments.push(fs.createReadStream(coverPath));
    }

    // Download audio preview if exists
    if (song.url) {
      try {
        const audioData = await axios.get(song.url, { responseType: "arraybuffer" });
        const audioPath = path.join(__dirname, `spotify_preview_${Date.now()}.mp3`);
        await fs.writeFile(audioPath, Buffer.from(audioData.data, "utf-8"));
        attachments.push(fs.createReadStream(audioPath));
      } catch (e) {
        console.warn("Audio preview failed:", e.message);
      }
    }

    // Send message with cover + playable audio
    await api.sendMessage({ body: msgText, attachment: attachments }, threadID, messageID);

    // Cleanup downloaded files
    attachments.forEach(file => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });

  } catch (err) {
    console.error("Spotify command error:", err.message);
    return api.sendMessage(
      `❌ Failed to fetch song for "${query}".\nError: ${err.message}`,
      threadID,
      messageID
    );
  }
};