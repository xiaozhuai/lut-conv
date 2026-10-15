import assert from 'node:assert/strict';
import test from 'node:test';
import {LutConv, LutData} from '../dist/lut-conv.mjs';

function assertVectorClose(actual, expected, epsilon = 1e-6) {
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < actual.length; i++) {
        assert.ok(
            Math.abs(actual[i] - expected[i]) <= epsilon,
            `component ${i}: expected ${expected[i]}, got ${actual[i]}`,
        );
    }
}

function createIdentityLut(size) {
    const lut = new LutData(size, size, size);
    for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                lut.set(x, y, z, new Float32Array([
                    x / (size - 1),
                    y / (size - 1),
                    z / (size - 1),
                ]));
            }
        }
    }
    return lut;
}

test('LUT accessors reject invalid coordinates and incomplete values', () => {
    const lut = new LutData(2, 2, 2);

    for (const coordinates of [[2, 0, 0], [-1, 0, 0], [0.5, 0, 0], [0, 2, 0], [0, 0, 2]]) {
        assert.throws(() => lut.get(...coordinates), /Invalid LUT coordinates/);
        assert.throws(
            () => lut.set(...coordinates, new Float32Array([1, 2, 3])),
            /Invalid LUT coordinates/,
        );
    }
    assert.throws(
        () => lut.set(0, 0, 0, new Float32Array([1, 2])),
        /LUT value must contain three components/,
    );
});

test('LUT construction and resizing require valid dimensions', () => {
    for (const dimensions of [[0, 1, 1], [-1, 1, 1], [1.5, 1, 1], [NaN, 1, 1]]) {
        assert.throws(() => new LutData(...dimensions), /LUT dimensions must be positive integers/);
    }
    assert.throws(
        () => new LutData(9007199254740991, 1, 1),
        /LUT size is too large/,
    );

    const lut = new LutData(1, 1, 1);
    assert.throws(() => lut.resize(0, 1, 1, 'linear'), /LUT dimensions must be positive integers/);
    assert.throws(() => lut.resize(1.5, 1, 1, 'linear'), /LUT dimensions must be positive integers/);
});

test('linear lookup clamps coordinates to the LUT boundary', () => {
    const lut = createIdentityLut(2);

    assertVectorClose(lut.lookupLinear(0, 0, 0), [0, 0, 0]);
    assertVectorClose(lut.lookupLinear(1, 1, 1), [1, 1, 1]);
});

test('lookups use endpoint coordinates for cube LUT samples', () => {
    const linearLut = createIdentityLut(2);
    assertVectorClose(linearLut.lookupLinear(0.25, 0.5, 0.75), [0.25, 0.5, 0.75]);

    const nearestLut = createIdentityLut(3);
    assertVectorClose(nearestLut.lookupNearest(0.3, 0.5, 0.7), [0.5, 0.5, 0.5]);
});

test('linear resize preserves an identity LUT across sizes', () => {
    const resized = createIdentityLut(2).resize(4, 4, 4, 'linear');

    for (let z = 0; z < 4; z++) {
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                assertVectorClose(resized.get(x, y, z), [x / 3, y / 3, z / 3]);
            }
        }
    }
});

test('cube parser accepts standard whitespace and signed exponents', () => {
    const lut = LutConv.loadCubeStr('LUT_3D_SIZE\t1\n+1e+0\t  .25   -2E-1\n');

    assertVectorClose(lut.data, [1, 0.25, -0.2]);
});

test('cube parser rejects a file without data instead of scanning forever', () => {
    assert.throws(
        () => LutConv.loadCubeStr('LUT_3D_SIZE 2\n# no data\n'),
        /Error parsing cube data/,
    );
});

test('cube parser requires exactly size cubed data rows', () => {
    assert.throws(
        () => LutConv.loadCubeStr('LUT_3D_SIZE 2\n0 0 0\n'),
        /Invalid cube data length: expected 8, got 1/,
    );
    assert.throws(
        () => LutConv.loadCubeStr('LUT_3D_SIZE 1\n0 0 0\n1 1 1\n'),
        /Invalid cube data length: expected 1, got 2/,
    );
});

test('cube parser rejects an invalid row instead of producing NaN', () => {
    const rows = [
        '0 0 0',
        '1 0 0',
        'invalid data',
        '1 1 0',
        '0 0 1',
        '1 0 1',
        '0 1 1',
        '1 1 1',
    ];

    assert.throws(
        () => LutConv.loadCubeStr('LUT_3D_SIZE 2\n' + rows.join('\n') + '\n'),
        /Invalid cube data at line 4/,
    );
    assert.throws(
        () => LutConv.loadCubeStr('LUT_3D_SIZE 1\n1e999 0 0\n'),
        /Invalid cube data at line 2/,
    );
});

test('cube parser ignores blank and comment lines between values', () => {
    const lut = LutConv.loadCubeStr('LUT_3D_SIZE 1\n\n# sample\n0 0 0\n');

    assertVectorClose(lut.data, [0, 0, 0]);
});

test('LUT image conversion rejects a grid with too few tiles', () => {
    const info = {
        imageWidth: 2,
        imageHeight: 2,
        width: 2,
        height: 2,
        depth: 2,
    };

    assert.throws(
        () => LutConv.loadLutImageData(new Uint8ClampedArray(16), info),
        /Image does not have enough tiles for LUT depth/,
    );
    assert.throws(
        () => LutConv.saveLutImageData(new LutData(2, 2, 2), info),
        /Image does not have enough tiles for LUT depth/,
    );
});

test('LUT image loading validates the RGBA buffer length', () => {
    const info = {
        imageWidth: 2,
        imageHeight: 2,
        width: 2,
        height: 2,
        depth: 1,
    };

    assert.throws(
        () => LutConv.loadLutImageData(new Uint8ClampedArray(4), info),
        /Invalid image data length/,
    );
    assert.throws(
        () => LutConv.loadLutImageData(new Uint8ClampedArray(), {...info, width: 0}),
        /Image and LUT sizes must be positive integers/,
    );
});

test('LUT image data round-trips through a valid tile grid', () => {
    const lut = new LutData(2, 2, 2);
    for (let i = 0; i < lut.data.length; i++) {
        lut.data[i] = i / 255;
    }
    const info = {
        imageWidth: 4,
        imageHeight: 2,
        width: 2,
        height: 2,
        depth: 2,
    };

    const imageData = LutConv.saveLutImageData(lut, info);
    for (let i = 3; i < imageData.length; i += 4) {
        assert.equal(imageData[i], 255);
    }
    const loaded = LutConv.loadLutImageData(imageData, info);
    assertVectorClose(loaded.data, lut.data);
});
