/*
  ===========================================================================
  COMMENTARY
  ===========================================================================

  This coursework packages two image-processing tools in one p5.js app,
  themed as a premium camera. Key 1 opens Portrait mode, 2 opens Panorama
  mode; a status strip, a mode switch and a viewfinder frame everything.

  In Portrait mode, c opens the viewfinder, l loads the eight portraits and
  removes each background, and s plays the carousel. Removal reads a per-image
  table, thresholds[i] = [colourSpace, c1, c2, c3]. I tried both colour spaces
  on every image and kept whichever separated subject from background best:
  RGB (remove where R, G and B are all bright) for plain backdrops, and HSB
  (remove low-saturation, high-brightness pixels) where hue and brightness
  needed judging separately. Processed people then fade, alternate
  zoom-in/zoom-out and travel left->right over a scrolling generated backdrop,
  while a caption moves right->left - all without translate(), using mapped
  coordinates. Panorama mode runs each pair through grayscale (g), a simple
  edge filter (e), edge thresholding (t, adjustable via a slider), centroid
  calculation (n) and a direction arrow (d) derived from dx, dy. I built four
  extra pairs in GIMP so all eight directions appear.

  My first HSB attempt used p5's colorMode and colour objects, but the values
  did not line up - p5's saturation() behaves inconsistently between HSB and
  HSL. I fixed this by writing my own rgbToHsb() and comparing pixels directly,
  which is faster and predictable. Light shirts and a beige blazer sit close to
  the background tone, so HSB stripped the clothing; I kept those images on RGB
  - a real per-image trade-off. Block matching for the extension was a dead end
  too: the plain studio backgrounds offer too few trackable features (the
  aperture problem), so I switched approach.

  I met the requirements and still had time to refine the interface, so I was
  on target. Next time I would create the panorama pairs earlier and script my
  threshold testing instead of eyeballing each image.

  My extension is a from-scratch K-means clustering pass that finds each
  portrait's dominant colours. It orders the carousel by colour similarity (a
  nearest-neighbour walk) and generates a matching backdrop per image, with a
  live colour-scope bar showing each cluster's share. I think it is unique
  because it turns the marked background-removal work into real colour analysis
  and drives the presentation from the images themselves, rather than adding a
  cosmetic filter.

  I used the p5.js reference for pixels[], image handling and colour functions,
  and the module materials for thresholding, edge detection and centroids. The
  wider ideas - RGB/HSB thresholding, gradient edge filtering, image moments for
  the centroid, Lloyd's k-means with k-means++ seeding, and nearest-neighbour
  ordering - are standard, and I implemented them myself in plain JavaScript.
*/

/*
  main.js  (main entry)
  ---------------------
  CM2030 Graphics Programming - Coursework 2.
  During development the code is split across js/config.js, js/theme.js,
  js/imageProcessing.js, js/ui.js, js/carousel.js, js/panorama.js and
  js/extension.js; for submission these are merged into one file with the
  JavaScript Bundler Tool.

  Controls:
    1 / 2        switch between Task 1 (carousel) and Task 2 (panorama)
    c / l / s    carousel: open screen / load+process images / start animation
    p i g e t n d  panorama: screen / pair / gray / edges / threshold / centroid / arrow
*/

let activeTask = TASK.CAROUSEL;
let carousel;
let panorama;
let carouselImages = [];
let panoramaPairs = [];
let statusMessage = 'Select a mode · 1 Portrait · 2 Panorama';

function preload() {
  carouselImages = CAROUSEL_FILES.map((name) => loadImage('assets/carousel/' + name));
  panoramaPairs = PANORAMA_FILES.map((pair) => ({
    a: loadImage('assets/panorama/' + pair.a),
    b: loadImage('assets/panorama/' + pair.b),
    expected: pair.expected
  }));
}

function setup() {
  createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT).parent(document.querySelector('main'));
  pixelDensity(1);
  textFont('Helvetica Neue, Helvetica, Arial, sans-serif');

  carousel = new Carousel(carouselImages, thresholds);
  panorama = new PanoramaGuide(panoramaPairs);

  fitToPage();
}

// Scale the canvas element to fill the page while keeping the 16:9 aspect.
// The drawing resolution stays 1280x720, so nothing inside the sketch changes.
function fitToPage() {
  const c = document.querySelector('canvas');
  if (!c) return;
  const scale = Math.min(windowWidth / CANVAS_WIDTH, windowHeight / CANVAS_HEIGHT);
  c.style.width = Math.floor(CANVAS_WIDTH * scale) + 'px';
  c.style.height = Math.floor(CANVAS_HEIGHT * scale) + 'px';
}

function windowResized() {
  fitToPage();
}

// Mouse drives the canvas threshold slider in Panorama mode.
function mousePressed() {
  if (activeTask === TASK.PANORAMA) panorama.pointerDown(mouseX, mouseY);
}
function mouseDragged() {
  if (activeTask === TASK.PANORAMA) panorama.pointerDrag(mouseX, mouseY);
}
function mouseReleased() {
  if (panorama) panorama.pointerUp();
}

function draw() {
  background(T.bg0);
  if (activeTask === TASK.CAROUSEL) carousel.draw();
  else panorama.draw();
  drawViewfinder();    // viewfinder grid + corner brackets, over the content
  drawTopStrip();      // camera status strip
  drawControlsHint();  // bottom key buttons
}

function keyPressed() {
  const k = key.toLowerCase();
  if (key === '1') { selectTask(TASK.CAROUSEL); return; }
  if (key === '2') { selectTask(TASK.PANORAMA); return; }
  if (activeTask === TASK.CAROUSEL) routeCarouselKey(k);
  else routePanoramaKey(k);
}

// Switch between Portrait (Task 1) and Panorama (Task 2) modes.
function selectTask(task) {
  activeTask = task;
  setStatus(task === TASK.CAROUSEL
    ? 'Portrait mode · C open · L process · S play'
    : 'Panorama mode · P I G E T N D');
}

function routeCarouselKey(k) {
  if (k === 'c') carousel.showScreen();
  else if (k === 'l') carousel.loadImages();
  else if (k === 's') carousel.start();
  else if (k === 'k') toggleExtension(); // EXTENSION
}

function routePanoramaKey(k) {
  if (k === 'p') panorama.showScreen();
  else if (k === 'i') panorama.nextPair();
  else if (k === 'g') panorama.setStage(STAGE.GRAYSCALE, 'Grayscale stage.');
  else if (k === 'e') panorama.setStage(STAGE.EDGES, 'Edge-filter stage.');
  else if (k === 't') panorama.setStage(STAGE.THRESHOLD, 'Threshold stage. Drag the slider to tune.');
  else if (k === 'n') panorama.setStage(STAGE.CENTROIDS, 'Centroid stage.');
  else if (k === 'd') panorama.setStage(STAGE.DIRECTION, 'Direction stage.');
}

// ---------------------------------------------------------------------------
// Shared UI helpers (used by every task).
// ---------------------------------------------------------------------------

// Update the message shown in the status bar.
function setStatus(message) {
  statusMessage = message;
}

function drawCenteredMessage(message) {
  push();
  fill(220);
  textSize(24);
  textAlign(CENTER, CENTER);
  text(message, width / 2, height / 2);
  pop();
}
