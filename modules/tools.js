const chalk = require("chalk");
const sharp = require("sharp");
const download = require("download");
const fs = require("fs");

let core;

module.exports = {
    init: (coreprogram) => {
        core = coreprogram;
    },
    log: log,
    ResizeImage: ResizeImage,
    DownloadPromise: DownloadPromise,
    createBox: createBox,
};

function DownloadPromise(url, conversion) {
    return new Promise(async (resolve, reject) => {
        let filebuffer = await download(url, { throwHttpErrors: false });
        if (typeof filebuffer.length === 'undefined') {
            resolve({ error: "Failed to download image" });
            return;
        }
        if (filebuffer.toString().startsWith("<!DOCTYPE html>")) {
            resolve({ error: "Failed to download image" });
            return;
        }
        if (conversion) {
            filebuffer = await sharp(filebuffer).toFormat("jpeg").toBuffer();
        }
        resolve(filebuffer);
    });
}

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


async function createBox(buffers, maxWidth, gapsize, minHeight, maxHeight) {
    if (!maxWidth) {
        maxWidth = 2000;
    }
    if (!minHeight) {
        minHeight = 400;
    }
    if (!maxHeight) {
        maxHeight = 750;
    }
    if (!gapsize) {
        gapsize = 10;
    }

    let images = [];


    for (let i = 0; i < buffers.length; i++) {
        let dimensions = await sharp(buffers[i]).metadata();
        let image = {
            buffer: buffers[i],
            width: dimensions.width,
            height: dimensions.height,
            ratio: dimensions.width / dimensions.height
        }
        images.push(image);
    }

    let rows = [];

    if (images.length > 4) {

        while (images.length > 0) {
            let row = createRow(images, minHeight, maxHeight, maxWidth, gapsize);
            if (images.length - row.length == 1) {
                if (row.length > 2) {
                    let imagesToRow = images.splice(0, row.length - 1);
                    rows.push(createRow(imagesToRow, minHeight, maxHeight, maxWidth, gapsize));
                } else {
                    rows.push(createForcedRow(images, maxWidth, gapsize));
                    images = [];
                }
            } else {
                rows.push(row);
                images.splice(0, row.length);
            }
        }
    } else if (images.length > 3) {
        let firsthalf = images.splice(0, 2);
        rows.push(createForcedRow(firsthalf, maxWidth, gapsize));
        rows.push(createForcedRow(images, maxWidth, gapsize));
    } else if (images.length > 2) {
        let row = createRow(images, minHeight, maxHeight, maxWidth, gapsize);
        rows.push(row);
        images.splice(0, row.length);
        if (images.length > 0) {
            rows.push(createForcedRow(images, maxWidth, gapsize));
        }
    } else {
        rows.push(createForcedRow(images, maxWidth, gapsize));
    }

    let width = maxWidth;
    let heightsum = rows.reduce((sum, row) => {
        return sum + row[0].height;
    }, 0);
    let height = heightsum + (gapsize * (rows.length - 1));

    for (row of rows) {
        for (image of row) {
            image.width = Math.round(image.width);
            image.height = Math.round(image.height);
            image.buffer = await sharp(image.buffer).resize(image.width, image.height).toBuffer();
        }
    }

    let compositeArray = [];
    let currentRowHeight = 0;
    let counter = 0;
    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        if (i > 0) {
            currentRowHeight += rows[i - 1][0].height + gapsize;
        }
        let currentColumnWidth = 0;
        for (let j = 0; j < row.length; j++) {
            if (j > 0) {
                currentColumnWidth += row[j - 1].width + gapsize;
            }
            let imageobject = {
                input: row[j].buffer,
                left: currentColumnWidth,
                top: currentRowHeight,
            }
            counter++;
            let numberobject = {
                input: await createNumber(maxWidth / 30, counter),
                left: currentColumnWidth + gapsize,
                top: currentRowHeight + gapsize,
            }
            compositeArray.push(imageobject);
            compositeArray.push(numberobject);
        }
    }

    return await sharp(await createNewImage(width, height))
        .composite(compositeArray)
        .toBuffer();

}

function makeRow(images, scales) {
    let rowImages = [];
    for (let i = 0; i < images.length; i++) {
        rowImages.push(resizeByWidth(images[i], scales[i]));
    }
    return rowImages;
}

function createForcedRow(images, maxWidth, gapsize) {
    return makeRow(images, calculateScales(images, maxWidth, gapsize));
}

function createRow(images, minHeight, maxHeight, maxWidth, gapsize) {
    let rowImages = [];
    let i = 1;
    let done = false;
    while (!done) {
        let row = images.slice(0, i);
        let testRow = makeRow(row, calculateScales(row, maxWidth, gapsize));
        if (testRow[0].height > minHeight && testRow[0].height < maxHeight) {
            if (i === images.length) {
                rowImages = testRow;
                done = true;
            } else {
                i++;
            }
        } else {
            if (testRow[0].height < minHeight && i > 1) {
                i--;
                row = images.slice(0, i);
                rowImages = makeRow(row, calculateScales(row, maxWidth, gapsize));
                done = true;
            } else if (testRow[0].height > maxHeight && i == images.length) {
                rowImages = testRow;
                done = true;
            } else {
                if (i === images.length) {
                    rowImages = testRow;
                    done = true;
                } else {
                    i++;
                }
            }
        }
    }
    return rowImages;
}


function calculateScales(images, maxWidth, gapsize) {
    let scales = [];
    for (image of images) {
        let part = 1;
        for (let i = 0; i < images.length; i++) {
            if (images[i] !== image) {
                part += images[i].ratio / image.ratio;
            }
        }
        scales.push((maxWidth - (gapsize * (images.length - 1))) / part);
    }
    return scales;
}

function resizeByWidth(image, newWidth) {
    let newHeight = image.height * newWidth / image.width;
    return {
        ratio: image.ratio,
        width: newWidth,
        height: newHeight,
        buffer: image.buffer
    };
}



async function createNewImage(width, height) {
    let svgImage = `
    <svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="#5e5e5e"/>
    </svg>
    `;
    return await sharp(Buffer.from(svgImage, 'utf8')).toBuffer();
}

async function createNumber(size, number) {
    let svgNumber = `
    <svg width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - size * 0.05}" fill="#a1d149" stroke="#fff" stroke-width="${size * 0.05}"/>
        <text x="50%" y="70%" text-anchor="middle" alignment-baseline="middle" fill="#ffffff" font-size="${size * 0.66}" font-weight="bold">${number}</text>
    </svg>
    `;
    return await sharp(Buffer.from(svgNumber, 'utf8')).toBuffer();
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
    var messageString;
    if (modulename && serenity) {
        messageString = "[" + dateString + "] " + "[" + modulename + "] " + "[" + serenity + "] " + message;
    } else if (modulename) {
        messageString = "[" + dateString + "] " + "[" + modulename + "] " + message;
    } else if (serenity) {
        messageString = "[" + dateString + "] " + "[" + serenity + "] " + message;
    } else {
        messageString = "[" + dateString + "] " + message;
    }
    console.log(messageString);
    if (core.dcbot.logChannel) {
        core.dcbot.logChannel.send(messageString);
    }
    fs.appendFileSync("logs/log.txt", messageString + "\n");
}
