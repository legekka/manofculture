const fs = require("fs");
const { Client } = require("sankaku-client");
const download = require("download");
const sharp = require("sharp");
const client = new Client();

let core;
let config;

let data;
let defaultTags;
let blacklist;

const allowed_extensions = ["jpg", "jpeg", "png", "webp"];

module.exports = {
    init: _init,
    CreateRNGFeed: (options) => {
        let index = CreateRNGFeedArray(options);
        let rngFeedItem = core.sankaku.RNGFeed[index];
        GetRandomImages(rngFeedItem);
        return index;
    },
    InitNewsFeed: () => {
        core.sankaku.NewsFeedArray = [];
        core.sankaku.NewsFeed = setInterval(() => {
            CheckNewImages();
        }, 1000 * 60 * 30);
        CheckNewImages();
    },
};

async function CheckNewImages() {
    log("Checking for new images", "Info");
    let submissions = await client.searchSubmissions({ tags: defaultTags, limit: 200 });

    let newData = [];
    let promises = [];

    for (let submission of submissions.data) {
        if (IsValidSubmission(submission)) {
            if (!data.includes(submission.id)) {
                newData.push({
                    id: submission.id,
                    filename: submission.id + ".jpg",
                    preview_url: submission.preview_url,
                    sample_url: submission.sample_url ? submission.sample_url : submission.file_url,
                    file: core.tools.DownloadPromise(submission.preview_url),
                });
                data.push(submission.id);
            }
        } else {
            data.push(submission.id);
        }
    }
    fs.writeFileSync("./data/sankakudata.json", JSON.stringify(data));
    if (newData.length == 0) {
        log("No new images found", "Info");
        return;
    }
    log(`Found ${newData.length} new submissions`, "Info");
    promises = newData.map((data) => data.file);
    await Promise.all(promises);
    for (let item of newData) {
        item.file = await item.file;
        try {
            await sharp(item.file);
        }
        catch (error) {
            log(`Image ${item.id} is invalid`, "Error");
            item.file.error = true;
        }
    }
    newData = newData.filter((data) => data.file.error == undefined);
    log(`Download completed with ${newData.length} new submissions`, "Info");

    let newImagesArray = [];

    if (newData.length > 0) {
        let images = [];
        for (let item of newData) {
            images.push(item.file);
        }
        let result = await core.aibackend.rateBulk(images, "all");
        let users = result.users;
        let ratings = result.ratings;
        let output = [];
        promises = [];
        for (let i = 0; i < ratings.length; i++) {
            for (let j = 0; j < ratings[i].length; j++) {
                let limit = 0.9;
                let user = core.dcbot.usermap.find((u) => u.name == users[j]);
                if (user.newImageRatingLimit) {
                    limit = user.newImageRatingLimit;
                }
                if (ratings[i][j] >= limit) {
                    output.push({
                        id: newData[i].id,
                        filename: newData[i].filename,
                        user: users[j],
                        rating: ratings[i][j],
                        file: core.tools.DownloadPromise(newData[i].sample_url, true),
                    });
                }
            }
        }
        promises = output.map((data) => data.file);
        if (promises.length == 0) {
            log("No high rated images found", "Info");
            return;
        }
        log("Downloading " + promises.length + " high quality images", "Info");
        await Promise.all(promises);
        for (let item of output) {
            item.file = await item.file;
            try {
                await sharp(item.file);
            }
            catch (error) {
                log(`Image ${item.id} is invalid`, "Error");
                item.file.error = true;
            }
        }
        output = output.filter((data) => typeof data.file.error === 'undefined');
        log("Download completed with " + output.length + " high quality images", "Info");
        for (let item of output) {
            //core.sankaku.NewsFeedArray.push(item);
            newImagesArray.push(item);
        }
    }

    // create a list for every user in the core.sankaku.NewsFeedArray
    for (let item of newImagesArray) {
        let user = core.dcbot.usermap.find((u) => u.name == item.user);
        if (user) {
            let newsFeedList = core.sankaku.NewsFeedArray.find((list) => list.user == user.name);
            if (!newsFeedList) {
                newsFeedList = {
                    user: user.name,
                    images: [],
                };
                newsFeedList.images.push(item);
                core.sankaku.NewsFeedArray.push(newsFeedList);
            } else {
                newsFeedList.images.push(item);
            }
        }
    }
    core.suggestor.sendNewImages();
}

