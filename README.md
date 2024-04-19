# lut-conv

A js library for converting and resizing lookup table (lut), supporting image and cube formats

[![Build](https://github.com/xiaozhuai/lut-conv/actions/workflows/build.yml/badge.svg)](https://github.com/xiaozhuai/lut-conv/actions/workflows/build.yml)

[![NPM Download Stats](https://nodei.co/npm/lut-conv.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/lut-conv)

## Usage

### ES6

```js
import { LutConv } from 'lut-conv';
```

### CommonJS

```js
const { LutConv } = require('lut-conv');
```

### Browser

```html
<script type="text/javascript" src="lut-conv.global.js"></script>
```

## Load cube

```js

const cubeStr = ''; // cube file content
let lut = LutConv.loadCubeStr(cubeStr);
```

## Load image

```js
const image = await loadImage(file);
const canvas = createCanvas(image.width, image.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(image, 0, 0);

const imageData = ctx.getImageData(0, 0, image.width, image.height).data;
const lutImageInfo = {
    imageWidth: image.width,
    imageHeight: image.height,
    // You must specify the width, height and depth
    width: 16,
    height: 16,
    depth: 16,
};
let lut = LutConv.loadLutImageData(imageData, lutImageInfo);
```

## Save lut as cube

```js
// Suppose you have a lut
// const lut = ...; 
const cubeStr = LutConv.saveCubeStr(lut, `TITLE "Created by lut-conv"`);
```

## Save lut as image

```js
// Suppose you have a lut
// const lut = ...;
const lutImageInfo = {
    // You must specify the image width and height
    imageWidth: 64,
    imageHeight: 64,
    width: lut.width,
    height: lut.height,
    depth: lut.depth,
};
const canvas = createCanvas(imageWidth, imageHeight);
const ctx = canvas.getContext('2d');
const imageData = LutConv.saveLutImageData(lut, lutImageInfo);
ctx.putImageData(ctx.createImageData(imageData, imageWidth, imageHeight), 0, 0);
// Now you can get the image from the canvas
```

## Resize lut

```js
// Suppose you have a lut
// const lut = ...;
const newLut = lut.resize(64, 64, 64, 'linear'); // or 'nearest'
```
