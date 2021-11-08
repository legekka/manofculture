const config = require("./config");

const core = {
    tools: require("./modules/tools"),
    aibackend: require("./modules/aibackend"),
    dcbot: require("./modules/dcbot"),
    sankaku: require("./modules/sankaku"),
};

core.aibackend.init(core, config.aibackend);
core.dcbot.init(core, config.dcbot);
core.sankaku.init(core, config.sankaku);
