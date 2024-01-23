const fs = require("fs");

let core;
let config;

let emotes;
let data;

const allowed_extensions = ["jpg", "jpeg", "png", "webp"];
const outputPath = "./training/images/";
let downloading = [];

module.exports = {
    init: _init,
};

function putEmotes(message) {
    emotes.forEach((emote) => {
        message.react(`<:${emote.name}:${emote.id}>`);
    });
}

function createNewDataEntry(image, username, userid, rating) {
    let usermap = core.dcbot.usermap;
    let user = usermap.find((user) => user.userid == userid);
    if (!user) {
        log("User not found, rating dropped", "Warning");
        return;
    }
    let entry = data.find((entry) => entry.image === image && entry.userid === userid);
    if (!entry) {
        data.push({ image: image, username: username, userid: userid, rating: rating });
    } else {
        entry.rating = rating;
    }
    if (!news.find((username) => username === user.name)) {
        news.push(user.name);
    }
    fs.writeFileSync("./training/data.json", JSON.stringify(data));
    fs.writeFileSync("./training/news.json", JSON.stringify(news));
}

function initEventHandler() {
    core.dcbot.client.on("messageReactionAdd", async (reaction, user) => {
        if (config.ratingcollectorChannels.includes(reaction.message.channel.id)) {
            if (user.bot) {
                return;
            }
            let message = reaction.message;

            let url = "";
            let filename = "";
            let extension = "";
            if (message.attachments.size > 0) {
                let attachment = message.attachments.first();
                url = attachment.url;
                filename = attachment.id;
                extension = attachment.name.split(".").pop();
            } else if (message.content.includes("http")) {
                let words = message.content.split(" ");
                url = words.find((word) => word.includes("http"));
                extension = url.split("/").pop().split(".").pop();
                if (!allowed_extensions.includes(extension)) {
                    return;
                }
                filename = message.id;
            } else {
                return;
            }

            let emote = emotes.find((emote) => emote.id == reaction.emoji.id);
            if (!emote) {
                return;
            }
            let rating = emote.value;
            if (fs.existsSync(outputPath + filename + ".jpg") || downloading.includes(filename)) {
                createNewDataEntry(filename + ".jpg", user.username, user.id, rating);
                message.reply({
                    content: "Rating added for " + user.username + ": " + (rating * 10).toFixed(1) + "/10",
                    allowedMentions: {
                        repliedUser: false,
                    },
                });
            } else {
                downloading.push(filename);
                core.tools.DownloadPromise(url, true).then(async (filebuffer) => {
                    downloading.splice(downloading.indexOf(filename), 1);
                    let buffer = await core.tools.ResizeImage(filebuffer);
                    fs.writeFileSync(outputPath + filename + ".jpg", buffer);
                    createNewDataEntry(filename + ".jpg", user.username, user.id, rating);
                    message.reply({
                        content: "Rating added for " + user.username + ": " + (rating * 10).toFixed(1) + "/10",
                        allowedMentions: {
                            repliedUser: false,
                        },
                    });
                });
            }
            reaction.users.remove(user);
        }
    });

    core.dcbot.client.on("messageCreate", async (message) => {
        if (config.ratingcollectorChannels.includes(message.channel.id) && !message.author.bot) {
            if (message.attachments.size > 0) {
                putEmotes(message);
            } else if (message.content.includes("http")) {
                let words = message.content.split(" ");
                url = words.find((word) => word.includes("http"));
                let extension = url.split("/").pop().split(".").pop();
                if (!allowed_extensions.includes(extension)) {
                    return;
                }
                putEmotes(message);
            }
        }
    });
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!fs.existsSync("./data/emotes.json")) {
        log("Emotes file not found!", "Error");
        return;
    }
    if (!fs.existsSync("./training/data.json")) {
        log("Training data file not found, creating a new one", "Warning");
        fs.writeFileSync("./training/data.json", JSON.stringify([]));
    }
    if (!fs.existsSync("./training/news.json")) {
        log("news.json not found not found, creating a new one.", "Warning");
        fs.writeFileSync("./training/news.json", JSON.stringify([]));
    }
    emotes = JSON.parse(fs.readFileSync("./data/emotes.json"));
    data = JSON.parse(fs.readFileSync("./training/data.json"));
    news = JSON.parse(fs.readFileSync("./training/news.json"));
    core.ratingcollector.data = data;
    core.ratingcollector.news = news;
    initEventHandler();
    log("Initialized", "Info");
}

function log(message, serenity) {
    modulename = "ratingcollector.js";
    if (config.debug) 
        core.tools.log(message, modulename, serenity);
    else if (serenity == "Error") 
        core.tools.log(message, modulename, serenity);
}
