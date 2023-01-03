# Three.js Voxel Visualizer

An experimental particle-based voxel renderer, designed to explore optimization strategies for rendering large (1-8 million!) particle buffers in [Three.js](https://threejs.org/). The test model is a 6cm test sphere generated by a volumetric GLSL shader, stored as a sequence of PNGs, or a single "sprite sheet". This voxel shader was used to create larger [lamp shades with various Stratasys PolyJet 3d printers](https://blog.grabcad.com/blog/2018/11/28/italian-marbled-voxels-on-the-stratasys-j750/). These printers achieve variable-transparency, full color prints by dithering voxels of CMYKW (cyan, magenta, yellow, black, white) and transparent photopolymer resins, along with a sacrificial support material.

View it live here: [https://caseprince.github.io/voxel-visualizer](https://caseprince.github.io/voxel-visualizer)

![Voxel rendering alongside completed 36 print](voxel_visualizer.jpg?raw=true 'Voxel rendering alongside completed 36 print')

## Optimization Observations

1. Reading individual pixels from a Canvas Context via `var pixel = ctx.getImageData(x, y, 1, 1).data` is quite slow, even when using a sprite sheet. `willReadFrequently` seems to have little to no effect.
1. Reads are faster if `ImageData` is first converted into a `Uint32Array` (eg `new Uint32Array(myImageData.data.buffer)`) https://hacks.mozilla.org/2011/12/faster-canvas-pixel-manipulation-with-typed-arrays/
1. `Array.push()` does not seem slower then `Float32Array.set()` for writing data.
1. Bypassing Canvas completely by loading a PNG as a raw file using `XMLHttpRequest`, then piping the arrayBuffer into a `Uint8Array` and decoding via [UPNG](https://github.com/photopea/UPNG.js) seems like the fastest way to read pixel data, and supports indexed color PNG8s as well. 8bit PNGs are more than sufficent for PolyJet voxel printing since PolyJet printers support a maximum of 7-8 colors/resins-types per print.
1. Not all PNGs are created equal! UPNG and [ImageMagick](https://imagemagick.org/) both encode PNGs with 4bit `depth` properties (as decoded by UPNG), which is ostensibly the [bitness of color indices](https://www.w3.org/TR/png/#dfn-bit-depth), and makes sense given our small color palette. PhotoShop on the other hand encodes `PNG-8` with 8 bit indices, which makes access via `Uint8Array` painless, eschewing any bitwise logic. (Javascript has no built-in `Uint4Array` typed array.) Oddly, and in spite of this, PhotoShop's PNGs are slightly smaller! - This makes me think I don't understand what's happening with the bitness at all, OR there's a bug with UPNG. The two formats seem incompatible in terms of reading color indices. This demo is using PhotoShop encoded PNGs for simplicity.
1. UPNG supports encoding animated PNGs ([APNGs](https://wiki.mozilla.org/APNG_Specification)), which theoretically should be the most efficient format since frames only encode pixels from regions that are changing. However! Initial experimentation encoding APNGs yield files that are ~15% larger than equivalent 2D sprite sheets. This may warrant further investigation.

## TODO

-   [ ] Simulate color blending
-   [ ] Output sprites directly as animated PNG
-   [ ] Add ability to parse indexed-color PNGs with 4bit indices
-   [ ] 3D bounding box calculation

## Installing

1. Clone Repository

```bash
git clone https://github.com/caseprince/voxel-visualizer
```

2. CD into folder

```bash
cd voxel-visualizer
```

3. Install TypeScript

```bash
npm install -g typescript
```

4. Install dependencies

```bash
npm install
```

5. Start it

```bash
npm run dev
```

6. Visit [http://127.0.0.1:8080](http://127.0.0.1:8080)

## Thanks!

-   Three.js TypeScript Boilerplate: [https://github.com/Sean-Bradley/Three.js-TypeScript-Boilerplate.git](https://github.com/Sean-Bradley/Three.js-TypeScript-Boilerplate.git)
-   UPNG.js: [https://github.com/photopea/UPNG.js](https://github.com/photopea/UPNG.js)
-   dat.GUI: [https://github.com/dataarts/dat.gui](https://github.com/dataarts/dat.gui)
-   FileSaver.js: [https://github.com/eligrey/FileSaver.js](https://github.com/eligrey/FileSaver.js)
