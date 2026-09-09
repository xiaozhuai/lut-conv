import {createApp, onBeforeUnmount, reactive, ref, shallowRef} from 'vue';
import ElementPlus, {ElMessage} from 'element-plus';
import {Document} from '@element-plus/icons-vue';
import {LutConv} from 'lut-conv';

/**
 * @param accept {string|string[]}
 * @returns {Promise<File>}
 */
function chooseFile(accept = null) {
    return new Promise((resolve, reject) => {
        const el = document.createElement('input');
        el.style.display = 'none';
        el.type = 'file';

        if (accept && accept.length > 0) {
            if (typeof accept === 'string') {
                el.accept = accept;
            } else if (Array.isArray(accept)) {
                el.accept = accept.join(',');
            } else {
                throw new Error('Invalid accept type');
            }
        }

        let settled = false;
        const finish = (callback) => {
            if (settled) return;
            settled = true;
            el.remove();
            callback();
        };

        el.addEventListener('change', () => {
            const file = el.files?.[0];
            if (file) {
                finish(() => resolve(file));
            } else {
                finish(() => reject(new Error('cancel')));
            }
        }, {once: true});

        // Supported by modern browsers. The focus handler below is a fallback.
        el.addEventListener('cancel', () => {
            finish(() => reject(new Error('cancel')));
        }, {once: true});

        window.addEventListener('focus', () => {
            setTimeout(() => {
                if (!settled && !el.files?.length) {
                    finish(() => reject(new Error('cancel')));
                }
            }, 300);
        }, {once: true});

        document.body.appendChild(el);
        el.click();
    });
}

/**
 * @param blob {Blob}
 * @returns {string}
 */
function blobToUrl(blob) {
    return URL.createObjectURL(blob);
}

function revokeObjectUrl(url) {
    if (url?.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}

/**
 * @param file {File}
 * @returns {Blob}
 */
function fileToBlob(file) {
    return new Blob([file], {type: file.type});
}

/**
 * @param file {File}
 * @returns {string}
 */
function fileToUrl(file) {
    return blobToUrl(fileToBlob(file));
}


/**
 * @param url {string}
 * @param filename {string}
 */
function downloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * @param blob {Blob}
 * @param filename {string}
 */
function downloadBlob(blob, filename) {
    const url = blobToUrl(blob);
    downloadUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url));
}

/**
 * @param text {string}
 * @param filename {string}
 * @param type {string}
 */
function downloadText(text, filename, type = 'text/plain') {
    downloadBlob(new Blob([text], {type: type}), filename);
}

/**
 * @param file {File}
 * @returns {Promise<string>}
 */
function readTextFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = () => reject(reader.error ?? new Error(`Error reading ${file.name}`));
        reader.readAsText(file);
    });
}

/**
 * @param url {string}
 * @returns {Promise<Image>}
 */
async function loadImage(url) {
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => {
            reject(new Error(`Error load image ${url}`));
        };
        image.src = url;
    });
    return image;
}

/**
 * @param width {number}
 * @param height {number}
 * @returns {HTMLCanvasElement}
 */
function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}


