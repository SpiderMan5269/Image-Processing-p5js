/*
  carousel.js
  -----------
  Task 1: a cinematic streaming-style carousel with background removal.

  Controls (routed from main.js):
    c - open the carousel screen
    l - load and process the images (background removal)
    s - start the animation

  Required animation (all without translate()):
    - the processed person fades in/out and alternates zoom-in / zoom-out on
      successive cycles, travelling LEFT -> RIGHT;
    - the background layer scrolls smoothly LEFT -> RIGHT;
    - the "NOW STREAMING" badge uses the same fade/zoom but travels RIGHT -> LEFT.

  Layout (1280x720): nav bar (0-60), hero (60-520), Featured row (520-720).
*/

const HERO_BOTTOM = 520;

class Carousel {
  constructor(images, thresholdTable) {
    this.images = images;                 // original provided images
    this.thresholdTable = thresholdTable; // per-image [space, c1, c2, c3]
    this.processed = [];                  // background-removed copies
    this.backdrop = null;                 // scrolling background layer

    this.screenReady = false;             // 'c' pressed
    this.imagesLoaded = false;            // 'l' pressed
    this.running = false;                 // 's' pressed
    this.startTime = 0;
    this.secondsPerImage = SECONDS_PER_IMAGE;
  }

  // 'c' - reveal the carousel screen.
  showScreen() {
    this.screenReady = true;
    this.running = false;
    setStatus('Viewfinder open · press L to process frames.');
  }

  // 'l' - remove the background from every image and build the backdrop once.
  loadImages() {
    if (!this.screenReady) {
      setStatus('Press C first to open the carousel screen.');
      return;
    }
    this.processed = this.images.map((img, i) =>
      removeBackground(img, this.thresholdTable[i]));
    this.backdrop = this.buildBackdrop();
    this.imagesLoaded = true;
    if (typeof analyzeCarousel === 'function') analyzeCarousel(this.processed); // EXTENSION (k-means palettes)
    setStatus('Frames processed · press S to play.');
  }

  // 's' - start the timed animation.
  start() {
    if (!this.imagesLoaded) {
      setStatus('Press L to load the images before starting.');
      return;
    }
    this.running = true;
    this.startTime = millis();
    setStatus('Playback running.');
  }

  // Build a self-contained cinematic backdrop (gradient + soft colour glows +
  // starfield) in an off-screen buffer, so it can be scrolled as an image.
  buildBackdrop() {
    const g = createGraphics(width, height);
    const ctx = g.drawingContext;

    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#141619');
    base.addColorStop(0.55, '#0e0f12');
    base.addColorStop(1, '#08090b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const glows = [
      [width * 0.24, height * 0.28, 380, 'rgba(255,214,10,0.06)'],
      [width * 0.78, height * 0.26, 380, 'rgba(255,255,255,0.05)'],
      [width * 0.55, height * 0.85, 420, 'rgba(255,214,10,0.05)']
    ];
    for (const [gx, gy, gr, col] of glows) {
      const rad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      rad.addColorStop(0, col);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, width, height);
    }

