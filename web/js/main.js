/**
 * @param accept {string|string[]}
 * @returns {Promise<File>}
 */
function chooseFile(accept = null) {
    let lock = false;
    return new Promise((resolve, reject) => {
        const el = document.createElement('input');
        el.style.display = 'none';
        el.setAttribute('type', 'file');
        if (accept && accept.length > 0) {
            if (typeof accept === 'string') {
                el.setAttribute('accept', accept);
            } else if (Array.isArray(accept)) {
                el.setAttribute('accept', accept.join(','));
            } else {
                throw new Error('Invalid accept type');
            }
        }
        el.addEventListener('change', () => {
            lock = true;
            const file = el.files[0];
            resolve(file);
        }, {once: true});
        window.addEventListener('focus', () => {
            setTimeout(() => {
                if (!lock) {
                    reject(new Error('cancel'));
                }
            }, 1000);
        }, {once: true});
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
    downloadUrl(blobToUrl(blob), filename);
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
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.readAsBinaryString(file);
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
 * @param file {File}
 * @returns {Promise<Image>}
 */
async function loadImageFromFile(file) {
    return await loadImage(fileToUrl(file));
}

function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}


const App = {
    template: `
<div id="app">
    <el-form class="form" label-width="80px">
        <el-form-item label="File">
            <el-input :value="inputFileName" readonly placeholder="Choose a cube file or lut image">
                <template slot="append">
                    <el-button icon="el-icon-document" @click="chooseInputFile"/>
                </template>
            </el-input>
        </el-form-item>
        <template v-if="inputFile">
            <el-form-item label="Type">
                <el-radio-group :value="inputType">
                    <el-radio label="cube">Cube</el-radio>
                    <el-radio label="image">Image</el-radio>
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
                <el-input class="lut-size-input" :value="inputLutInfo.width" readonly/>
                <el-input class="lut-size-input" :value="inputLutInfo.height" readonly/>
                <el-input class="lut-size-input" :value="inputLutInfo.depth" readonly/>
            </el-form-item>
        </template>
        
        <template v-if="inputParsed">
        
            <el-divider></el-divider>
        
            <el-form-item label="Type">
                <el-radio-group v-model="outputType">
                    <el-radio label="cube">Cube</el-radio>
                    <el-radio label="image">Image</el-radio>
                </el-radio-group>
            </el-form-item>
            
            <el-form-item label="Mode">
                <el-radio-group v-model="resizeMode">
                    <el-radio label="nearest">nearest</el-radio>
                    <el-radio label="linear">linear</el-radio>
                </el-radio-group>
            </el-form-item>
            
            <el-form-item label="Size">
                <el-input class="lut-size-input" v-model="outputLutInfo.width"/>
                <el-input class="lut-size-input" v-model="outputLutInfo.height"/>
                <el-input class="lut-size-input" v-model="outputLutInfo.depth"/>
            </el-form-item>
            
            <el-form-item>
                <el-button type="primary" @click="generateOutput" 
                    :icon="generating ? 'el-icon-loading' : ''"
                    :disabled="generating">Convert</el-button>
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
    data() {
        return {
            inputFileName: '',
            inputFile: null,
            inputType: '',
            inputImageUrl: '',
            inputParsed: false,
            inputLut: null,
            inputLutInfo: {
                width: 0,
                height: 0,
                depth: 0,
            },
            //
            outputGenerated: false,
            outputType: 'cube',
            resizeMode: 'linear',
            outputLut: null,
            outputLutInfo: {
                width: 0,
                height: 0,
                depth: 0,
            },
            outputImageUrl: '',
            outputCubeUrl: '',
            generating: false,
        };
    },
    methods: {
        clearOutput() {
            this.outputGenerated = false;
            this.outputImageUrl = '';
            this.outputCubeUrl = '';
            this.outputLut = null;
        },

        async onGotInputFile() {
            if (this.inputType === 'cube') {
                try {
                    const cubeStr = await readTextFromFile(this.inputFile);
                    this.inputImageUrl = '';
                    this.inputLut = LutConv.LutConv.loadCubeStr(cubeStr);
                    this.inputLutInfo = {
                        width: this.inputLut.width,
                        height: this.inputLut.height,
                        depth: this.inputLut.depth,
                    };
                    this.outputLutInfo = {...this.inputLutInfo};
                    this.clearOutput();
                    this.inputParsed = true;
                } catch (e) {
                    Vue.prototype.$message.error(e.message);
                }
            } else if (this.inputType === 'image') {
                try {
                    this.inputImageUrl = fileToUrl(this.inputFile);
                    const image = await loadImageFromFile(this.inputFile);
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

                    this.inputLut = LutConv.LutConv.loadLutImageData(imageData, lutImageInfo);
                    this.inputLutInfo = {
                        width: this.inputLut.width,
                        height: this.inputLut.height,
                        depth: this.inputLut.depth,
                    };
                    this.outputLutInfo = {...this.inputLutInfo};
                    this.clearOutput();
                    this.inputParsed = true;
                } catch (e) {
                    Vue.prototype.$message.error(e.message);
                }
            }
        },

        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        async generateOutput() {
            this.generating = true;
            this.clearOutput();
            await this.wait(50);

            try {
                this.outputLutInfo.width = parseInt(this.outputLutInfo.width);
                this.outputLutInfo.height = parseInt(this.outputLutInfo.height);
                this.outputLutInfo.depth = parseInt(this.outputLutInfo.depth);
                let lut = this.inputLut;
                if (this.outputLutInfo.width !== this.inputLut.width ||
                    this.outputLutInfo.height !== this.inputLut.height ||
                    this.outputLutInfo.depth !== this.inputLut.depth) {
                    lut = lut.resize(this.outputLutInfo.width, this.outputLutInfo.height, this.outputLutInfo.depth, this.resizeMode);
                }
                this.outputLut = lut;
            } catch (e) {
                Vue.prototype.$message.error(e.message);
            }

            if (this.outputType === 'cube') {
                try{
                    const cubeStr = LutConv.LutConv.saveCubeStr(this.outputLut, `TITLE "Created by lut-conv"`);
                    this.outputCubeUrl = blobToUrl(new Blob([cubeStr], {type: 'text/plain'}));
                    this.outputGenerated = true;
                } catch (e) {
                    Vue.prototype.$message.error(e.message);
                }
            } else if (this.outputType === 'image') {
                try {
                    let imageSize;
                    if (this.outputLutInfo.width === 64 && this.outputLutInfo.height === 64 && this.outputLutInfo.depth === 64) {
                        imageSize = 512;
                    } else if (this.outputLutInfo.width === 16 && this.outputLutInfo.height === 16 && this.outputLutInfo.depth === 16) {
                        imageSize = 64;
                    } else {
                        throw new Error('Invalid lut size, image format lut only support 16x16x16 or 64x64x64');
                    }
                    const canvas = createCanvas(imageSize, imageSize);
                    const ctx = canvas.getContext('2d');
                    const imageData = LutConv.LutConv.saveLutImageData(this.outputLut, {
                        imageWidth: imageSize,
                        imageHeight: imageSize,
                        width: this.outputLutInfo.width,
                        height: this.outputLutInfo.height,
                        depth: this.outputLutInfo.depth,
                    });
                    ctx.putImageData(new ImageData(imageData, imageSize, imageSize), 0, 0);
                    this.outputImageUrl = canvas.toDataURL();
                    this.outputGenerated = true;
                } catch (e) {
                    Vue.prototype.$message.error(e.message);
                }
            }
            this.generating = false;
        },

        downloadLutImage() {
            downloadUrl(this.outputImageUrl, this.inputFileName.substring(0, this.inputFileName.lastIndexOf('.')) + '.png');
        },

        downloadCube() {
            downloadUrl(this.outputCubeUrl, this.inputFileName.substring(0, this.inputFileName.lastIndexOf('.')) + '.cube');
        },

        async chooseInputFile() {
            try {
                const file = await chooseFile(['.cube', 'image/*']);
                this.inputFileName = file.name;
                this.inputFile = file;
                this.inputType = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase() === 'cube' ? 'cube' : 'image';
                this.inputParsed = false;
                this.inputLut = null;
                await this.onGotInputFile();
            } catch (e) {
            }
        }
    }
};

new Vue({
    render: h => h(App),
}).$mount('#app');
