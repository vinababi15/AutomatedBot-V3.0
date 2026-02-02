const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "spotify",
  version: "1.2.0",
  hasPermssion: 0,
  credits: "Vern",
  description: "Search Spotify songs and send playable audio",
  commandCategory: "music",
  usages: "[song name]",
  cooldowns: 3
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  if (!args.length) {
    return api.sendMessage("📌 Usage: spotify <song name>", threadID, messageID);
  }

  const query = args.join(" ");

  // 🔎 LOADING MESSAGE
  const loadingMsg = await api.sendMessage(
    "🔎 Searching song...\nPlease wait 🎧",
    threadID
  );

  try {
    const apiUrl = `https://api-library-kohi.onrender.com/api/spotify?song=${encodeURIComponent(query)}`;
    const res = await axios.get(apiUrl);
    const data = res.data;

    if (!data.status || !data.data || !data.data.audioUrl) {
      return api.sendMessage(
        `❌ No results found for "${query}".`,
        threadID,
        loadingMsg.messageID
      );
    }

    const song = data.data;

    // 📸 SEND COVER IMAGE FIRST
    await api.sendMessage(
      {
        body:
          `🎵 ${song.title}\n` +
          `👤 ${song.artist}\n` +
          `⏱ ${Math.floor(song.duration / 60)}:${(song.duration % 60)
            .toString()
            .padStart(2, "0")}`,
        attachment: await axios
          .get(song.thumbnail, { responseType: "stream" })
          .then(r => r.data)
      },
      threadID
    );

    // 🎧 DOWNLOAD AUDIO
    const audioPath = path.join(__dirname, `${Date.now()}_spotify.mp3`);
    const audioRes = await axios.get(song.audioUrl, {
      responseType: "arraybuffer"
    });

    fs.writeFileSync(audioPath, audioRes.data);

    // 🎧 SEND PLAYABLE AUDIO
    await api.sendMessage(
      {
        body: "▶️ Now Playing:",
        attachment: fs.createReadStream(audioPath)
      },
      threadID
    );

    fs.unlinkSync(audioPath);

    // 🧹 REMOVE LOADING MESSAGE
    api.unsendMessage(loadingMsg.messageID);

  } catch (err) {
    console.error("SPOTIFY ERROR:", err.message);
    return api.sendMessage(
      "❌ Failed to fetch or send audio.",
      threadID,
      loadingMsg.messageID
    );
  }
};