const fs = require("fs");
const { MessageEmbed } = require("discord.js");

let core;
let config;

module.exports = {
    init: _init,
};

function scheduledRetraining() {
    log("Starting scheduled retraining", "Info");
    updateBackend().then((result) => {
        log(result.success, "Info");
        trainUser("all").then((result) => {
            if (result.error) {
                log(result.error, "Error");
            } else {
                log(result.success, "Info");
            }
        });
    });
}

async function getTrainingStatus() {
    let result = await core.aibackend.getTrainingStatus();
    if (result.error) {
        log("Error getting training status: " + result.error, "Error");
        return { error: "Error getting training status: " + result.error };
    }
    log("Got training status", "Info");
    return result;
}

async function trainUser(user, forced) {
    let username;
    if (user == "all") {
        username = "all";
    } else {
        username = user.name;
    }
    if (!forced) {
        if (username == "all" && core.ratingcollector.data.length == 0) {
            return { error: "No users needed to train" };
        }
        if (username != "all" && !core.ratingcollector.news.includes(username)) {
            return { error: "Training is not needed for " + username };
        }
    }
    let result = await updateBackend();
    if (result.error) {
        return { error: result.error };
    }
    result = await core.aibackend.trainUser(username);
    if (result.error) {
        log("Error training user: " + result.error, "Error");
        return { error: "Error training user: " + result.error };
    }
    log("Training user " + username + " started", "Info");
    if (username == "all") {
        core.ratingcollector.news = [];
    } else {
        let userIndex = core.ratingcollector.news.findIndex((user) => user == username);
        if (userIndex != -1) {
            core.ratingcollector.news.splice(userIndex, 1);
        }
    }
    fs.writeFileSync("./training/news.json", JSON.stringify(core.ratingcollector.news));
    return { success: "Training user " + username + " started" };
}

async function updateBackend() {
    let filelist = fs.readdirSync("./training/images");
    let images = [];
    let filenames = [];
    for (let file of filelist) {
        if (file.endsWith(".jpg")) {
            images.push(fs.readFileSync("./training/images/" + file));
            filenames.push(file);
        }
    }

    let i = 0;
    while (i < images.length) {
        let imagesToSend = images.slice(i, i + 100);
        let filenamesToSend = filenames.slice(i, i + 100);
        await core.aibackend.sendImages(imagesToSend, filenamesToSend);
        i += 100;
    }

    for (let file of filelist) {
        fs.unlinkSync("./training/images/" + file);
    }

    let data = core.ratingcollector.data;
    let result = await core.aibackend.updateTrainingData(data);
    if (result.error) {
        log("Error updating training data: " + result.error, "Error");
        return { error: "Error updating training data: " + result.error };
    }
    log("Updated training data", "Info");
    return { success: "Training data updated" };
}

function initEventHandler() {
    core.dcbot.client.on("messageCreate", (message) => {
        if (message.author.bot) return;
        if (message.guild === null && message.content.startsWith(core.dcbot.prefix)) {
            let command = message.content.substring(core.dcbot.prefix.length).split(" ")[0];
            if (command == "updatetrainingdata") {
                if (message.author.id != config.ownerID) {
                    message.channel.send("You are not allowed to use this command!");
                    return;
                }
                updateBackend().then((result) => {
                    if (result.error) {
                        message.channel.send(result.error);
                    } else {
                        message.channel.send(result.success);
                    }
                });
            } else if (command == "retrain") {
                if (message.content.split(" ").length == 1) {
                    let user = core.dcbot.usermap.find((user) => user.userid == message.author.id);
                    if (user) {
                        trainUser(user).then((result) => {
                            if (result.error) {
                                message.channel.send(result.error);
                            } else {
                                message.channel.send(result.success);
                            }
                        });
                    } else {
                        message.channel.send("You are not registered!");
                    }
                } else {
                    if (message.author.id != config.ownerID) {
                        message.channel.send("You are not allowed to force retrain users!");
                        return;
                    }
                    let user = core.dcbot.usermap.find((user) => user.name == message.content.split(" ")[1]);
                    if (user) {
                        trainUser(user, true).then((result) => {
                            if (result.error) {
                                message.channel.send(result.error);
                            } else {
                                message.channel.send(result.success);
                            }
                        });
                    } else {
                        message.channel.send("User not found!");
                    }
                }
            } else if (command == "status") {
                getTrainingStatus().then((result) => {
                    if (result.error) {
                        message.channel.send(result.error);
                    } else {
                        message.channel.send(
                            `Users needed to retrain: ${core.ratingcollector.news.join(",")}\nai-backend:${"```"}\nis_training: ${result.is_training}\nCurrent User: ${result.user}\nProgress: ${
                                result.progress * 100
                            }%\n${"```"}`
                        );
                    }
                });
            }
        }
    });
}

function initRetrainingTimer() {
    let date = new Date();
    let hour = date.getHours();
    let minute = date.getMinutes();
    let second = date.getSeconds();
    let millisecond = date.getMilliseconds();
    let currentTime = hour * 3600 + minute * 60 + second + millisecond / 1000;
    let nextTime = 23 * 3600 + 30 * 60;
    let timeDifference = nextTime - currentTime;
    if (timeDifference < 0) {
        timeDifference = 24 * 3600 + timeDifference;
    }
    let remainingHours = Math.floor(timeDifference / 3600);
    let remainingMinutes = Math.floor((timeDifference - remainingHours * 3600) / 60);
    let remainingSeconds = Math.floor(timeDifference - remainingHours * 3600 - remainingMinutes * 60);
    log(`Time remaining until next retraining is ${remainingHours}:${remainingMinutes}:${remainingSeconds}`, "Info");
    setTimeout(() => {
        scheduledRetraining();
        setInterval(() => {
            scheduledRetraining();
        }, 86400000);
    }, timeDifference * 1000);
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (config.scheduledRetraining === undefined) {
        log("Scheduled retraining is disabled", "Info");
    }
    if (config.scheduledRetraining) initRetrainingTimer();
    initEventHandler();
    log("Initialized", "Info");
}

function log(message, serenity) {
    modulename = "trainer.js";
    if (config.debug) 
        core.tools.log(message, modulename, serenity);
    else if (serenity == "Error") 
        core.tools.log(message, modulename, serenity);
}
