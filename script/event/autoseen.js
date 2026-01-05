const fs = require("fs-extra");
const path = __dirname + "/cache/autoseen.txt";

module.exports.config = {
    name: "autoseen",
    version: "1.0.0",
    description: "Automatically marks messages as seen when enabled"
};

module.exports.handleEvent = async function ({ api, event }) {
    // Ensure cache folder & file exist
    if (!fs.existsSync(__dirname + "/cache")) {
        fs.mkdirSync(__dirname + "/cache", { recursive: true });
    }

    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, "false");
    }

    const isEnabled = fs.readFileSync(path, "utf-8").trim();

    // Auto seen for any incoming message
    if (isEnabled === "true" && event.type === "message") {
        api.markAsReadAll(() => {});
    }

    // Optional toggle via chat (no prefix)
    if (!event.body) return;

    const text = event.body.toLowerCase();

    if (text === "autoseen on") {
        fs.writeFileSync(path, "true");
        return api.sendMessage(
            "✅ Autoseen is now ENABLED.",
            event.threadID,
            event.messageID
        );
    }

    if (text === "autoseen off") {
        fs.writeFileSync(path, "false");
        return api.sendMessage(
            "❌ Autoseen is now DISABLED.",
            event.threadID,
            event.messageID
        );
    }
};