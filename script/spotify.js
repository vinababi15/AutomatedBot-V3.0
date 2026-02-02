const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "spotify",
  version: "1.1.0",
  hasPermssion: 0,
  credits: "Vern",
  description: "Search Spotify songs and send playable audio",
  commandCategory: "fun",
  usages: "[song name]",
  cooldowns: 3
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID } = event;

  if (!args[0]) {
    return api.sendMessage("📌 Please provide a song name.", threadID, messageID);
  }

  const query = args.join(" ");

  try {
    // 1️⃣ Call new Spotify API
    const url = `https://api-library-kohi.onrender.com/api/spotify?song=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);

    if (!data || !data.status || !data.data) {
      return api.sendMessage(`❌ No results found for "${query}".`, threadID, messageID);
    }

    const song = data.data;

    // 2️⃣ Download audio temporarily
    const audioPath = path.join(__dirname, `${song.title}-${Date.now()}.mp3`);
    const response = await axios.get(song.audioUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(audioPath, Buffer.from(response.data, "binary"));

    // 3️⃣ Send message with cover + audio
    const msg = {
      body: `🎵 Title: ${song.title}\n👤 Artist: ${song.artist}\n⏱ Duration: ${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2,"0")}\n🔗 Direct Audio Link: ${song.audioUrl}`,
      attachment: [
        fs.createReadStream(audioPath),
        axios.get(song.thumbnail, { responseType: "stream" }).then(res => res.data)
      ]
    };

    await api.sendMessage(msg, threadID, messageID);

    // 4️⃣ Clean up
    fs.unlinkSync(audioPath);

  } catch (err) {
    console.error(err);
    return api.sendMessage("❌ Something went wrong while fetching the song.", threadID, messageID);
  }
};