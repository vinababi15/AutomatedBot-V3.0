module.exports.config = {
 name: "out",
 version: "1.0.0",
 role: 1,
 credits: "Vern",
 description: "Leave the group",
 aliases: ["leave"],
cooldown: 0,
hasPrefix: false,
  usage: "",
};

module.exports.run = async function({ api, event, args }) {
     if (!args[0]) return api.removeUserFromGroup(api.getCurrentUserID(), event.threadID);
     if (!isNaN(args[0])) return api.removeUserFromGroup(api.getCurrentUserID(), args.join(" "));
}