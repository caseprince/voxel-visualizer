import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as Stats from 'stats.js'
import * as dat from 'dat.gui';
import * as UPNG from 'upng-js';
// const UPNG = require('./UPNG.js') as any;
import { saveAs } from 'file-saver';

const progressBar = document.getElementById('progressBar') as HTMLElement

let then = new Date().getTime();
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 5, 6500);
camera.position.set(0, 700, 3000)

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.autoRotate = true;

const numFormat = Intl.NumberFormat('en-US');
const info = document.getElementById('info') as HTMLElement;

/*
 * CONFIG
 */
const src2 = true;
let spritesSrc: string | null = null;
// _ps8bit versions are saved with PhotoShop for 8bit 'depth' / color indexes.
// UPNG and ImageMagick generate PNGs with `depth: 4`, which would require some bitwise stuff to parse.
// PhotoShop also achieves the smallest filesize.
// TODO: Try GIFs?
const spritesSrc200 = 'sprite-sheets/6cm_italianPaper_pavone_sprites200_ps8bit.png';
const spritesSrc380 = 'sprite-sheets/6cm_italianPaper_pavone_sprites380_ps8bit.png';
// spritesSrc = 'sprite-sheets/6cm_italianPaper_pavone_frames200.png'; // Animated PNGs not easy to parse, and mysteriously seem a tad larger!
spritesSrc = spritesSrc200;

const volume = 1000; // TODO: 3D bounding box derived from .gcvf XML
const volumeZ = 950;
const imgHeight = 827;
const imgWidth = src2 ? 827 : 1664;
const imgAspectRatio = src2 ? 1 : 2;
const sourceLayers = 2409;
const VERO_CLEAR_ALPHA = 0.05;

var bufferGeometry = new THREE.BufferGeometry();
var positions: any[] = [];
var colors: any[] = [];
var positions32 = new Float32Array(20000000);
var colors32 = new Float32Array(20000000);
let pointsMaterial: THREE.PointsMaterial;
let points: THREE.Points;
var alphas: any[] = [];

const populateParticles = () => {

    bufferGeometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
    if (state.useTypedArrays) {
        console.log("Using useTypedArrays with length " + positions32.length);
        bufferGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions32, 3));
        bufferGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors32, 3));
    } else {
        bufferGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        bufferGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }

    if (state.transparency) {

        const uniforms = {
            // color: { value: new THREE.Color(0xffffff) },
            size: { value: 10 }
        };

        // gl_PointSize = size * ( 300.0 / -mvPosition.z );
        //
        const vertexShader = `
            attribute float alpha;
            varying float vAlpha;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vAlpha = alpha;
                vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
                gl_PointSize = 5.0;
                gl_Position = projectionMatrix * mvPosition;
            }

        `
        const fragmentShader = `
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
                gl_FragColor = vec4( vColor, vAlpha );
            }
        `
        // point cloud material
        var shaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            // depthWrite: false,
            vertexColors: true
        });
        points = new THREE.Points(bufferGeometry, shaderMaterial);

    } else {
        pointsMaterial = new THREE.PointsMaterial({
            size: 4.2 * state.chunkSize,
            vertexColors: true,
        });
        points = new THREE.Points(bufferGeometry, pointsMaterial);
    }

    scene.add(points);

    const now = new Date().getTime();
    const renderTime = now - then;

    loaderCtx.clearRect(0, 0, imgWidth / imgAspectRatio, imgHeight);
    info.innerHTML = `<b>${numFormat.format(particles)}</b> particles rendered in <b>${Math.round(renderTime / 1000)} sec</b><br>
    <b>${Math.round(renderTime / state.particleLayers)}ms</b> per layer`
    if (state['Generate Sprites']) {
        saveSpritesUI.classList.remove("hidden");
    }
    progressBar.setAttribute('style', 'display: none');
};


/*
 * DAT.GUI
 */
const toggleDisabled = (element: HTMLElement, disabled: boolean) => {
    if (disabled) {
        element.classList.add('disabled');
    } else {
        element.classList.remove('disabled');
    }
}

var gui = new dat.GUI({ name: 'My GUI' });
var state = {
    "Generate Sprites": false,
    "200 Layers": true,
    "380 Layers": false,

    chunkSize: 4, // Currently s/b particleSampleSpread
    particleScale: 5,
    transparency: false,

    particleLayers: 200, // 380 ~= max w/ single sprite img (UPNG fails to save larger, drawing to <canvas> also fails with ":u(")
    useTypedArrays: false,
    bypassCanvas: true,

};

