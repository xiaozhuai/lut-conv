type LutConvFilterMode = 'nearest' | 'linear';
declare class LutData {
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
    constructor(width: number, height: number, depth: number, data?: Float32Array | null);
    /**
     * Get the value at the specified index
     * @param x Range [0, width)
     * @param y Range [0, height)
     * @param z Range [0, depth)
     */
    get(x: number, y: number, z: number): Float32Array;
    /**
     * Set the value at the specified index
     * @param x Range [0, width)
     * @param y Range [0, height)
     * @param z Range [0, depth)
     * @param value
     */
    set(x: number, y: number, z: number, value: Float32Array): void;
    /**
     * Lookup value
     * @param r Range [0, 1]
     * @param g Range [0, 1]
     * @param b Range [0, 1]
     * @param mode Filter mode
     */
    lookup(r: number, g: number, b: number, mode: LutConvFilterMode): Float32Array;
    /**
     * Lookup value
     * @param r Range [0, 1]
     * @param g Range [0, 1]
     * @param b Range [0, 1]
     */
    lookupNearest(r: number, g: number, b: number): Float32Array;
    /**
     * Lookup value
     * @param r Range [0, 1]
     * @param g Range [0, 1]
     * @param b Range [0, 1]
     */
    lookupLinear(r: number, g: number, b: number): Float32Array;
    resize(width: number, height: number, depth: number, mode: LutConvFilterMode): LutData;
}
interface LutConvImageInfo {
    imageWidth: number;
    imageHeight: number;
    width: number;
    height: number;
    depth: number;
}
declare class LutConv {
    static loadCubeStr(cubeStr: string): LutData;
    static saveCubeStr(lut: LutData, headers?: string): string;
    static loadLutImageData(imageData: Uint8ClampedArray, lutImageInfo: LutConvImageInfo): LutData;
    static saveLutImageData(lut: LutData, lutImageInfo: LutConvImageInfo): Uint8ClampedArray;
}

export { LutConv, LutData };