const App = {
    components: {
        Document,
    },
    template: `
<div>
    <el-form class="form" label-width="80px">
        <el-form-item label="File">
            <el-input :model-value="inputFileName" readonly placeholder="Choose a cube file or lut image">
                <template #append>
                    <el-button aria-label="Choose input file" @click="chooseInputFile">
                        <el-icon><Document /></el-icon>
                    </el-button>
                </template>
            </el-input>
        </el-form-item>
        <template v-if="inputFile">
            <el-form-item label="Type">
                <el-radio-group :model-value="inputType" disabled>
                    <el-radio value="cube">Cube</el-radio>
                    <el-radio value="image">Image</el-radio>
                </el-radio-group>
            </el-form-item>
        </template>
        
        <template v-if="inputType === 'image'">
            <el-form-item label="Preview">
                <img :src="inputImageUrl" style="max-width: 100%;"/>
            </el-form-item>
        </template>
        
        <template v-if="inputParsed">
            <el-form-item label="Size">
                <el-input class="lut-size-input" :model-value="inputLutInfo.width" readonly/>
                <el-input class="lut-size-input" :model-value="inputLutInfo.height" readonly/>
                <el-input class="lut-size-input" :model-value="inputLutInfo.depth" readonly/>
            </el-form-item>
        </template>
        
        <template v-if="inputParsed">
        
            <el-divider></el-divider>
        
            <el-form-item label="Type">
                <el-radio-group v-model="outputType">
                    <el-radio value="cube">Cube</el-radio>
                    <el-radio value="image">Image</el-radio>
                </el-radio-group>
            </el-form-item>
            
            <el-form-item label="Mode">
                <el-radio-group v-model="resizeMode">
                    <el-radio value="nearest">nearest</el-radio>
                    <el-radio value="linear">linear</el-radio>
                </el-radio-group>
            </el-form-item>
            
            <el-form-item label="Size">
                <el-input class="lut-size-input" v-model="outputLutInfo.width"/>
                <el-input class="lut-size-input" v-model="outputLutInfo.height"/>
                <el-input class="lut-size-input" v-model="outputLutInfo.depth"/>
            </el-form-item>
            
            <el-form-item>
                <el-button type="primary" :loading="generating" @click="generateOutput">
                    Convert
                </el-button>
            </el-form-item>
            
            <template v-if="outputGenerated">
                <el-form-item label="Preview" v-if="outputImageUrl">
                    <img :src="outputImageUrl" style="max-width: 100%;"/>
                </el-form-item>
                <el-form-item v-if="outputImageUrl">
                    <el-button @click="downloadLutImage">Download Lut Image</el-button>
                </el-form-item>
                <el-form-item v-if="outputCubeUrl">
                    <el-button @click="downloadCube">Download Cube</el-button>
                </el-form-item>
            </template>
        
        </template>
    </el-form>
</div>
    `,
    setup() {
        const inputFileName = ref('');
        const inputFile = shallowRef(null);
        const inputType = ref('');
        const inputImageUrl = ref('');
        const inputParsed = ref(false);
        const inputLut = shallowRef(null);
        const inputLutInfo = reactive({
            width: 0,
            height: 0,
            depth: 0,
        });

        const outputGenerated = ref(false);
        const outputType = ref('cube');
        const resizeMode = ref('linear');
        const outputLut = shallowRef(null);
        const outputLutInfo = reactive({
            width: 0,
            height: 0,
            depth: 0,
        });
        const outputImageUrl = ref('');
        const outputCubeUrl = ref('');
        const generating = ref(false);

        const clearOutput = () => {
            outputGenerated.value = false;
            revokeObjectUrl(outputCubeUrl.value);
            outputImageUrl.value = '';
            outputCubeUrl.value = '';
            outputLut.value = null;
        };

        const onGotInputFile = async () => {
            if (inputType.value === 'cube') {
                try {
                    const cubeStr = await readTextFromFile(inputFile.value);
                    revokeObjectUrl(inputImageUrl.value);
                    inputImageUrl.value = '';
                    inputLut.value = LutConv.loadCubeStr(cubeStr);
                    Object.assign(inputLutInfo, {
                        width: inputLut.value.width,
                        height: inputLut.value.height,
                        depth: inputLut.value.depth,
                    });
                    Object.assign(outputLutInfo, inputLutInfo);
                    clearOutput();
                    inputParsed.value = true;
                } catch (e) {
                    ElMessage.error(e instanceof Error ? e.message : String(e));
                }
            } else if (inputType.value === 'image') {
                try {
                    revokeObjectUrl(inputImageUrl.value);
                    inputImageUrl.value = fileToUrl(inputFile.value);
                    const image = await loadImage(inputImageUrl.value);
                    const canvas = createCanvas(image.width, image.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(image, 0, 0);

                    let lutImageInfo = {
                        imageWidth: image.width,
                        imageHeight: image.height,
                        // You must specify the width, height and depth
                        width: 0,
                        height: 0,
                        depth: 0,
                    };
                    if (image.width !== image.height) {
                        throw new Error('Cannot determine lut size, image format lut only support image size 64x64 or 512x512');
                    }
                    if (image.width === 512) {
                        lutImageInfo.width = 64;
                        lutImageInfo.height = 64;
                        lutImageInfo.depth = 64;
                    } else if (image.width === 64) {
                        lutImageInfo.width = 16;
                        lutImageInfo.height = 16;
                        lutImageInfo.depth = 16;
                    } else {
                        throw new Error('Cannot determine lut size, image format lut only support image size 64x64 or 512x512');
                    }
                    const imageData = ctx.getImageData(0, 0, image.width, image.height).data;

                    inputLut.value = LutConv.loadLutImageData(imageData, lutImageInfo);
                    Object.assign(inputLutInfo, {
                        width: inputLut.value.width,
                        height: inputLut.value.height,
                        depth: inputLut.value.depth,
                    });
                    Object.assign(outputLutInfo, inputLutInfo);
                    clearOutput();
                    inputParsed.value = true;
                } catch (e) {
                    ElMessage.error(e instanceof Error ? e.message : String(e));
                }
            }
        };

        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const generateOutput = async () => {
            generating.value = true;
            clearOutput();
            await wait(50);

            try {
                const width = Number.parseInt(outputLutInfo.width, 10);
                const height = Number.parseInt(outputLutInfo.height, 10);
                const depth = Number.parseInt(outputLutInfo.depth, 10);

                if (![width, height, depth].every(Number.isSafeInteger) ||
                    width <= 0 || height <= 0 || depth <= 0) {
                    throw new Error('Lut size must contain positive integers');
                }

                Object.assign(outputLutInfo, {width, height, depth});
                let lut = inputLut.value;
                if (width !== inputLut.value.width ||
                    height !== inputLut.value.height ||
                    depth !== inputLut.value.depth) {
                    lut = lut.resize(width, height, depth, resizeMode.value);
                }
                outputLut.value = lut;

                if (outputType.value === 'cube') {
                    const cubeStr = LutConv.saveCubeStr(outputLut.value, `TITLE "Created by lut-conv"`);
                    outputCubeUrl.value = blobToUrl(new Blob([cubeStr], {type: 'text/plain'}));
                } else if (outputType.value === 'image') {
                    let imageSize;
                    if (width === 64 && height === 64 && depth === 64) {
                        imageSize = 512;
                    } else if (width === 16 && height === 16 && depth === 16) {
                        imageSize = 64;
                    } else {
                        throw new Error('Invalid lut size, image format lut only support 16x16x16 or 64x64x64');
                    }
                    const canvas = createCanvas(imageSize, imageSize);
                    const ctx = canvas.getContext('2d');
                    const imageData = LutConv.saveLutImageData(outputLut.value, {
                        imageWidth: imageSize,
                        imageHeight: imageSize,
                        width,
                        height,
                        depth,
                    });
                    ctx.putImageData(new ImageData(imageData, imageSize, imageSize), 0, 0);
                    outputImageUrl.value = canvas.toDataURL();
                }

                outputGenerated.value = true;
            } catch (e) {
                ElMessage.error(e instanceof Error ? e.message : String(e));
            } finally {
                generating.value = false;
            }
        };

        const outputFilename = (extension) => {
            const dot = inputFileName.value.lastIndexOf('.');
            const basename = dot > 0 ? inputFileName.value.substring(0, dot) : inputFileName.value;
            return `${basename}.${extension}`;
        };

        const downloadLutImage = () => {
            downloadUrl(outputImageUrl.value, outputFilename('png'));
        };

        const downloadCube = () => {
            downloadUrl(outputCubeUrl.value, outputFilename('cube'));
        };

        const chooseInputFile = async () => {
            try {
                const file = await chooseFile(['.cube', 'image/*']);
                inputFileName.value = file.name;
                inputFile.value = file;
                inputType.value = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase() === 'cube'
                    ? 'cube'
                    : 'image';
                inputParsed.value = false;
                inputLut.value = null;
                await onGotInputFile();
            } catch (e) {
                if (!(e instanceof Error) || e.message !== 'cancel') {
                    ElMessage.error(e instanceof Error ? e.message : String(e));
                }
            }
        };

        onBeforeUnmount(() => {
            revokeObjectUrl(inputImageUrl.value);
            revokeObjectUrl(outputCubeUrl.value);
        });

        return {
            inputFileName,
            inputFile,
            inputType,
            inputImageUrl,
            inputParsed,
            inputLut,
            inputLutInfo,
            outputGenerated,
            outputType,
            resizeMode,
            outputLut,
            outputLutInfo,
            outputImageUrl,
            outputCubeUrl,
            generating,
            chooseInputFile,
            generateOutput,
            downloadLutImage,
            downloadCube,
        };
    }
};

const app = createApp(App);
app.use(ElementPlus);
app.mount('#app');
