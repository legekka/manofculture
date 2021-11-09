const { Client, Intents, MessageEmbed, MessageAttachment } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MEMBERS], partials: ["CHANNEL"] });
const fs = require("fs");

let usermap;

let core;
let config;

module.exports = {
    init: _init,
    sendRNGImages: sendRNGImages,
    sendNewImages: sendNewImages,
};

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // Rater Part
    if (config.raterChannels.includes(message.channel.id)) {
        if (message.attachments.size > 0) {
            let url = message.attachments.first().url;
            let filename = message.attachments.first().name;
            core.rater.RateImage(url, filename).then((embed) => {
                if (!embed.error) message.channel.send({ embeds: [embed] });
            });
        } else if (message.content.includes("http")) {
            let url = message.content.split(" ").find((w) => w.includes("http"));
            let extension = url.split("/").pop().split(".").pop();
            let filename = message.id + "." + extension;
            core.rater.RateImage(url, filename).then((embed) => {
                if (!embed.error) message.channel.send({ embeds: [embed] });
            });
        }
    }

    // Tagger Part
    if (config.taggerChannels.includes(message.channel.id)) {
        if (message.attachments.size > 0) {
            let url = message.attachments.first().url;
            let filename = message.attachments.first().name;
            core.tagger.TagImage(url, filename).then((embed) => {
                if (!embed.error) message.channel.send({ embeds: [embed] });
                else message.channel.send("Error: " + embed.error);
            });
        } else if (message.content.includes("http")) {
            let url = message.content.split(" ").find((w) => w.includes("http"));
            let extension = url.split("/").pop().split(".").pop();
            let filename = message.id + "." + extension;
            core.tagger.TagImage(url, filename).then((embed) => {
                if (!embed.error) message.channel.send({ embeds: [embed] });
                else message.channel.send("Error: " + embed.error);
            });
        }
    }
    if (message.guild === null) {
        if (message.content.startsWith(config.prefix)) {
            let command = message.content.substring(config.prefix.length);
            // UserConfig Part
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
            }

            // Suggestor Part
            else if (command.startsWith("rngfeed start")) {
                let index = core.sankaku.RNGFeed.find((u) => u.username === message.author.username && u.active[0]);
                if (index) {
                    message.channel.send("You already have an active feed!");
                    return;
                }
                let options = createOptionsFromMessage(message);
                let ID = core.sankaku.CreateRNGFeed(options);
                options = core.sankaku.RNGFeed[ID].options;

                let text =
                    "Starting RNG feed for " +
                    options.username +
                    " with options:" +
                    (options.limit ? " limit: " + options.limit : " limit: 0.9") +
                    (options.searchtags ? " searchtags: [" + options.searchtags.join(", ") + "]" : "") +
                    (options.no_blacklist ? " no_blacklist" : "") +
                    " feedId: " +
                    options.feedId;
                log(text, "Info");
                message.channel.send(text);
            } else if (command.startsWith("rngfeed stop")) {
                // find feedId with user which is active
                let feed = core.sankaku.RNGFeed.find((r) => r.active[0] && r.username === message.author.username);
                if (!feed) {
                    message.channel.send("You don't have an active feed!");
                    return;
                }
                let ID = feed.options.feedId;
                StopRNGFeed(ID);
                log("Stopping RNG feed for " + core.sankaku.RNGFeed[ID].username + " with feedId: " + ID, "Info");
                message.channel.send("RNG feed stopped");
            } else if (command.startsWith("help")) {
                message.channel.send(
                    "**Feed Commands:**\n" +
                        "```\n" +
                        `${config.prefix}config - Shows current configuration\n` +
                        `${config.prefix}set [key] [value] - Sets a configuration value\n` +
                        `${config.prefix}rngfeed start [username] [limit] [searchtags] [no_blacklist] - Starts a new RNG feed\n` +
                        `${config.prefix}rngfeed stop - Stops the current RNG feed\n` +
                        "```"
                );
            } else {
                message.channel.send("Invalid command: " + command);
            }
        }
    }
});

client.on("ready", async () => {
    log("Ready!", "Info");
    await fetchUsers();
    core.sankaku.InitNewsFeed(usermap);
});