    g.noStroke();
    for (let i = 0; i < 90; i++) {
      g.fill(255, random(20, 90));
      g.circle(random(width), random(height), random(0.6, 2.4));
    }
    return g;
  }

  draw() {
    // Base gradient (also the ground for the empty states).
    verticalScrim(0, 0, width, height, T.bg1, T.bg0);

    if (!this.screenReady) {
      drawEmptyState('PORTRAIT MODE', 'Press  C  to open the viewfinder', 'c');
      return;
    }
    if (!this.imagesLoaded) {
      drawEmptyState('READY', 'Press  L  to load and process the frames', 'l');
      return;
    }

    // Cycle / phase timing.
    const elapsed = this.running ? (millis() - this.startTime) / 1000 : 0;
    const cycle = floor(elapsed / this.secondsPerImage);
    const index = extPlayOrder(this.processed.length)[cycle % this.processed.length]; // EXTENSION (smart order; was cycle % length)
    const phase = (elapsed % this.secondsPerImage) / this.secondsPerImage;

    // Fade in over the first half of the cycle, out over the second half.
    const opacity = sin(PI * phase) * 255;
    // Alternate zoom-in (even cycles) and zoom-out (odd cycles): (i), (ii), ...
    const zoomIn = cycle % 2 === 0;
    const zoom = zoomIn ? map(phase, 0, 1, 0.80, 1.15)
                        : map(phase, 0, 1, 1.15, 0.80);

    this.drawBackdrop(elapsed, extBackdropFor(index)); // EXTENSION (palette backdrop override)
    this.drawHeroScrims();
    this.drawPerson(index, phase, zoom, opacity);
    this.drawAnimatedBadge(index, phase, zoom, opacity);
    this.drawProgressBar(phase);
    this.drawFeaturedRow(index);
    extDrawSwatches(index); // EXTENSION (palette swatch row)
  }

  // Background layer scrolls smoothly LEFT -> RIGHT, wrapping seamlessly.
  drawBackdrop(elapsed, overrideImg) { // EXTENSION param: optional palette backdrop (defaults to the built-in one)
    const bg = overrideImg || this.backdrop;
    const speed = 34; // pixels per second
    let offset = (elapsed * speed) % width;
    if (offset < 0) offset += width;
    image(bg, offset, 0, width, height);
    image(bg, offset - width, 0, width, height);
  }

  // Vignette + left and bottom scrims so hero text stays legible.
  drawHeroScrims() {
    const ctx = drawingContext;
    ctx.save();
    const vig = ctx.createRadialGradient(width / 2, height * 0.42, height * 0.3,
                                         width / 2, height * 0.42, height * 0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    verticalScrim(0, HERO_BOTTOM - 160, width, 160,
                  'rgba(10,12,18,0)', 'rgba(10,12,18,0.96)');
  }

  // Foreground person: soft ground shadow, then the tinted cut-out with an
  // amber rim glow. Fades, zooms, and travels LEFT -> RIGHT.
  drawPerson(index, phase, zoom, opacity) {
    const img = this.processed[index];
    const targetH = height * 0.60 * zoom;
    const targetW = img.width * (targetH / img.height);
    const x = map(phase, 0, 1, width * 0.26, width * 0.72);
    const y = height * 0.52;

    // ground shadow
    push();
    noStroke();
    fill(0, 0, 0, opacity * 0.35);
    ellipse(x, y + targetH / 2 - 6, targetW * 0.7, 34);
    pop();

    // person + amber rim glow
    push();
    imageMode(CENTER);
    tint(255, opacity);
    withShadow('rgba(255,214,10,0.28)', 34, 0, 0, () => {
      image(img, x, y, targetW, targetH);
    });
    pop();

    // autofocus brackets over the face region (camera AF feel), fading with the image
    const fbw = targetW * 0.44;
    const fbh = targetH * 0.30;
    cornerBrackets(x - fbw / 2, y - targetH * 0.24 - fbh / 2, fbw, fbh, 12,
      'rgba(255,214,10,' + (0.7 * opacity / 255) + ')', 2);
  }

  // Animated "ACTOR n" caption: same fade/zoom as the person, travels
  // RIGHT -> LEFT. Drawn as a live-badge pill so it reads as intentional.
  drawAnimatedBadge(index, phase, zoom, opacity) {
    const label = 'ACTOR ' + (index + 1);
    push();
    textFont(MONO);
    textStyle(BOLD);
    textSize(18 * zoom);
    const tw = textWidth(label);
    const padX = 20 * zoom;
    const dot = 9 * zoom;
    const gap = 11 * zoom;
    const w = padX * 2 + dot + gap + tw;
    const h = 40 * zoom;
    const cx = map(phase, 0, 1, width * 0.74, width * 0.30); // centre travels R -> L
    const x = cx - w / 2;
    const y = 120 - h / 2;
    const a = opacity / 255;

    fillRoundedRect(x, y, w, h, h / 2, 'rgba(10,11,13,' + (0.72 * a) + ')');
    strokeRoundedRect(x, y, w, h, h / 2, 'rgba(255,214,10,' + (0.6 * a) + ')', 1.5);
    noStroke();
    fill(255, 59, 48, opacity); // capture dot
    circle(x + padX + dot / 2, y + h / 2, dot);
    fill(255, 214, 10, opacity);
    textAlign(LEFT, CENTER);
    text(label, x + padX + dot + gap, y + h / 2 + 1);
    pop();
  }

  // Thin cycle-progress track just under the hero.
  drawProgressBar(phase) {
    const y = HERO_BOTTOM + 2;
    push();
    noStroke();
    fill(255, 255, 255, 22);
    rect(0, y, width, 3);
    fill(T.accent);
    rect(0, y, width * phase, 3);
    pop();
  }

  // "Featured" heading + a row of rounded poster cards; the active card is
  // enlarged with an amber ring and glow.
  drawFeaturedRow(activeIndex) {
    push();
    const headingX = 72;
    const headingY = HERO_BOTTOM + 52;
    fill(T.text);
    textStyle(BOLD);
    textSize(18);
    textAlign(LEFT, BASELINE);
    const heading = 'GALLERY';
    text(heading, headingX, headingY);
    const headingW = textWidth(heading); // measure at the heading's own size
    fill(T.muted);
    textFont(MONO);
    textStyle(NORMAL);
    textSize(12);
    text('PORTRAITS · 08', headingX + headingW + 16, headingY);
    pop();

    const n = this.images.length;
    const cw = 128;
    const ch = 84;
    const gap = 16;
    const totalW = n * cw + (n - 1) * gap;
    const startX = (width - totalW) / 2;
    const y = HERO_BOTTOM + 70;

    const order = extPlayOrder(n); // EXTENSION (display strip in smart play order)
    for (let pos = 0; pos < n; pos++) {
      const i = order[pos];
      const x = startX + pos * (cw + gap);
      const active = i === activeIndex;
      this.drawCard(this.images[i], x, y, cw, ch, i, active);
    }
  }

  // One poster card. Active cards lift, enlarge, and gain an amber ring + glow.
  drawCard(img, x, y, cw, ch, i, active) {
    const grow = active ? 6 : 0;
    const cx = x - grow;
    const cy = y - grow * 2;
    const w = cw + grow * 2;
    const h = ch + grow * 2;

    if (active) {
      withShadow('rgba(255,214,10,0.4)', 22, 0, 6, () => {
        fillRoundedRect(cx, cy, w, h, 10, '#000');
      });
    }
    imageCoverRounded(img, cx, cy, w, h, 10);

    // bottom label gradient + index
    const ctx = drawingContext;
    ctx.save();
    roundedRectPath(ctx, cx, cy, w, h, 10);
    ctx.clip();
    verticalScrim(cx, cy + h - 30, w, 30, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)');
    ctx.restore();

    push();
    fill(active ? T.accent : T.text);
    textStyle(BOLD);
    textSize(12);
    textAlign(LEFT, BASELINE);
    text('0' + (i + 1), cx + 8, cy + h - 9);
    pop();

    if (active) strokeRoundedRect(cx, cy, w, h, 10, T.accent, 2.5);
    else strokeRoundedRect(cx, cy, w, h, 10, 'rgba(255,255,255,0.12)', 1);
  }
}

// Centred glass "empty state" card used before the images are loaded.
function drawEmptyState(title, subtitle, keyHint) {
  const w = 520;
  const h = 210;
  const x = (width - w) / 2;
  const y = (height - h) / 2;

  withShadow('rgba(0,0,0,0.5)', 40, 0, 20, () => {
    fillRoundedRect(x, y, w, h, 18, T.panel);
  });
  strokeRoundedRect(x, y, w, h, 18, T.stroke, 1);

  // aperture-style reticle
  const dcx = width / 2;
  reticle(dcx, y + 44, 12, T.accent);
  push();
  textAlign(CENTER, CENTER);
  fill(T.text);
  textFont(MONO);
  textStyle(BOLD);
  textSize(24);
  text(title, dcx, y + 96);
  fill(T.muted);
  textFont(SANS);
  textStyle(NORMAL);
  textSize(15);
  text(subtitle, dcx, y + 126);
  pop();

  keyCap(dcx - 13, y + 152, keyHint, true);
}