var folderSprites = gui.addFolder('Sprite Sheet');
folderSprites.open();
const gui200Layers = folderSprites.add(state, '200 Layers')
    .onFinishChange(value => {
        spritesSrc = spritesSrc200;
        state.particleLayers = 200;
        state["380 Layers"] = !value;
        state.chunkSize = 4;
        toggleDisabled(guiTransparency.domElement, false);
        gui.updateDisplay();
        reRender();
    });
const gui390Layers = folderSprites.add(state, '380 Layers')
    .onFinishChange(value => {
        spritesSrc = spritesSrc380;
        state.particleLayers = 380;
        state["200 Layers"] = !value;
        state.chunkSize = 2;
        state.transparency = false;
        toggleDisabled(guiTransparency.domElement, true);
        gui.updateDisplay();
        reRender();
    });

var folderParticles = gui.addFolder('Particle Options');
folderParticles.open();
folderParticles.add(state, 'chunkSize', 2, 10, 1) // chunkSize of 1 causes crash w/o useful error, unless useTypedArrays. Buffer overflow?
    .onFinishChange(() => reRender());
folderParticles.add(state, 'particleScale', 2, 10)
    .onChange(value => pointsMaterial.size = value * state.chunkSize);
const guiTransparency = folderParticles.add(state, 'transparency')
    .onChange(value => reRender());


var folderSpritesGenerate = gui.addFolder('Sprite Sheet Generation');
folderSpritesGenerate.add(state, "Generate Sprites")
    .onFinishChange(value => {
        toggleDisabled(guiParticleLayers.domElement, !value);
        toggleDisabled(gui200Layers.domElement, value);
        toggleDisabled(gui390Layers.domElement, value);
        reRender();
    });
const guiParticleLayers = folderSpritesGenerate.add(state, 'particleLayers', 10, 380, 1)
    .onFinishChange(() => reRender())
if (!state["Generate Sprites"]) {
    toggleDisabled(guiParticleLayers.domElement, true)
}


var folderForScience = gui.addFolder('For Science');

// This seems to have no effect on performance in Chrome
folderForScience.add(state, 'useTypedArrays')
    .onChange(value => reRender());

// Drawing to a canvas and pulling pixels from its context yields 32bit colors.
// This seems much slower than loading a 8bit file buffer directly and decoding with UPNG,
// even if the whole contest is first converted to a Uint32Array
folderForScience.add(state, 'bypassCanvas')
    .onChange(value => reRender());




const reRender = () => {
    alphas = [];
    colors = [];
    positions = [];

    scene.remove(points);
    if (pointsMaterial) {
        pointsMaterial.dispose();
    }
    // if (ShaderMaterial)

    bufferGeometry.dispose();

    particles = 0;
    srcLayer = 0;
    particleLayer = 0;
    loaderCtx.clearRect(0, 0, imgWidth / imgAspectRatio, imgHeight);

    then = new Date().getTime();
    info.innerHTML = "";
    saveSpritesUI.classList.add("hidden");
    progressBar.setAttribute('style', '');
    init();
}


var canvas = document.createElement("canvas");
canvas.width = imgWidth;
canvas.height = imgHeight;
var ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

const loaderCanvas = document.getElementById('loader-canvas') as HTMLCanvasElement;
loaderCanvas.width = imgWidth / imgAspectRatio;
loaderCanvas.height = imgHeight;
loaderCanvas.style.width = `${imgWidth / 2 / imgAspectRatio}px`;
loaderCanvas.style.height = `${imgHeight / 2}px`;
const loaderCtx = loaderCanvas?.getContext('2d') as CanvasRenderingContext2D;

const picSprites = new Image();
let spriteCtx: CanvasRenderingContext2D;
let spritesCtx: CanvasRenderingContext2D;
const MAX_CANVAS_AREA = 268435456;
const spriteCols = 20; // TODO: Crop ait in photoshop

