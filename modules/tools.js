const chalk = require("chalk");
const sharp = require("sharp");

module.exports = {
    log: log,
    ResizeImage: ResizeImage,
};

async function ResizeImage(image) {
    let size = calculateResizedWidthHeight(await sharp(image).metadata());
    return await sharp(image).resize(size.width, size.height).toFormat("jpeg").toBuffer();
}

function calculateResizedWidthHeight(meta) {
    let width, height;
    if (meta.width > meta.height) {
        width = 256;
        height = Math.round(meta.height * (256 / meta.width));
    } else {
        height = 256;
        width = Math.round(meta.width * (256 / meta.height));
    }
    return { width: width, height: height };
}

function log(message, modulename, serenity) {
    var date = new Date();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    if (hours < 10) {
        hours = "0" + hours;
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    if (day < 10) {
        day = "0" + day;
    }
    if (month < 10) {
        month = "0" + month;
    }

    switch (serenity) {
        case "Error":
            serenity = chalk.red(serenity);
            break;
        case "Warning":
            serenity = chalk.yellow(serenity);
            break;
    }

    var dateString = year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds;
    if (modulename && serenity) {
        console.log("[" + dateString + "] " + "[" + modulename + "] " + "[" + serenity + "] " + message);
    } else if (modulename) {
        console.log("[" + dateString + "] " + "[" + modulename + "] " + message);
    } else if (serenity) {
        console.log("[" + dateString + "] " + "[" + serenity + "] " + message);
    } else {
        console.log("[" + dateString + "] " + message);
    }
}
