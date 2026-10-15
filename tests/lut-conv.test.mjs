import assert from 'node:assert/strict';
import test from 'node:test';
import {LutData} from '../dist/lut-conv.mjs';

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
