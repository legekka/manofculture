const fs = require("fs");

let core;
let config;

let emotes;

module.exports = {
    init: _init,
};

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    if (!fs.existsSync("./data/emotes.json")) {
        log("Emotes file not found!", "Error");
        return;
    }

    log("Initialized", "Info");
}

function log(message, serenity) {
    modulename = "ratingcollector.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
