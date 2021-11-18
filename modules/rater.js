const download = require("download");
const fs = require("fs");
const { MessageEmbed } = require("discord.js");

let core;
let config;

const allowed_extensions = ["jpg", "jpeg", "png", "webp"];

module.exports = {
    init: _init,
    RateImage: _rateImage,
};

async function _rateImage(url, filename) {
    let extension = filename.split(".").pop();
    if (!allowed_extensions.includes(extension)) {
        log("Invalid file extension: " + extension, "Warning");
        return { error: "Invalid file extension: " + extension };
    }
    let file = await core.tools.DownloadPromise(url);
    if (file.error) {
        log("Error downloading image: " + file.error, "Error");
        return { error: "Error downloading image: " + file.error };
    }
    let result;
    try {
        result = await core.aibackend.rate(file, "all");
    } catch (e) {
        log(e, "Error");
        return { error: "aibackend error" };
    }
    let ratings = [];

    for (let i = 0; i < result.rating.length; i++) {
        ratings.push({
            name: result.users[i],
            rating: result.rating[i],
        });
    }

    ratings.sort((a, b) => (a.rating > b.rating ? -1 : 1));

    return createEmbed(url, ratings);
}

function createEmbed(url, ratings) {
    let embed = new MessageEmbed();
    embed.setThumbnail(url);
    embed.setTitle("User Ratings");
    embed.setColor("#0066ff");
    let desc = "";
    for (let i = 0; i < ratings.length; i++) {
        desc += `**${ratings[i].name}**'s rating: **${(ratings[i].rating * 10).toFixed(1)}**/10 | *${roundRating(ratings[i].rating)}*\n`;
    }
    embed.setDescription(desc);
    embed.setFooter(`Using RaterNN1S personalized models`, "https://cdn.discordapp.com/avatars/899696794945081374/76fac7e4401f776d4b84eed4f31d28d8.webp?size=128");
    return embed;
}

function roundRating(rating) {
    let d = 0.166 / 2;
    if (rating < d) {
        return -3;
    } else if (rating < 0.166 + d) {
        return -2;
    } else if (rating < 0.333 + d) {
        return -1;
    } else if (rating < 0.5 + d) {
        return 0;
    } else if (rating < 0.666 + d) {
        return 1;
    } else if (rating < 0.833 + d) {
        return 2;
    } else {
        return 3;
    }
}

function initEventHandler() {
    core.dcbot.client.on("messageCreate", (message) => {
        if (message.author.bot) return;

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
    });
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!config.raterChannels) {
        log("No rater channels defined!", "Error");
        return;
    }
    initEventHandler();
    log("Initialized", "Info");
}

function log(message, serenity) {
    modulename = "rater.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
