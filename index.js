const config = require("./config");

const core = {
    tools: require("./modules/tools"),
    aibackend: require("./modules/aibackend"),
    dcbot: require("./modules/dcbot"),
    sankaku: require("./modules/sankaku"),
    tagger: require("./modules/tagger"),
    rater: require("./modules/rater"),
    ratingcollector: require("./modules/ratingcollector"),
};

core.aibackend.init(core, config.aibackend);
core.dcbot.init(core, config.dcbot);
core.sankaku.init(core, config.sankaku);
core.tagger.init(core, config.tagger);
core.rater.init(core, config.rater);
core.ratingcollector.init(core, config.ratingcollector);
