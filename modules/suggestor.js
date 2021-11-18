const { MessageEmbed, MessageAttachment } = require("discord.js");

let core;
let config;
let usermap;

module.exports = {
    init: _init,
    sendRNGImages: sendRNGImages,
    sendNewImages: sendNewImages,
};

async function sendRNGImages(ID) {
    let localFeedArray = [];
    for (i = 0; i < core.sankaku.RNGFeed[ID].feedArray.length; i++) {
        localFeedArray.push(core.sankaku.RNGFeed[ID].feedArray[i]);
    }
    let user = usermap.find((u) => u.name === core.sankaku.RNGFeed[ID].username);

    if (localFeedArray.some((i) => i.error)) {
        let erroritem = localFeedArray.find((i) => i.error);
        log("Feed id: " + erroritem.feedId + " | " + erroritem.error, "Error");
        let index = core.sankaku.RNGFeed[ID].feedArray.indexOf(erroritem);
        core.sankaku.RNGFeed[ID].feedArray.splice(index, 1);
        StopRNGFeed(ID, false);
        if (user) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            user.discordUser.send("RNG feed error: " + erroritem.error);
        }
        return;
    }

    if (localFeedArray.length > 0) {
        // iterate through newImages 10 at a time and send bulkembed
        let images = [];
        for (let i = 0; i < localFeedArray.length; i++) {
            if (!localFeedArray[i].error) {
                images.push(localFeedArray[i]);
                if (images.length == 10) {
                    log("Sending images: " + images.map((i) => i.id).join(", ") + " to " + user.name, "Info");
                    sendFeedEmbeds(images, user);
                    images = [];
                }
            }
        }
        if (images.length > 0) {
            log("Sending images: " + images.map((i) => i.id).join(", ") + " to " + user.name, "Info");
            sendFeedEmbeds(images, user);
        }
        for (let i = 0; i < localFeedArray.length; i++) {
            let index = core.sankaku.RNGFeed[ID].feedArray.indexOf(localFeedArray[i]);
            core.sankaku.RNGFeed[ID].feedArray.splice(index, 1);
        }
    }
}

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

async function StopRNGFeed(ID, immediately) {
    core.sankaku.RNGFeed[ID].active[0] = false;
    if (!immediately) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }
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

function IsActiveHours() {
    let hour = new Date().getHours();
    return hour >= config.activeHours.start && hour <= config.activeHours.end;
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

function initEventHandler() {
    core.dcbot.client.on("messageCreate", async (message) => {
        if (message.author.bot) return;

        if (message.guild === null) {
            let command = message.content.substring(1);
            // Suggestor Part
            if (command.startsWith("rngfeed start")) {
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
                StopRNGFeed(ID, true);
                log("Stopping RNG feed for " + core.sankaku.RNGFeed[ID].username + " with feedId: " + ID, "Info");
                message.channel.send("RNG feed stopped");
            }
        }
    });
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!config.activeHours) {
        log("No active hours specified in config.json", "Error");
        return;
    }
    usermap = core.dcbot.usermap;
    initEventHandler();
}

function log(message, serenity) {
    modulename = "suggestor.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