async function GetRandomImages(rngFeedItem) {
    let feedArray = rngFeedItem.feedArray;
    let options = rngFeedItem.options;
    let username = options.username;
    let limit = options.limit ? options.limit : 0.9;
    let searchtags = options.searchtags ? options.searchtags : defaultTags;

    if (!rngFeedItem.active[0]) {
        return;
    }
    let submissions = await client.searchSubmissions({ tags: searchtags, order_by: "random", limit: config.pageLimit });
    if (submissions.data.length == 0) {
        log("No images found", "Warning");
        feedArray.push({ error: "No images found", username: username, feedId: options.feedId });
        core.suggestor.sendRNGImages(options.feedId);
        return;
    }

    submissions.data = submissions.data.filter((submission) => !rngFeedItem.ids.includes(submission.id));

    submissions.data.forEach((submission) => {
        rngFeedItem.ids.push(submission.id);
    });
    if (submissions.data.length == 0) {
        log("No more images", "Warning");
        feedArray.push({ error: "No more images", username: username, feedId: options.feedId });
        core.suggestor.sendRNGImages(options.feedId);
        return;
    }

    if (!rngFeedItem.active[0]) {
        return;
    }
    let newData = [];
    for (let submission of submissions.data) {
        if (IsValidSubmission(submission, options.no_blacklist)) {
            newData.push({
                id: submission.id,
                filename: submission.id + ".jpg",
                preview_url: submission.preview_url,
                sample_url: submission.sample_url ? submission.sample_url : submission.file_url,
                file: core.tools.DownloadPromise(submission.preview_url),
            });
        }
    }
    let promises = newData.map((data) => data.file);
    log(`Downloading ${newData.length} previews for ${username}`, "Info");
    await Promise.all(promises);
    for (let item of newData) {
        item.file = await item.file;
    }
    newData = newData.filter((data) => data.file.error == undefined);
    log(`Download completed with ${newData.length} previews`, "Info");

    if (!rngFeedItem.active[0]) {
        return;
    }
    GetRandomImages(rngFeedItem);

    if (newData.length > 0) {
        let output = [];
        let images = [];
        for (let item of newData) {
            images.push(item.file);
        }
        if (!rngFeedItem.active[0]) {
            return;
        }
        let result = await core.aibackend.rateBulk(images, username);
        for (let i = 0; i < result.ratings.length; i++) {
            if (result.ratings[i] >= limit) {
                output.push({
                    id: newData[i].id,
                    filename: newData[i].filename,
                    user: username,
                    rating: result.ratings[i],
                    feedId: options.feedId,
                    file: core.tools.DownloadPromise(newData[i].sample_url, true),
                });
            }
        }
        promises = output.map((data) => data.file);
        log(`Downloading ${output.length} samples for ${username}`, "Info");
        await Promise.all(promises);
        for (let item of output) {
            item.file = await item.file;
        }

        output = output.filter((data) => data.file.error == undefined);
        log(`Download completed with ${output.length} samples`, "Info");

        if (!rngFeedItem.active[0]) {
            return;
        }

        for (let item of output) {
            feedArray.push(item);
        }
        core.suggestor.sendRNGImages(options.feedId);
    }
}

function CreateRNGFeedArray(options) {
    let rngFeedItem = {
        username: options.username,
        feedArray: [],
        ids: [],
        options: options,
        active: [true],
    };
    core.sankaku.RNGFeed.push(rngFeedItem);
    let feedId = core.sankaku.RNGFeed.length - 1;
    rngFeedItem.options.feedId = feedId;
    return feedId;
}

function IsValidSubmission(submission, no_blacklist) {
    if (submission.file_type === undefined) {
        return false;
    }
    if (!allowed_extensions.includes(submission.file_type.split("/").pop())) {
        return false;
    }
    if (!no_blacklist) {
        if (submission.tags.some((tag) => blacklist.includes(tag.name_en))) {
            return false;
        }
    }
    if (submission.preview_url == null) {
        return false;
    }
    return true;
}

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!core.sankaku.RNGFeed) {
        core.sankaku.RNGFeed = [];
    }
    if (!config.username || !config.password) {
        log("No username or password specified, check your config.json file.", "Error");
        return;
    }
    if (!fs.existsSync("./data/sankakudata.json")) {
        log("sankakudata.json was not found, creating a new one.", "Warning");
        fs.writeFileSync("./data/sankakudata.json", "[]");
        data = [];
    } else {
        data = JSON.parse(fs.readFileSync("./data/sankakudata.json"));
        log("sankakudata.json has " + data.length + " known images.", "Info");
    }
    if (!fs.existsSync("./data/blacklist.json")) {
        log("blacklist.json was not found, creating an empty one.", "Warning");
        fs.writeFileSync("./data/blacklist.json", "[]");
        blacklist = [];
    } else {
        blacklist = JSON.parse(fs.readFileSync("./data/blacklist.json"));
        log("blacklist.json has " + blacklist.length + " blacklisted tags.", "Info");
    }
    if (!fs.existsSync("./data/defaulttags.json")) {
        log("defaulttags.json was not found, creating new one with a 'solo' tag.", "Warning");
        fs.writeFileSync("./data/defaulttags.json", '["solo"]');
        defaultTags = ["solo"];
    } else {
        defaultTags = JSON.parse(fs.readFileSync("./data/defaulttags.json"));
        log("defaulttags.json has " + defaultTags.length + " tags.", "Info");
    }
    log("Logging in...", "Info");
    client
        .login({ login: config.username, password: config.password })
        .then(() => {
            log("Logged in.", "Info");
        })
        .catch(() => {
            log("Login failed.", "Error");
        });
}

function log(message, serenity) {
    modulename = "sankaku.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
