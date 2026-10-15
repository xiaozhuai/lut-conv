type LutConvFilterMode = 'nearest' | 'linear';

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
}

function isFiniteNumber(value: number): boolean {
    return typeof value === 'number' && isFinite(value);
}

function isSafeInteger(value: number): boolean {
    return isFiniteNumber(value) && Math.floor(value) === value && Math.abs(value) <= 9007199254740991;
}

function getLutDataIndex(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
): number {
    if (![x, y, z].every(isSafeInteger) ||
        x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
        throw new Error("Invalid LUT coordinates");
    }
    return (z * width * height + y * width + x) * 3;
}

export class LutData {
    width: number;
    height: number;
    depth: number;
    data: Float32Array;

    /**
     * Create a new LutData
     * @param width
     * @param height
     * @param depth
     * @param data Initial data, null means create a new data array
     */
    constructor(width: number, height: number, depth: number, data: Float32Array | null = null) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        if (data === null) {
            this.data = new Float32Array(width * height * depth * 3);
        } else {
            if (data.length !== width * height * depth * 3) {
                throw new Error("Invalid data length");
            }
            this.data = data;
        }
    }

    /**
     * Get the value at the specified index
     * @param x Range [0, width)
     * @param y Range [0, height)
     * @param z Range [0, depth)
     */
    get(x: number, y: number, z: number): Float32Array {
        const i = getLutDataIndex(x, y, z, this.width, this.height, this.depth);
        return this.data.subarray(i, i + 3);
    }

    /**
     * Set the value at the specified index
     * @param x Range [0, width)
     * @param y Range [0, height)
     * @param z Range [0, depth)
     * @param value
     */
    set(x: number, y: number, z: number, value: Float32Array): void {
        if (value.length < 3) {
            throw new Error("LUT value must contain three components");
        }
        const i = getLutDataIndex(x, y, z, this.width, this.height, this.depth);
        this.data[i] = value[0];
        this.data[i + 1] = value[1];
        this.data[i + 2] = value[2];
    }

    /**
     * Lookup value
     * @param r Range [0, 1]
     * @param g Range [0, 1]
     * @param b Range [0, 1]
     * @param mode Filter mode
     */
    lookup(r: number, g: number, b: number, mode: LutConvFilterMode): Float32Array {
        switch (mode) {
            case 'nearest':
                return this.lookupNearest(r, g, b);
            case 'linear':
                return this.lookupLinear(r, g, b);
            default:
                throw new Error("Invalid filter mode");
        }
    }

    /**
     * Lookup value
     * @param r Range [0, 1]
     * @param g Range [0, 1]
     * @param b Range [0, 1]
     */
    lookupNearest(r: number, g: number, b: number): Float32Array {
        const fx = clamp(r, 0, 1) * (this.width - 1);
        const fy = clamp(g, 0, 1) * (this.height - 1);
        const fz = clamp(b, 0, 1) * (this.depth - 1);
        const x = clamp(Math.round(fx), 0, this.width - 1);
        const y = clamp(Math.round(fy), 0, this.height - 1);
        const z = clamp(Math.round(fz), 0, this.depth - 1);
        return this.get(x, y, z);
    }

    /**
     * Lookup value
     * @param r Range [0, 1]
     * @param g Range [0, 1]
     * @param b Range [0, 1]
     */
    lookupLinear(r: number, g: number, b: number): Float32Array {
        const fx = clamp(r, 0, 1) * (this.width - 1);
        const fy = clamp(g, 0, 1) * (this.height - 1);
        const fz = clamp(b, 0, 1) * (this.depth - 1);

        const x0 = clamp(Math.floor(fx), 0, this.width - 1);
        const y0 = clamp(Math.floor(fy), 0, this.height - 1);
        const z0 = clamp(Math.floor(fz), 0, this.depth - 1);
        const x1 = clamp(x0 + 1, 0, this.width - 1);
        const y1 = clamp(y0 + 1, 0, this.height - 1);
        const z1 = clamp(z0 + 1, 0, this.depth - 1);

        const v000 = this.get(x0, y0, z0);
        const v001 = this.get(x0, y0, z1);
        const v010 = this.get(x0, y1, z0);
        const v011 = this.get(x0, y1, z1);
        const v100 = this.get(x1, y0, z0);
        const v101 = this.get(x1, y0, z1);
        const v110 = this.get(x1, y1, z0);
        const v111 = this.get(x1, y1, z1);

        const dx = fx - x0;
        const dy = fy - y0;
        const dz = fz - z0;

        return (new Float32Array(3)).map((_, i) => lerp(
            lerp(
                lerp(v000[i], v100[i], dx),
                lerp(v010[i], v110[i], dx),
                dy
            ),
            lerp(
                lerp(v001[i], v101[i], dx),
                lerp(v011[i], v111[i], dx),
                dy
            ),
            dz
        ));
    }

    resize(width: number, height: number, depth: number, mode: LutConvFilterMode): LutData {
        let newLut = new LutData(width, height, depth);
        for (let z = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let r = width === 1 ? 0 : x / (width - 1);
                    let g = height === 1 ? 0 : y / (height - 1);
                    let b = depth === 1 ? 0 : z / (depth - 1);
                    newLut.set(x, y, z, this.lookup(r, g, b, mode));
                }
            }
        }
        return newLut;
    }
}

interface LutConvImageInfo {
    imageWidth: number;
    imageHeight: number;

    width: number;
    height: number;
    depth: number;
}

