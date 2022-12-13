import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as Stats from 'stats.js'
import * as dat from 'dat.gui';
import { nextTick } from 'process';

let then = new Date().getTime();
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 5, 6500);
camera.position.z = 2
camera.position.z = 2750;

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)

/*
 * CONFIG
 */
const src2 = true;
const generateSprites = false;
let spritesSrc: string | null = null;
// spritesSrc = '6cm_italianPaper_pavone_sprites.png';
// spritesSrc = '6cm_italianPaper_pavone_sprites390.png';
spritesSrc = '6cm_italianPaper_pavone_sprites200.png';
const volume = 1000; // TODO: 3D bounding box derived from .gcvf XML
const imgHeight = 827;
const imgWidth = src2 ? 827 : 1664;
const imgAspectRatio = src2 ? 1 : 2;
const sourceLayers = 2409;

var bufferGeometry = new THREE.BufferGeometry();
var positions: any[] = [];
var colors: any[] = [];
var positions32 = new Float32Array(20000000);
var colors32 = new Float32Array(20000000);
let pointsMaterial: THREE.PointsMaterial;
let points: THREE.Points;

const populateParticles = () => {
    if (particleOptions.useTypedArrays) {
        console.log("Using useTypedArrays");
        bufferGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions32, 3));
        bufferGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors32, 3));
    } else {
        bufferGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        bufferGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }

    pointsMaterial = new THREE.PointsMaterial({
        size: 4.2 * particleOptions.chunkSize,
        vertexColors: true,
    });

    points = new THREE.Points(bufferGeometry, pointsMaterial);
    scene.add(points);

    const now = new Date().getTime();
    const renderTime = now - then;
    console.info(`${particles} particles rendered in ${Math.round(renderTime / 1000)} sec`)
    console.info(`${Math.round(renderTime / particleOptions.particleLayers)}ms per layer`)
    loaderCtx.clearRect(0, 0, imgWidth / imgAspectRatio, imgHeight);

    // var result = scene.toJSON();
    // var output = JSON.stringify(result);
    // console.log(output)
};


/*
 * DAT.GUI
 */
const toggleDisabled = (element: HTMLElement, disabled: boolean) => {
    if (disabled) {
        element.setAttribute('style', "opacity: 0.5; filter: grayscale(100%) blur(1px); pointer-events: none");
    } else {
        element.setAttribute('style', "");
    }
}

var gui = new dat.GUI({ name: 'My GUI' });
var particleOptions = {
    chunkSize: 4,
    particleLayers: 200, // 390 ~= max w/ single sprite img
    particleScale: 5,
    useSpritesImg: true,
    useTypedArrays: false,
};
gui.add(particleOptions, 'chunkSize', 1, 10, 1)
    .onFinishChange(() => reRender());

const guiParticleLayers = gui.add(particleOptions, 'particleLayers', 5, 500, 1)
    .onFinishChange(() => reRender())
if (particleOptions.useSpritesImg) {
    toggleDisabled(guiParticleLayers.domElement, true)
}

gui.add(particleOptions, 'particleScale', 1, 10)
    .onChange(value => pointsMaterial.size = value * particleOptions.chunkSize);

gui.add(particleOptions, 'useSpritesImg')
    .onFinishChange(value => {
        toggleDisabled(guiParticleLayers.domElement, value);
        reRender();
    });

gui.add(particleOptions, 'useTypedArrays')
    .onChange(value => reRender());




const reRender = () => {
    scene.remove(points);
    pointsMaterial.dispose();
    bufferGeometry.dispose();

    particles = 0;
    srcLayer = 0;
    particleLayer = 0;
    loaderCtx.clearRect(0, 0, imgWidth / imgAspectRatio, imgHeight);

    render();

    then = new Date().getTime();

    if (particleOptions.useSpritesImg) {
        parseNextSpritesOnRender = 1
    } else {
        loadNextImage();
    }
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
if (generateSprites) {
    // Canvas for drawing all individually loaded layers as sprites in a single big image
    const spriteCanvas = document.getElementById('sprite-canvas') as HTMLCanvasElement;
    spriteCanvas.width = imgWidth * spriteCols;
    spriteCanvas.height = particleOptions.particleLayers / spriteCols * imgHeight;
    console.log()
    console.log("spriteCanvas dimensions: " + spriteCanvas.width + " * " + spriteCanvas.height + " = " + spriteCanvas.width * spriteCanvas.height)
    spriteCanvas.style.width = `${spriteCanvas.width}px`;
    spriteCanvas.style.height = `${spriteCanvas.height}px`;
    spriteCtx = spriteCanvas?.getContext('2d') as CanvasRenderingContext2D;
    spriteCtx.fillStyle = 'grey';
    spriteCtx.fillRect(0, 0, spriteCanvas.width, spriteCanvas.height)
}


const dist3d = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z)
// const maxDistance = dist3d(volume / 2, volume / 2, volume / 2)