// Canvas for drawing all individually loaded layers as sprites in a single big image
// TODO: Use UPNG to generate animated PNG instead?
const spriteCanvas = document.createElement("canvas"); // document.getElementById('sprite-canvas') as HTMLCanvasElement;
spriteCanvas.width = imgWidth * spriteCols;
spriteCanvas.height = state.particleLayers / spriteCols * imgHeight;
console.log("spriteCanvas dimensions: " + spriteCanvas.width + " * " + spriteCanvas.height + " = " + spriteCanvas.width * spriteCanvas.height)
spriteCanvas.style.width = `${spriteCanvas.width}px`;
spriteCanvas.style.height = `${spriteCanvas.height}px`;
spriteCtx = spriteCanvas?.getContext('2d') as CanvasRenderingContext2D;
spriteCtx.fillStyle = 'grey';
spriteCtx.fillRect(0, 0, spriteCanvas.width, spriteCanvas.height)


const dist3d = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z)
// const maxDistance = dist3d(volume / 2, volume / 2, volume / 2)

let particles = 0;
const pushParticle = (x: number, y: number, layer: number, { r, g, b, a }: { r: number, g: number, b: number, a?: number }) => {

    const xPoz = x / canvas.width * volume - volume / 2;
    const yPoz = y / canvas.height * volume - volume / 2;
    const zPoz = layer / state.particleLayers * volumeZ - volumeZ / 2;
    const dist = dist3d(xPoz, zPoz, yPoz);
    // if (dist < (volume / 2) - 72) { // spherical hack just for this model... TODO: Hide model 1px adjacent to support?
    const distanceRatio = dist / (volume / 2.5); // Add some fake volumetric shading to differentiate foreground particles
    if (state.useTypedArrays) {
        positions32.set([xPoz, zPoz, yPoz], particles * 3);
        colors32.set([r * distanceRatio / 255, g * distanceRatio / 255, b * distanceRatio / 255], particles * 3);
    } else {
        positions.push(xPoz, zPoz, yPoz);
        colors.push(r * distanceRatio / 255, g * distanceRatio / 255, b * distanceRatio / 255);
    }
    if (state.transparency) {
        alphas.push(r === 45 ? VERO_CLEAR_ALPHA : 1)
    }

    particles++;

}

const rgbaFromColor32 = (color32: number) => {
    const str32 = color32.toString(16);
    const a = parseInt(str32.substr(0, 2), 16);
    const b = parseInt(str32.substr(2, 2), 16);
    const g = parseInt(str32.substr(4, 2), 16);
    const r = parseInt(str32.substr(6, 2), 16);
    return { r, g, b, a }
}

const conditionallyPushRawParticle = (x: number, y: number, layer: number, { r, g, b, a }: { r: number, g: number, b: number, a?: number }) => {
    let renderParticle = false;
    if (!src2) {
        if (a === 255 &&  // hide air & VeroClear
            r !== 100) {  // hide support material
            renderParticle = true;
        }
    } else {
        if (r !== 100 && // hide support material
            b !== 0 &&   // hide air
            r !== 45) {  // hide non-alphaed VeroClear
            renderParticle = true;
        } else if (r === 45 && state.transparency) {
            renderParticle = true;
        }

    }

    if (renderParticle) {
        pushParticle(x, y, layer, { r, g, b, a })
    }
}


const pic = new Image();
let srcLayer = 0;
let particleLayer = 0;
let frames: ArrayBufferLike[] = [];
const loadNextImage = () => {
    pic.src = src2 ? `source-layers/6cm_italianPaper_pavone_${srcLayer}.png` : `source-layers-raw/6cm_italianPaper_pavone_${srcLayer}.png`;
    pic.onload = function () {
        loaderCtx.drawImage(pic, 0, 0, imgWidth / imgAspectRatio, imgHeight);
        spriteCtx.drawImage(pic, (particleLayer % spriteCols) * (imgWidth / imgAspectRatio), Math.floor(particleLayer / spriteCols) * imgHeight, imgWidth / imgAspectRatio, imgHeight);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(pic, 0, 0);
        var myGetImageData = loaderCtx.getImageData(0, 0, pic.width, pic.height);
        var sourceBuffer32 = new Uint32Array(myGetImageData.data.buffer);

        if (!!state["Generate Sprites"]) {
            frames.push(myGetImageData.data);
        }

        for (var x = 0; x < canvas.width; x += imgAspectRatio * state.chunkSize) {
            for (var y = 0; y < canvas.height; y += state.chunkSize) {

                // reading individual pixels like this is slooooow
                // var pixel = ctx.getImageData(x, y, 1, 1).data;
                // const r = pixel[0]
                // const g = pixel[1]
                // const b = pixel[2]
                // const a = pixel[3]

                var val32 = sourceBuffer32[y * myGetImageData.width + x];
                conditionallyPushRawParticle(x, y, particleLayer, rgbaFromColor32(val32));
            }
        }
        particleLayer++;
        setProgressBarRatio(particleLayer / state.particleLayers)
        srcLayer = Math.round(particleLayer / state.particleLayers * sourceLayers)
        if (srcLayer < sourceLayers) {
            loadNextImage();
            console.log(particleLayer)
        } else {
            console.log(`sprite sheet drawn with ${particleLayer + 1} sprites`)
            saveAPNGButton.removeAttribute("disabled");
            saveSpritesPNGButton.removeAttribute("disabled");
            saveAPNGBlabel.innerHTML = "sprites loaded";
            populateParticles();
        }
    }
}