function getLutImageGrid(lutImageInfo: LutConvImageInfo): {gWidth: number; gHeight: number} {
    const {imageWidth, imageHeight, width, height, depth} = lutImageInfo;
    if (![imageWidth, imageHeight, width, height, depth].every(value => isSafeInteger(value) && value > 0)) {
        throw new Error("Image and LUT sizes must be positive integers");
    }
    if (imageWidth % width !== 0 || imageHeight % height !== 0) {
        throw new Error("Invalid image size");
    }

    const gWidth = imageWidth / width;
    const gHeight = imageHeight / height;
    if (gWidth * gHeight < depth) {
        throw new Error("Image does not have enough tiles for LUT depth");
    }
    return {gWidth, gHeight};
}

export class LutConv {
    public static loadCubeStr(cubeStr: string): LutData {
        const NUMBER_PATTERN = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[Ee][+-]?\\d+)?';
        const REGEX_SIZE = /^\s*LUT_3D_SIZE\s+(\d+)\s*$/m;
        const REGEX_VALUE = new RegExp(
            '^\\s*(' + NUMBER_PATTERN + ')\\s+(' + NUMBER_PATTERN + ')\\s+(' + NUMBER_PATTERN + ')\\s*$'
        );

        const resultSize = REGEX_SIZE.exec(cubeStr);
        if (!resultSize || resultSize.length < 2) {
            throw new Error("Error parsing cube");
        }
        const size = parseInt(resultSize[1]);
        const lines = cubeStr.replace(/\r/g, '').split('\n');
        let index = 0;
        while (index < lines.length && !REGEX_VALUE.test(lines[index])) {
            index++;
        }
        if (index === lines.length) {
            throw new Error("Error parsing cube data");
        }

        const values = lines.slice(index)
            .map((line, offset) => ({line, lineNumber: index + offset + 1}))
            .filter(({line}) => {
                const trimmedLine = line.trim();
                return trimmedLine !== '' && trimmedLine.charAt(0) !== '#';
            })
            .map(({line, lineNumber}) => {
                const result = REGEX_VALUE.exec(line);
                if (!result) {
                    throw new Error("Invalid cube data at line " + lineNumber);
                }
                const value = [Number(result[1]), Number(result[2]), Number(result[3])];
                if (!value.every(isFiniteNumber)) {
                    throw new Error("Invalid cube data at line " + lineNumber);
                }
                return value;
            });
        const expectedValueCount = size * size * size;
        if (values.length !== expectedValueCount) {
            throw new Error(
                "Invalid cube data length: expected " + expectedValueCount + ", got " + values.length
            );
        }

        let data = new Float32Array(expectedValueCount * 3);
        values.forEach((value, i) => {
            data[i * 3] = value[0];
            data[i * 3 + 1] = value[1];
            data[i * 3 + 2] = value[2];
        });
        return new LutData(size, size, size, data);
    }

    public static saveCubeStr(lut: LutData, headers: string = ''): string {
        if (lut.width !== lut.height || lut.width !== lut.depth) {
            throw new Error("Invalid lut size");
        }
        let cubeStr = `${headers.trim()}\nLUT_3D_SIZE ${lut.width}\n\n`;
        for (let z = 0; z < lut.depth; z++) {
            for (let y = 0; y < lut.height; y++) {
                for (let x = 0; x < lut.width; x++) {
                    let v = lut.get(x, y, z);
                    cubeStr += `${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}\n`;
                }
            }
        }
        return cubeStr;
    }

    public static loadLutImageData(imageData: Uint8ClampedArray, lutImageInfo: LutConvImageInfo) {
        const {imageWidth, imageHeight, width, height, depth} = lutImageInfo;
        const {gWidth} = getLutImageGrid(lutImageInfo);
        const expectedImageDataLength = imageWidth * imageHeight * 4;
        if (!isSafeInteger(expectedImageDataLength) || imageData.length !== expectedImageDataLength) {
            throw new Error("Invalid image data length");
        }

        let lut = new LutData(width, height, depth);
        for (let z = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const gx = z % gWidth;
                    const gy = Math.floor(z / gWidth);
                    const px = x + gx * width;
                    const py = y + gy * height;
                    const i = (py * imageWidth + px) * 4;
                    lut.set(x, y, z, new Float32Array([
                        imageData[i] / 255.0,
                        imageData[i + 1] / 255.0,
                        imageData[i + 2] / 255.0,
                    ]));
                }
            }
        }
        return lut;
    }

    public static saveLutImageData(lut: LutData, lutImageInfo: LutConvImageInfo): Uint8ClampedArray {
        const {imageWidth, imageHeight, width, height, depth} = lutImageInfo;
        const {gWidth} = getLutImageGrid(lutImageInfo);
        if (lut.width !== width || lut.height !== height || lut.depth !== depth) {
            throw new Error("Invalid lut size");
        }

        let imageData = new Uint8ClampedArray(imageWidth * imageHeight * 4);
        for (let z = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const gx = z % gWidth;
                    const gy = Math.floor(z / gWidth);
                    const px = x + gx * width;
                    const py = y + gy * height;
                    const i = (py * imageWidth + px) * 4;
                    const v = lut.get(x, y, z);
                    imageData[i] = clamp(Math.round(v[0] * 255), 0, 255);
                    imageData[i + 1] = clamp(Math.round(v[1] * 255), 0, 255);
                    imageData[i + 2] = clamp(Math.round(v[2] * 255), 0, 255);
                    imageData[i + 3] = 255;
                }
            }
        }
        return imageData;
    }
}
