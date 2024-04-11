const {LutConv} = require('../.');
const fsp = require('fs').promises;
const pth = require('path');
const {loadImage, createCanvas, createImageData} = require('canvas');

const LutUtils = {
    async readCube(file) {
        const cubeStr = await fsp.readFile(file, 'utf-8');
        return LutConv.loadCubeStr(cubeStr);
    },

    async writeCube(file, lut) {
        const cubeStr = LutConv.saveCubeStr(lut, `TITLE "Created by lut-conv"`);
        await fsp.writeFile(file, cubeStr);
    },

    async readImage(file, lutWidth, lutHeight, lutDepth) {
        const image = await loadImage(file);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, image.width, image.height).data;
        const lutImageInfo = {
            imageWidth: image.width,
            imageHeight: image.height,
            width: lutWidth,
            height: lutHeight,
            depth: lutDepth,
        };
        return LutConv.loadLutImageData(imageData, lutImageInfo);
    },

    async writeImage(file, lut, imageWidth, imageHeight) {
        const lutImageInfo = {
            imageWidth,
            imageHeight,
            width: lut.width,
            height: lut.height,
            depth: lut.depth,
        };
        const canvas = createCanvas(imageWidth, imageHeight);
        const ctx = canvas.getContext('2d');
        const imageData = LutConv.saveLutImageData(lut, lutImageInfo);
        ctx.putImageData(createImageData(imageData, imageWidth, imageHeight), 0, 0);
        await fsp.writeFile(file, canvas.toBuffer());
    },
};

async function testCube() {
    const lut = await LutUtils.readCube(pth.join(__dirname, 'test.cube'));
    await LutUtils.writeCube(pth.join(__dirname, 'out', 'test_new.cube'), lut);
}

async function testLutImage() {
    const lut = await LutUtils.readImage(pth.join(__dirname, 'test2.png'), 16, 16, 16);
    await LutUtils.writeImage(pth.join(__dirname, 'out', 'test2_new.png'), lut, 64, 64);
}

async function testCubeToLut() {
    const lut = await LutUtils.readCube(pth.join(__dirname, 'test.cube'));
    const newLut = lut.resize(64, 64, 64, 'linear');
    await LutUtils.writeImage(pth.join(__dirname, 'out', 'test.png'), newLut, 512, 512);
}

async function testLutToCube() {
    const lut = await LutUtils.readImage(pth.join(__dirname, 'test2.png'), 16, 16, 16);
    await LutUtils.writeCube(pth.join(__dirname, 'out', 'test2.cube'), lut);
}

async function testLutToCubeToLut() {
    const lut = await LutUtils.readCube(pth.join(__dirname, 'out', 'test2.cube'));
    await LutUtils.writeImage(pth.join(__dirname, 'out', 'test2_new_2.png'), lut, 64, 64);
}

async function main() {
    await fsp.mkdir(pth.join(__dirname, 'out'), {recursive: true});

    await testCube();
    await testLutImage();
    await testCubeToLut();
    await testLutToCube();
    await testLutToCubeToLut();
}

main().then();