let particles = 0;
const pushParticle = (x: number, y: number, layer: number, color32: number) => {
    const str32 = color32.toString(16);
    let renderParticle = false;
    let a, r, g, b;
    if (!src2) {
        a = parseInt(str32.substr(0, 2), 16);
        b = parseInt(str32.substr(2, 2), 16);
        g = parseInt(str32.substr(4, 2), 16);
        r = parseInt(str32.substr(6, 2), 16);
        if (a === 255 &&  // hide air & VeroClear
            r !== 100) {  // hide support material
            renderParticle = true;
        }
    } else {
        b = parseInt(str32.substr(2, 2), 16);
        g = parseInt(str32.substr(4, 2), 16);
        r = parseInt(str32.substr(6, 2), 16);
        if (r !== 100 && // hide support material
            b !== 0 &&   // hide air
            r !== 45) {  // hide non-alphaed VeroClear
            renderParticle = true;
        }
    }

    if (renderParticle) {
        const xPoz = x / canvas.width * volume - volume / 2;
        const yPoz = y / canvas.height * volume - volume / 2;
        const zPoz = layer / particleOptions.particleLayers * volume - volume / 2;
        const dist = dist3d(xPoz, zPoz, yPoz);
        //if (dist < (volume / 2) - 72) { // spherical hack just for this model... TODO: Hide model adjacent to support?
        const distanceRatio = dist / (volume / 2);
        if (particleOptions.useTypedArrays) {
            positions32.set([xPoz, zPoz, yPoz], particles * 3);
            colors32.set([r * distanceRatio / 255, g * distanceRatio / 255, b * distanceRatio / 255], particles * 3);
        } else {
            positions.push(xPoz, zPoz, yPoz);
            colors.push(r * distanceRatio / 255, g * distanceRatio / 255, b * distanceRatio / 255);
        }
        // }
        particles++;
    }
}


const pic = new Image();
let srcLayer = 0;
let particleLayer = 0;
const loadNextImage = () => {
    pic.src = src2 ? `imgs2/6cm_italianPaper_pavone_${srcLayer}.png` : `imgs/6cm_italianPaper_pavone_${srcLayer}.png`;
    pic.onload = function () {
        loaderCtx.drawImage(pic, 0, 0, imgWidth / imgAspectRatio, imgHeight);
        if (generateSprites) {
            spriteCtx.drawImage(pic, (particleLayer % spriteCols) * (imgWidth / imgAspectRatio), Math.floor(particleLayer / spriteCols) * imgHeight, imgWidth / imgAspectRatio, imgHeight);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(pic, 0, 0);
        var myGetImageData = ctx.getImageData(0, 0, pic.width, pic.height);
        var sourceBuffer32 = new Uint32Array(myGetImageData.data.buffer);

        for (var x = 0; x < canvas.width; x += imgAspectRatio * particleOptions.chunkSize) {
            for (var y = 0; y < canvas.height; y += particleOptions.chunkSize) {

                // reading individual pixels like this is slooooow
                // var pixel = ctx.getImageData(x, y, 1, 1).data;
                // const r = pixel[0]
                // const g = pixel[1]
                // const b = pixel[2]
                // const a = pixel[3]

                var val32 = sourceBuffer32[y * myGetImageData.width + x];
                pushParticle(x, y, particleLayer, val32);
            }
        }
        particleLayer++;
        elem.style.width = particleLayer / particleOptions.particleLayers * 100 + '%';
        srcLayer += Math.round(sourceLayers / particleOptions.particleLayers);
        if (srcLayer < sourceLayers) {
            loadNextImage();
        } else {
            populateParticles();
        }
    }
}


/*
 * INIT
 */
if (!particleOptions.useSpritesImg) {
    loadNextImage();
} else {
    console.log("loading " + spritesSrc)
    picSprites.src = spritesSrc;
    picSprites.onload = () => loadSprites();
}

let myGetImageData: ImageData;
let sourceBuffer32: Uint32Array;
let numSprites: number;
let currentSprite: number = 0;
const loadSprites = () => {
    console.log("sprites loaded ")
    var spritesCanvas = document.createElement("canvas");
    spritesCanvas.width = imgWidth * spriteCols;
    spritesCanvas.height = particleOptions.particleLayers / spriteCols * imgHeight;
    spritesCtx = spritesCanvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    spritesCtx.drawImage(picSprites, 0, 0, picSprites.width, picSprites.height);
    myGetImageData = spritesCtx.getImageData(0, 0, picSprites.width, picSprites.height);
    sourceBuffer32 = new Uint32Array(myGetImageData.data.buffer);
    numSprites = (picSprites.height / imgHeight) * spriteCols;
    parseNextSprites();
}
let parseNextSpritesOnRender = 0;
var elem = document.getElementById("barStatus") as HTMLElement;
const parseNextSprites = () => {
    currentSprite = 0;
    parseNextSprite();
}
const parseNextSprite = () => {
    elem.style.width = currentSprite / numSprites * 100 + '%';
    const spriteXIndex = (currentSprite % spriteCols);
    const spriteYIndex = Math.floor(currentSprite / spriteCols);

    // Single col/row would be easier... but larger than maximum canvas height/width!
    for (var y = 0; y < imgHeight; y += particleOptions.chunkSize) {
        const spriteRowOffset = (spriteYIndex * imgHeight + y) * myGetImageData.width;
        for (var x = 0; x < (imgWidth / imgAspectRatio); x += imgAspectRatio * particleOptions.chunkSize) {
            const spriteXOffset = spriteXIndex * (imgWidth / imgAspectRatio) + x;

            var val32 = sourceBuffer32[spriteRowOffset + spriteXOffset];
            if (val32) {
                pushParticle(x, y, currentSprite, val32);
            }
        }
    }
    if (currentSprite < numSprites) {
        // tail recursion to allow progress bar to update
        currentSprite++;
        setTimeout(parseNextSprite, 0);
    } else {
        populateParticles();
    }
}



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
    if (parseNextSpritesOnRender >= 1) {
        parseNextSpritesOnRender++;
    }
    if (parseNextSpritesOnRender === 3) {
        parseNextSprites();
        parseNextSpritesOnRender = 0;
    }
    requestAnimationFrame(animate)
}

function render() {
    renderer.render(scene, camera)
}
animate()
