const fs = require("fs");
const request = require("request");

let core;
let config;

module.exports = {
    init: _init,
    upload: upload,
};

function upload(filepath) {
    return new Promise((resolve, reject) => {
        let r = request.post(
            {
                url: "https://fs.boltz.hu/api/files/upload",
                formData: {
                    key: config.key,
                    file: fs.createReadStream(filepath),
                },
            },
            function (err, httpResponse, body) {
                if (err) {
                    log(err, "Error");
                    reject(err);
                }
                resolve(JSON.parse(body).url);
            }
        );
    });
}

function _init(_core, _config) {
    core = _core;
    config = _config;
}

function log(message, serenity) {
    modulename = "bfish.js";
    if (config.debug) 
        core.tools.log(message, modulename, serenity);
    else if (serenity == "Error") 
        core.tools.log(message, modulename, serenity);
}
