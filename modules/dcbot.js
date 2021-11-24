const { Client, Intents, MessageEmbed, MessageAttachment } = require("discord.js");
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS],
    partials: ["CHANNEL"],
});
const fs = require("fs");

let usermap;

let core;
let config;

let startTime;

module.exports = {
    init: _init,
};

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    // UserConfig Part
    if (message.guild === null) {
        if (message.content.startsWith(config.prefix)) {
            let command = message.content.substring(config.prefix.length);
            if (command.startsWith("config")) {
                let user = usermap.find((u) => u.name === message.author.username);
                if (user) {
                    let msg = "**Current user configuration:**\n```\n";
                    msg += "ignoreActiveHours: " + (user.ignoreActiveHours ? "True" : "False") + "\n";
                    msg += "newImageRatingLimit: " + (user.newImageRatingLimit * 10).toFixed(1) + "```\nTo change values, use `" + config.prefix + "set [key] [value]`";
                    message.channel.send(msg);
                }
            } else if (command.startsWith("set")) {
                let user = usermap.find((u) => u.name === message.author.username);
                if (user) {
                    let args = command.split(" ");
                    if (args[1] === "ignoreActiveHours") {
                        user.ignoreActiveHours = !user.ignoreActiveHours;
                        SaveUsermap();
                        message.channel.send("ignoreActiveHours set to " + (user.ignoreActiveHours ? "True" : "False"));
                    } else if (args[1] === "newImageRatingLimit") {
                        let value = parseFloat(args[2]) / 10;
                        if (value >= 0 && value <= 1) {
                            user.newImageRatingLimit = value;
                            SaveUsermap();
                            message.channel.send("newImageRatingLimit set to " + (user.newImageRatingLimit * 10).toFixed(1));
                        } else {
                            message.channel.send("Invalid value, must be between 0 and 10");
                        }
                    } else {
                        message.channel.send(`Invalid key, visit ${config.prefix}help or ${config.prefix}config`);
                    }
                }
            } else if (command.startsWith("uptime")) {
                let uptime = new Date() - startTime;
                let hours = Math.floor(uptime / 3600000);
                let minutes = Math.floor((uptime % 3600000) / 60000);
                let seconds = Math.floor((uptime % 60000) / 1000);
                message.channel.send(`Uptime: ${hours}h ${minutes}m ${seconds}s`);
            } else if (command.startsWith("help")) {
                message.channel.send(
                    "**Feed Commands:**\n" +
                        "```\n" +
                        `${config.prefix}config - Shows current configuration\n` +
                        `${config.prefix}set [key] [value] - Sets a configuration value\n` +
                        `${config.prefix}rngfeed start [username] [limit] [searchtags] [no_blacklist] - Starts a new RNG feed\n` +
                        `${config.prefix}rngfeed stop - Stops the current RNG feed\n` +
                        `${config.prefix}retrain - Retrains your Rating Model with your new rated images\n` +
                        `${config.prefix}status - Shows the retraining progress\n` +
                        `${config.prefix}uptime - Shows the uptime of the bot\n` +
                        `${config.prefix}help - Shows this help message\n` +
                        "```"
                );
            }
        }
    }
});

client.on("ready", async () => {
    log("Ready!", "Info");
    await fetchUsers();
    if (config.enableNewsFeed) {
        core.sankaku.InitNewsFeed(usermap);
    }
});

async function fetchUsers() {
    for (let username of usermap) {
        try {
            let user = await client.users.fetch(username.userid);
            if (user) {
                username.discordUser = user;
            }
        } catch (e) {
            log("User not found: " + username.name, "Error");
        }
    }
}

function SaveUsermap() {
    fs.writeFileSync("./data/usermap.json", JSON.stringify(usermap, null, 4));
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!config.token) {
        log("No token found in configuration file.", "Error");
        return;
    }
    if (!config.prefix) {
        log("No prefix found in configuration file.", "Error");
        return;
    }
    if (!fs.existsSync("./data/usermap.json")) {
        log("usermap.json not found in data folder.", "Error");
        return;
    } else {
        usermap = JSON.parse(fs.readFileSync("./data/usermap.json"));
        core.dcbot.usermap = usermap;
    }
    log("Starting...", "Info");
    client.login(config.token).catch((err) => {
        log(err, "Error");
    });
    core.dcbot.client = client;
    core.dcbot.prefix = config.prefix;
    startTime = new Date();
}

function log(message, serenity) {
    modulename = "dcbot.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