/*
 * Download Sprites APNG
 */
const saveSpritesUI = document.getElementById("save-sprites-ui") as HTMLElement;
const saveAPNGButton = document.getElementById("save-apng") as HTMLElement;
const saveSpritesPNGButton = document.getElementById("save-sprites-png") as HTMLElement;
const saveAPNGBlabel = document.getElementById("save-apng-label") as HTMLElement;
saveAPNGButton.addEventListener("click", () => {
    console.log(frames.length, canvas.width, canvas.height);
    saveAPNGButton.setAttribute("disabled", "")
    saveSpritesPNGButton.setAttribute("disabled", "")
    saveAPNGBlabel.innerHTML = "encoding...";
    setTimeout(() => {
        var png = UPNG.encode(frames, canvas.width, canvas.height, 8, frames.map(() => 30));
        const blob = new Blob([new Uint8Array(png)]);
        saveAs(blob, `6cm_italianPaper_pavone_${state.particleLayers}layers.png`);
        saveAPNGBlabel.innerHTML = "saved!";
    }, 10);
})
saveSpritesPNGButton.addEventListener("click", () => {
    console.log(frames.length, canvas.width, canvas.height);
    saveAPNGButton.setAttribute("disabled", "")
    saveSpritesPNGButton.setAttribute("disabled", "")
    saveAPNGBlabel.innerHTML = "encoding...";
    setTimeout(() => {
        var myGetImageData = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
        var sourceBuffer32 = myGetImageData.data.buffer;
        var png = UPNG.encode([sourceBuffer32], spriteCanvas.width, spriteCanvas.height, 8);
        const blob = new Blob([new Uint8Array(png)]);
        saveAs(blob, `6cm_italianPaper_pavone_sprites${state.particleLayers}.png`);
        saveAPNGBlabel.innerHTML = "saved!";
    }, 10);
})

let myGetImageData: ImageData;
let sourceBuffer32: Uint32Array;
let numSprites: number;
let currentSprite: number = 0;

let UPNGImage: UPNG.Image;
let UPNGData: Uint8Array;
let UPNGPalette: Array<{ r: number, g: number, b: number }>;

const loadSpritesFromPic = () => {
    console.log("sprites loaded ")
    var spritesCanvas = document.createElement("canvas");
    spritesCanvas.width = imgWidth * spriteCols;
    spritesCanvas.height = state.particleLayers / spriteCols * imgHeight;
    spritesCtx = spritesCanvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    spritesCtx.drawImage(picSprites, 0, 0, picSprites.width, picSprites.height);
    myGetImageData = spritesCtx.getImageData(0, 0, picSprites.width, picSprites.height);
    sourceBuffer32 = new Uint32Array(myGetImageData.data.buffer);
    numSprites = (picSprites.height / imgHeight) * spriteCols;
    state.particleLayers = numSprites;
    parseNextSprites();
}

const loadSpritesFromFile = () => {
    console.log("loadFromFile: " + spritesSrc)

    var file = spritesSrc as string;
    var req = new XMLHttpRequest();
    req.open("GET", file, true);
    req.responseType = "arraybuffer";

    req.onreadystatechange = function () {
        console.log("req.readyState: " + req.readyState)
        if (req.readyState === 4) {
            if (req.status === 200 || req.status == 0) {
                var arrayBuffer = req.response;
                console.log("data loaded: " + arrayBuffer);
                const byteArray = new Uint8Array(arrayBuffer);
                UPNGImage = UPNG.decode(arrayBuffer);
                console.log(UPNGImage);
                UPNGData = new Uint8Array(UPNGImage.data);
                const PLTE = UPNGImage.tabs.PLTE || [];
                UPNGPalette = [];
                for (let i = 0; i < PLTE.length; i += 3) {
                    UPNGPalette.push({ r: PLTE[i], g: PLTE[i + 1], b: PLTE[i + 2] })
                }
                numSprites = (UPNGImage.height / imgHeight) * spriteCols;
                state.particleLayers = numSprites;
                // numSprites = UPNGImage.frames.length;
                parseNextSprites();
            }
        }
    }
    req.onprogress = function (event) {
        setProgressBarRatio(event.loaded / event.total);
    }
    req.send(null);
}

