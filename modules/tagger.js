const download = require("download");
const fs = require("fs");
const { MessageEmbed } = require("discord.js");

let core;
let config;
let colors;

const allowed_extensions = ["jpg", "jpeg", "png", "webp"];

module.exports = {
    init: _init,
    TagImage: _tagImage,
};

async function _tagImage(url, filename) {
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
        result = await core.aibackend.tag(file);
    } catch (e) {
        log(e, "Error");
        return { error: "aibackend error" };
    }
    let tags = [];
    for (let i = 0; i < result.tags.length; i++) {
        tags.push({
            name: result.tags[i][0],
            confidence: result.tags[i][1],
        });
    }

    // tags.sort((a, b) => b.confidence - a.confidence);
    return createEmbed(url, tags, "TaggerNN v11 (6000 classes)");
}

function createEmbed(url, tags, modelname) {
    let embed = new MessageEmbed();
    embed.setTitle("Tags");
    embed.setThumbnail(url);
    embed.setColor(generateEmbedColor(tags));
    let desc = "";
    tags.forEach((tag) => {
        if (tag.confidence > 0.95) {
            desc += `**${tag.name}** (${(tag.confidence * 100).toFixed(2)}%)\n`;
        } else if (tag.confidence > 0.6) {
            desc += `${tag.name} *(${(tag.confidence * 100).toFixed(2)}%)*\n`;
        } else if (tag.confidence > 0.5) {
            desc += `*${tag.name} (${(tag.confidence * 100).toFixed(2)}%)*\n`;
        }
    });
    embed.setDescription(desc);
    embed.setFooter(`Using ${modelname}`, "https://cdn.discordapp.com/avatars/899696794945081374/76fac7e4401f776d4b84eed4f31d28d8.webp?size=128");
    return embed;
}

function generateEmbedColor(tags) {
    let eyecolor = {
        color: "",
        confidence: 0,
    };
    let haircolor = {
        color: "",
        confidence: 0,
    };
    // if tags includes an element from colors.eyes['name'], use the colors.eyes[element].color
    if (tags.some((tag) => colors.eyes.some((eye) => eye.tag === tag.name))) {
        eyecolor.color = colors.eyes.find((eye) => eye.tag === tags.find((tag) => colors.eyes.some((eye) => eye.tag === tag.name)).name).color;
        eyecolor.confidence = tags.find((tag) => colors.eyes.some((eye) => eye.tag === tag.name)).confidence;
    }
    // if tags includes an element from colors.hair['name'], use the colors.hair[element].color
    if (tags.some((tag) => colors.hair.some((hair) => hair.tag === tag.name))) {
        haircolor.color = colors.hair.find((hair) => hair.tag === tags.find((tag) => colors.hair.some((hair) => hair.tag === tag.name)).name).color;
        haircolor.confidence = tags.find((tag) => colors.hair.some((hair) => hair.tag === tag.name)).confidence;
    }

    if (eyecolor.color != "" && haircolor.color != "") {
        if (eyecolor.confidence > haircolor.confidence) {
            return eyecolor.color;
        } else {
            return haircolor.color;
        }
    } else if (eyecolor.color != "") {
        return eyecolor.color;
    } else if (haircolor.color != "") {
        return haircolor.color;
    } else {
        return "#0066ff";
    }
}

function initEventHandler() {
    core.dcbot.client.on("messageCreate", (message) => {
        if (message.author.bot) return;

        if (config.taggerChannels.includes(message.channel.id)) {
            let url, filename, extension;
            if (message.attachments.size > 0) {
                url = message.attachments.first().url;
                filename = message.attachments.first().name;
            } else if (message.content.includes("http")) {
                url = message.content.split(" ").find((w) => w.includes("http"));
                extension = url.split("/").pop().split(".").pop();
                filename = message.id + "." + extension;
            }
            core.tagger.TagImage(url, filename).then((embed) => {
                if (!embed.error) message.channel.send({ embeds: [embed] });
                else message.channel.send("Error: " + embed.error);
            });
        }
    });
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!config.taggerChannels) {
        log("No tagger channels defined!", "Error");
        return;
    }
    if (!fs.existsSync("./data/colors.json")) {
        log("colors.json not found in data folder", "Error");
        return;
    }
    colors = JSON.parse(fs.readFileSync("./data/colors.json"));
    initEventHandler();
    log("Initialized", "Info");
}

function log(message, serenity) {
    modulename = "tagger.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
