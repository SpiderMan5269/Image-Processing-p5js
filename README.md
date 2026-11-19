# Image Processing Applications in p5.js

**Live demo:** https://spiderman5269.github.io/Image-Processing-p5js/

Two interactive image-processing applications in one p5.js app, presented as a
camera-style interface. Built for CM2030 Graphics Programming, Coursework 2
(BSc Computer Science, University of London, academic direction by Goldsmiths).
All pixel processing (background removal, edge detection, thresholding,
centroids and K-means clustering) is implemented directly on pixel arrays.

Press **1** for Portrait mode (Task 1) and **2** for
Panorama mode (Task 2).

## Tasks

- **Task 1 - Portrait (streaming-style carousel + background removal).**
  Eight provided portraits have their backgrounds removed by per-image
  thresholding (RGB or HSB, whichever suits each image - see `js/config.js`),
  then play back with a fade / alternating zoom-in-zoom-out animation: the
  person travels left->right, the backdrop scrolls left->right and the caption
  moves right->left (no `translate()` used).

- **Task 2 - Panorama (motion guide).** For each image pair the app converts to
  grayscale, applies a simple edge filter, thresholds the edges, computes each
  frame's centroid, compares them (dx, dy) and shows the motion direction as a
  large arrow. All eight directions are demonstrated.

- **Creative extension (Task 1).** A from-scratch **K-means** pass extracts each
  portrait's dominant colour palette, then orders the carousel by colour
  similarity and generates a colour-matched backdrop per image.

## Controls

- `1` / `2` - switch between Portrait and Panorama modes.
- Portrait: `c` open | `l` load & process | `s` play | `k` palette (extension).
- Panorama: `p` screen | `i` next pair | `g` grayscale | `e` edges |
  `t` threshold | `n` centroid | `d` direction. Drag the on-screen slider to
  adjust the edge threshold.

## Run locally

Serve the folder with any static web server (e.g. VS Code Live Server) and open
`index.html`. Opening the file directly from disk may block image loading.

## Project structure

```
index.html            loads p5.js and the modules below
main.js               entry point: lifecycle, input routing, shared UI helpers
js/config.js          constants + per-image threshold table + panorama manifest
js/theme.js           design tokens and drawing primitives (camera UI)
js/imageProcessing.js reusable pixel functions (RGB/HSB removal, edges, centroid)
js/ui.js              app chrome (status strip, mode switch, viewfinder, hints)
js/carousel.js        Carousel class (Task 1)
js/panorama.js        PanoramaGuide class (Task 2)
js/extension.js       K-means palette extension (Task 1)
assets/               provided carousel images and panorama pairs
libraries/p5.min.js   p5.js
```

## About

Built by Akshit Sankhala as coursework for CM2030 Graphics Programming. Shared here as a portfolio piece; please do not submit it as your own coursework.
