const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");
const util = require("util");

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

    getTrainingStatus: function () {
        return new Promise((resolve, reject) => {
            axios
                .get(config.backendUrl + "/training/status")
                .then((response) => {
                    resolve(response.data);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    },

    trainUser: function (user) {
        return new Promise(async (resolve, reject) => {
            let form = new FormData();
            form.append("user", user);
            log("Training user " + user, "Info");
            try {
                let promise = axios.post(config.backendUrl + "training/train", form, {
                    headers: form.getHeaders(),
                });
                await new Promise((resolve) => setTimeout(resolve, 5000));
                if (util.inspect(promise).includes("pending")) resolve({});
                else resolve((await promise).data);
            } catch (error) {
                log("Error while training user " + user, "Error");
                reject({ error: error });
            }
        });
    },

    updateTrainingData: function (data) {
        return new Promise((resolve, reject) => {
            let form = new FormData();
            form.append("data", JSON.stringify(data));
            log("Updating training data", "Info");
            axios
                .post(config.backendUrl + "training/update", form, {
                    headers: form.getHeaders(),
                })
                .then((response) => {
                    log("Training data updated", "Info");
                    resolve(response.data);
                })
                .catch((error) => {
                    log("Error updating training data", "Error");
                    reject(error);
                });
        });
    },

    sendImages: function (images, filenames) {
        return new Promise((resolve, reject) => {
            let form = new FormData();
            for (let i = 0; i < images.length; i++) {
                form.append("images", images[i], filenames[i]);
            }
            log(`Sending ${images.length} training images to AI backend`, "Info");
            axios
                .post(config.backendUrl + "training/addimages", form, {
                    headers: form.getHeaders(),
                })
                .then((response) => {
                    log("Training images sent to AI backend", "Info");
                    resolve(response.data);
                })
                .catch((error) => {
                    log("Error sending training images to AI backend", "Error");
                    reject(error);
                });
        });
    },

    sendImage: function (image, filename) {
        return new Promise((resolve, reject) => {
            let form = new FormData();
            form.append("image", image, { filename: filename });
            log("Sending training image to AI Backend", "Info");
            axios
                .post(config.backendUrl + "training/addimage", form, {
                    headers: form.getHeaders(),
                })
                .then((response) => {
                    log("Image sent succesfully to AI Backend", "Info");
                    resolve(response.data);
                })
                .catch((error) => {
                    log("Error sending image to AI Backend", "Error");
                    reject(error);
                });
        });
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