var barStatus = document.getElementById("barStatus") as HTMLElement;
const setProgressBarRatio = (ratio: number) => barStatus.style.width = ratio * 100 + '%';
const parseNextSprites = () => {
    currentSprite = 0; // 104;
    parseNextSprite();
}
const parseNextSprite = () => {
    barStatus.style.width = currentSprite / numSprites * 100 + '%';
    const spriteXIndex = (currentSprite % spriteCols);
    const spriteYIndex = Math.floor(currentSprite / spriteCols);

    // Single col/row would be easier... but larger than maximum canvas height/width!
    for (var y = 0; y < imgHeight; y += state.chunkSize) {
        const spriteRowOffset = (spriteYIndex * imgHeight + y) * UPNGImage.width;
        for (var x = 0; x < (imgWidth / imgAspectRatio); x += imgAspectRatio * state.chunkSize) {
            const spriteXOffset = spriteXIndex * (imgWidth / imgAspectRatio) + x;

            if (state.bypassCanvas) {
                const colorIndex = UPNGData[spriteRowOffset + spriteXOffset];
                const color = UPNGPalette[colorIndex];
                if (color
                    // && colorIndex !== 0 // air
                    // && color.r !== 45 // clear
                    // && color.r !== 100 // support
                ) {
                    conditionallyPushRawParticle(x, y, currentSprite, color);
                }
            } else {
                var val32 = sourceBuffer32[spriteRowOffset + spriteXOffset];
                if (val32) {
                    conditionallyPushRawParticle(x, y, currentSprite, rgbaFromColor32(val32));
                }
            }
        }
    }

    // Decoded APNGs have 4bit depth and seems to have extra data per frame? Frame 100 of 200 looks right but others seem to drift.
    // This smells like a UPNG bug since one would expect frames to be self-contained
    // TODO: Small debuggable APNG?
    // const frame = UPNGImage.frames[currentSprite];
    // const frameData = (frame as any)?.data as Uint8Array
    // if (currentSprite === 120) {
    //     console.log(frameData.buffer)
    // }
    // if (frameData && frame.rect) {
    //     const area = frame.rect.width * frame.rect.height;
    //     console.log('area: ' + area + ' data.length * 2: ' + frameData.length * 2 + ' diff: ' + (area - frameData.length * 2))
    //     for (var y = 0; y < frame.rect.height; y += state.chunkSize) {
    //         const spriteRowOffset = (y) * (frame.rect.width / 2);
    //         for (var x = 0; x < frame.rect.width; x += state.chunkSize) {
    //             const colorIndex = frameData[spriteRowOffset + (x / 2)];
    //             const color = UPNGPalette[colorIndex];
    //             if (color
    //                 // && colorIndex !== 0 // air
    //                 // && color.r !== 45 // clear
    //                 // && color.r !== 100 // support
    //             ) {
    //                 conditionallyPushRawParticle(x + frame.rect.x, y + frame.rect.y, currentSprite, color);
    //             }
    //         }
    //     }
    // }

    if (currentSprite < numSprites) { // 106
        // tail recursion to allow progress bar to update
        currentSprite++;
        setTimeout(parseNextSprite, 0);
    } else {
        populateParticles();
    }
}

/*
 * INIT
 */
const init = () => {
    if (!!state["Generate Sprites"]) {
        loadNextImage();
    } else {
        if (state.bypassCanvas) {
            loadSpritesFromFile()
        } else {
            console.log("loading pic" + spritesSrc)
            picSprites.src = spritesSrc as string;
            picSprites.onload = () => loadSpritesFromPic();
        }

    }
}
init();


window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function animate() {
    stats.begin();
    controls.update()
    render()
    stats.end();
    requestAnimationFrame(animate)
}

function render() {
    renderer.render(scene, camera)
}
animate()
