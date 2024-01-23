const { MessageEmbed, MessageAttachment } = require("discord.js");
const sharp = require("sharp");
const fs = require("fs");

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
    for (let list of core.sankaku.NewsFeedArray) {
        let user = usermap.find((u) => u.name === list.user);
        if (user) {
            if (!user.ignoreActiveHours) {
                if (!IsActiveHours()) {
                    continue;
                }
            }
            if (list.images.length == 0) {
                continue;
            }
            // uploading images to man of culture db
            let images = [];
            let filenames = []
            for (let i = 0; i < list.images.length; i++) {
                images.push(list.images[i].file);
                log("Uploading image: " + list.images[i].filename + " to ai-backend", "Info")
                try {
                    let response = await core.aibackend.addImage(list.images[i].file, list.images[i].filename, list.images[i].id);
                }
                catch (e) {
                    log("Error while uploading image: " + list.images[i].filename + " to ai-backend", "Error")
                }

                filenames.push(list.images[i].filename);
            }

            // tagging new images in DB
            response = await core.aibackend.updateTags();
            log("Tagged " + response.updated_images_count + " images", "Info");

            // creating montage post
            let userid = user.userid;
            response = await core.aibackend.createMontagepost(filenames, userid);
            log("Created montage post with id: " + response.montagepost_id, "Info");

            // creating montage embed for discord
            let montage = await core.tools.createBox(images);
            log("Sending montage to " + user.name + " with " + images.length + " images", "Info");
            await sendMontage(montage, user, list);
            list.images = [];
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

async function sendMontage(montageimage, user, feedlist) {
    // saving image to jpg
    let filename = "montage_" + feedlist.user + ".jpg";
    await sharp(montageimage).toFile("cache/" + filename);

    let embed = new MessageEmbed();
    //let attachment = new MessageAttachment(fs.readFileSync("cache/" + filename), "montage.jpg");
    embed.setTitle("New images!");

    let desc = "";
    for (let i = 0; i < feedlist.images.length; i++) {
        desc += `${i + 1}.: https://sankaku.app/post/show/${feedlist.images[i].id} | **${(feedlist.images[i].rating * 10).toFixed(1)}**\n`;
    }
    embed.setDescription(desc);
    embed.setImage(await core.bfish.upload("cache/" + filename));
    try {
        await user.discordUser.send({ embeds: [embed] });
    }
    catch (e) {
        log("Error while sending montage to " + user.name , "Error");
    }
    fs.unlinkSync("cache/" + filename);
}

async function sendFeedEmbeds(images, user, title) {
    let embeds = [];
    let attachments = [];
    for (const image of images) {
        let embed = new MessageEmbed();
        let attachment = new MessageAttachment(image.file, image.filename);
        embed.setTitle(title || "Original link");
        embed.setDescription("Rating: **" + (image.rating * 10).toFixed(1) + "**");
        embed.setURL("https://sankaku.app/post/show/" + image.id);
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
    core.dcbot.client.on("ready", () => {
        if (config.enableNewsFeed) {
            core.sankaku.InitNewsFeed(usermap);
        }
    });
    core.dcbot.client.on("messageCreate", async (message) => {
        if (message.author.bot) return;

        if (message.guild === null && message.content.startsWith(core.dcbot.prefix)) {
            let command = message.content.substring(core.dcbot.prefix.length);
            // Suggestor Part
            if (command.startsWith("rngfeed start")) {
                if (!config.enableRNGFeed) {
                    message.channel.send("RNG Feed is disabled due to the lack of ai-backend's GPU performance");
                    return;
                }
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
                    (options.limit ? " limit: " + (options.limit * 10) : " limit: 9.0") +
                    (options.searchtags ? " searchtags: [" + options.searchtags.join(", ") + "]" : "") +
                    (options.no_blacklist ? " no_blacklist" : "") +
                    " feedId: " +
                    options.feedId;
                log(text, "Info");
                message.channel.send(text);
            } else if (command.startsWith("rngfeed stop")) {
                if (!config.enableRNGFeed) {
                    message.channel.send("RNG Feed is disabled due to the lack of ai-backend's GPU performance");
                    return;
                }
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
    if (config.enableRNGFeed === undefined) {
        log("RNGFeed avability was not defined in config.json, disabling", "Error");
        config.enableRNGFeed = false;
    }
    usermap = core.dcbot.usermap;
    initEventHandler();
}

function log(message, serenity) {
    modulename = "suggestor.js";
    if (config.debug) 
        core.tools.log(message, modulename, serenity);
    else if (serenity == "Error") 
        core.tools.log(message, modulename, serenity);
}