async function sendNewImages() {
    let newImages = [];
    for (let image of core.sankaku.NewsFeedArray) {
        newImages.push(image);
    }
    for (let image of newImages) {
        let user = usermap.find((u) => u.name === image.user);
        if (user) {
            if (!user.ignoreActiveHours) {
                if (!IsActiveHours()) {
                    continue;
                }
            }
            log(`Sending image ${image.id} to ${user.name}`, "Info");
            await sendFeedEmbeds([image], user, "New image!");
            let index = core.sankaku.NewsFeedArray.indexOf(image);
            core.sankaku.NewsFeedArray.splice(index, 1);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}

async function sendRNGImages(ID) {
    let localFeedArray = [];
    for (i = 0; i < core.sankaku.RNGFeed[ID].feedArray.length; i++) {
        localFeedArray.push(core.sankaku.RNGFeed[ID].feedArray[i]);
    }
    let user = usermap.find((u) => u.name === core.sankaku.RNGFeed[ID].username);

    if (localFeedArray.length > 0) {
        // iterate through newImages 10 at a time and send bulkembed
        let images = [];
        for (let i = 0; i < localFeedArray.length; i++) {
            if (!localFeedArray[i].error) {
                images.push(localFeedArray[i]);
                if (images.length == 10) {
                    log("Sending images: " + images.map((i) => i.id).join(", ") + " to " + user.name, "Info");
                    await sendFeedEmbeds(images, user);
                    images = [];
                }
            }
        }
        if (images.length > 0) {
            log("Sending images: " + images.map((i) => i.id).join(", ") + " to " + user.name, "Info");
            await sendFeedEmbeds(images, user);
        }
    }

    if (localFeedArray.some((i) => i.error)) {
        let erroritem = localFeedArray.find((i) => i.error);
        log("Feed id: " + erroritem.feedId + " | " + erroritem.error, "Error");
        StopRNGFeed(ID);
        if (user) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            user.discordUser.send("RNG feed error: " + erroritem.error);
        }
        return;
    }
    for (let i = 0; i < localFeedArray.length; i++) {
        let index = core.sankaku.RNGFeed[ID].feedArray.indexOf(localFeedArray[i]);
        core.sankaku.RNGFeed[ID].feedArray.splice(index, 1);
    }
}

async function StopRNGFeed(ID) {
    core.sankaku.RNGFeed[ID].active[0] = false;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    core.sankaku.RNGFeed[ID].feedArray = [];
    core.sankaku.RNGFeed[ID].ids = [];
    core.sankaku.RNGFeed[ID].username = "";
    log("Feed deleted: " + ID, "Info");
}

async function sendFeedEmbeds(images, user, title) {
    let embeds = [];
    let attachments = [];
    for (const image of images) {
        let embed = new MessageEmbed();
        let attachment = new MessageAttachment(image.file, image.filename);
        embed.setTitle(title || "Original link");
        embed.setDescription("Rating: **" + (image.rating * 10).toFixed(1) + "**");
        embed.setURL("https://beta.sankakucomplex.com/post/show/" + image.id);
        embed.setImage("attachment://" + image.filename);
        embeds.push(embed);
        attachments.push(attachment);
    }
    await user.discordUser.send({ embeds, files: attachments });
}

function createOptionsFromMessage(message) {
    let params = message.content.split(" ").splice(2);
    params = params.filter((p) => p !== "");
    let options = {};
    options.username = message.author.username;
    params.forEach((param) => {
        if (!isNaN(param) && options.limit === undefined) {
            if (0 <= param && param <= 10) {
                options.limit = param / 10;
            } else {
                log("Invalid limit: " + param);
                message.channel.send("Invalid limit: " + param + "\nLimit must be between 0 and 10");
                return;
            }
        } else if (param == "no_blacklist") {
            options.no_blacklist = true;
        } else {
            if (options.searchtags === undefined) {
                options.searchtags = [];
            }
            options.searchtags.push(param);
        }
    });
    return options;
}

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

function IsActiveHours() {
    let hour = new Date().getHours();
    return hour >= config.activeHours.start && hour <= config.activeHours.end;
}

function SaveUsermap() {
    fs.writeFileSync("./data/usermap.json", JSON.stringify(usermap, null, 4));
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!config.taggerChannels) {
        log("No tagger channels defined!", "Error");
        return;
    }
    if (!config.activeHours) {
        log("No active hours specified in config.json", "Error");
        return;
    }
    if (!config.token) {
        log("No token found in configuration file.", "Error");
        return;
    }
    if (!config.feedCheckerInterval) {
        log("No feedCheckerInterval found in configuration file.", "Error");
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
}

function log(message, serenity) {
    modulename = "dcbot.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
