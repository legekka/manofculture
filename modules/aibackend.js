const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");

let core;
let config;

module.exports = {
    init: (coreprogram, configuration) => {
        core = coreprogram;
        config = configuration;
        if (config.backendUrl == "") {
            log("BackendUrl is not set in configuration file", "Error");
            return;
        }
        log("AI Backend initialized", "Info");
    },

    rate: function (image, user) {
        return new Promise(async function (resolve, reject) {
            let buffer = await core.tools.ResizeImage(image);
            let form = new FormData();
            form.append("image", buffer, { filename: generateRandomFilename() });
            form.append("user", user);
            log("Sending image to rate to AI backend", "Info");
            let start = new Date();
            axios
                .post(config.backendUrl + "rate", form, {
                    headers: form.getHeaders(),
                })
                .then(function (response) {
                    log(`Revieced rating from AI backend (${new Date() - start}ms)`, "Info");
                    resolve(response.data);
                })
                .catch(function (error) {
                    log(`Error while receiving rating from AI backend`, "Error");
                    reject(error);
                });
        });
    },

    rateBulk: function (images, user) {
        return new Promise(async function (resolve, reject) {
            let form = new FormData();
            for (let i = 0; i < images.length; i++) {
                let buffer = await core.tools.ResizeImage(images[i]);
                form.append("images", buffer, { filename: generateRandomFilename() });
            }
            log(`Sending ${images.length} images to rate to AI backend`, "Info");
            let start = new Date();
            form.append("user", user);
            axios
                .post(config.backendUrl + "ratebulk", form, {
                    headers: form.getHeaders(),
                })
                .then(function (response) {
                    log(`Recieved ${response.data.ratings.length} ratings from AI backend (${new Date() - start}ms)`, "Info");
                    resolve(response.data);
                })
                .catch(function (error) {
                    log(`Error while receiving ratings from AI backend`, "Error");
                    reject(error);
                });
        });
    },

    tag: function (image) {
        return new Promise(async function (resolve, reject) {
            let buffer = await core.tools.ResizeImage(image);
            let form = new FormData();
            log("Sending image to tag to AI backend", "Info");
            form.append("image", buffer, { filename: generateRandomFilename() });
            let start = new Date();
            axios
                .post(config.backendUrl + "tag", form, {
                    headers: form.getHeaders(),
                })
                .then(function (response) {
                    log(`Received tag response from AI backend (${new Date() - start}ms)`, "Info");
                    resolve(response.data);
                })
                .catch(function (error) {
                    log(`Error while receiving tag response from AI backend`, "Error");
                    reject(error);
                });
        });
    },
};

function generateRandomFilename() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + ".jpg";
}

function log(message, serenity) {
    modulename = "aibackend.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
