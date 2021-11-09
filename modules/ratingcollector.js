let core;
let config;

module.exports = {
    init: _init,
};

function _init(coreprogram, configuration) {
    core = coreprogram;
    config = configuration;
    log("Initialized", "Info");
}

function log(message, serenity) {
    modulename = "ratingcollector.js";
    if (config.debug) {
        core.tools.log(message, modulename, serenity);
    }
    if (serenity == "Error") core.tools.log(message, modulename, serenity);
}
