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
    let file = await core.sankaku.DownloadPromise(url);
    if (file.error) {
        log("Error downloading image: " + file.error, "Error");
        return { error: "Error downloading image: " + file.error };
    }
    let result = await core.aibackend.tag(file);

    let tags = [];
    for (let i = 0; i < result.labels.length; i++) {
        tags.push({
            name: result.labels[i],
            confidence: result.confidences[i],
        });
    }

    tags.sort((a, b) => b.confidence - a.confidence);
    return createEmbed(url, tags);
}

function createEmbed(url, tags) {
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
    embed.setFooter(`Using TaggerNN4S (989 classes)`, "https://cdn.discordapp.com/avatars/881795555167203328/9819e1d7909739cecd114b81311cb252.webp?size=128");
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

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!fs.existsSync("./data/colors.json")) {
        log("colors.json not found in data folder", "Error");
        return;
    }
    colors = JSON.parse(fs.readFileSync("./data/colors.json"));
    log("Initialized", "Info");
}

function log(message, serenity) {
    modulename = "tagger.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
