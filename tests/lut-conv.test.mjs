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
