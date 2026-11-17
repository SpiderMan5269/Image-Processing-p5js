/*
  extension.js   :  K-means Palette + Smart Carousel (Task 1)
  ------------------------------------------------------------------------------
  Integration points in main.js / ui.js / carousel.js are tagged with an 
  "EXTENSION" comment.

  What it does: for each background-removed portrait it discovers the dominant
  colours with a from-scratch K-MEANS clustering pass, then uses that analysis
  functionally:
    - a colour-scope bar (each colour's share) proves the clustering,
    - the carousel plays in a SMART ORDER (nearest-neighbour by palette
      similarity) so colours flow between slides,
    - each slide gets a backdrop generated from its own palette.
  Toggle with the `k` key while in Task 1 (after loading images with `l`).
*/

const EXT_K = 5;              // palette colours per image
const EXT_SAMPLE = 3000;     // max foreground pixels sampled per image
const EXT_ITERS = 12;        // max k-means iterations

let extActive = false;
let extAnalyzed = false;
let extPalettes = [];        // per image: [{ r, g, b, frac }, ...] (sorted)
let extOrder = [];           // display position -> image index
let extBackdrops = [];       // per image: p5.Graphics generated from its palette

// `k` - toggle the palette view on/off.
function toggleExtension() {
  extActive = !extActive;
  if (extActive) {
    if (!extAnalyzed && carousel.imagesLoaded) analyzeCarousel(carousel.processed);
    setStatus(extAnalyzed
      ? 'Palette mode: k-means colours, smart order, matched backdrops.'
      : 'Palette mode on - press L to load images first.');
  } else {
    setStatus('Task 1 - Carousel. Press c, l, s.');
  }
}

// Analyse every processed cut-out once (called from carousel.loadImages).
function analyzeCarousel(processed) {
  extPalettes = processed.map((img) => extractPalette(img, EXT_K));
  extOrder = smartOrder(extPalettes);
  extBackdrops = extPalettes.map((pal) => makePaletteBackdrop(pal));
  extAnalyzed = true;
}

// ---------------------------------------------------------------------------
// K-means clustering
// ---------------------------------------------------------------------------

// Squared Euclidean distance between two [r,g,b] colours.
function colourDist2(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

// k-means++ seeding: spread initial centres out by distance.
function seedCentres(samples, k) {
  const centres = [samples[floor(random(samples.length))].slice()];
  while (centres.length < k) {
    let total = 0;
    const d = samples.map((s) => {
      let nearest = Infinity;
      for (const c of centres) nearest = min(nearest, colourDist2(s, c));
      total += nearest;
      return nearest;
    });
    let r = random(total);
    let idx = 0;
    for (let i = 0; i < d.length; i++) { r -= d[i]; if (r <= 0) { idx = i; break; } }
    centres.push(samples[idx].slice());
  }
  return centres;
}

// Extract the K dominant colours of an image's foreground via k-means.
// Returns [{ r, g, b, frac }] sorted by cluster share (largest first).
function extractPalette(img, k) {
  img.loadPixels();
  const px = img.pixels;
  const total = px.length / 4;
  const stride = max(1, floor(total / EXT_SAMPLE));

  const samples = [];
  for (let i = 0; i < total; i += stride) {
    if (px[i * 4 + 3] > 10) samples.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
  }
  if (samples.length < k) {
    return samples.map((s) => ({ r: s[0], g: s[1], b: s[2], frac: 1 / max(samples.length, 1) }));
  }

  let centres = seedCentres(samples, k);
  const assign = new Array(samples.length).fill(-1);

  for (let it = 0; it < EXT_ITERS; it++) {
    // Assignment step.
    let moved = false;
    for (let s = 0; s < samples.length; s++) {
      let best = Infinity;
      let bi = 0;
      for (let c = 0; c < k; c++) {
        const d = colourDist2(samples[s], centres[c]);
        if (d < best) { best = d; bi = c; }
      }
      if (assign[s] !== bi) { assign[s] = bi; moved = true; }
    }
    // Update step.
    const acc = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let s = 0; s < samples.length; s++) {
      const c = assign[s];
      acc[c][0] += samples[s][0];
      acc[c][1] += samples[s][1];
      acc[c][2] += samples[s][2];
      acc[c][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (acc[c][3] > 0) centres[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
    }
    if (!moved && it > 0) break; // converged
  }

  const counts = new Array(k).fill(0);
  for (let s = 0; s < samples.length; s++) counts[assign[s]]++;
  const palette = centres.map((c, i) => ({
    r: round(c[0]), g: round(c[1]), b: round(c[2]), frac: counts[i] / samples.length
  }));
  palette.sort((a, b) => b.frac - a.frac);
  return palette;
}

// ---------------------------------------------------------------------------
// Smart ordering + backdrop generation
// ---------------------------------------------------------------------------

// Order images so consecutive palettes are similar (greedy nearest-neighbour
// over the dominant colour).
function smartOrder(palettes) {
  const n = palettes.length;
  if (!n) return [];
  const dom = palettes.map((p) => (p[0] ? [p[0].r, p[0].g, p[0].b] : [0, 0, 0]));
  const used = new Array(n).fill(false);
  const order = [0];
  used[0] = true;
  for (let step = 1; step < n; step++) {
    const last = order[order.length - 1];
    let best = Infinity;
    let bi = -1;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const d = colourDist2(dom[last], dom[j]);
      if (d < best) { best = d; bi = j; }
    }
    order.push(bi);
    used[bi] = true;
  }
  return order;
}

// Build a backdrop from an image's palette. A VERTICAL gradient keeps every
// column identical, so the backdrop scrolls and wraps horizontally with no
// seam; the soft glow is centred so it fades to transparent before both edges.
function makePaletteBackdrop(pal) {
  const g = createGraphics(width, height);
  const c1 = pal[0] || { r: 30, g: 34, b: 52 };
  const c2 = pal[1] || c1;
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgb(' + scaleRGB(c1, 0.55) + ')');
  grad.addColorStop(1, 'rgb(' + scaleRGB(c2, 0.26) + ')');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  const rad = ctx.createRadialGradient(width / 2, height * 0.42, 0, width / 2, height * 0.42, height * 0.7);
  rad.addColorStop(0, 'rgba(' + c1.r + ',' + c1.g + ',' + c1.b + ',0.18)');
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, width, height);
  return g;
}

function scaleRGB(c, f) {
  return round(c.r * f) + ',' + round(c.g * f) + ',' + round(c.b * f);
}

// ---------------------------------------------------------------------------
// Hooks used by carousel.js (return safe defaults when inactive)
// ---------------------------------------------------------------------------

// Play/display order: smart order when active, else natural 0..n-1.
function extPlayOrder(n) {
  if (extActive && extAnalyzed && extOrder.length === n) return extOrder;
  const identity = [];
  for (let i = 0; i < n; i++) identity.push(i);
  return identity;
}

// Palette backdrop for an image, or null to use the default backdrop.
function extBackdropFor(imageIndex) {
  if (extActive && extAnalyzed && extBackdrops[imageIndex]) return extBackdrops[imageIndex];
  return null;
}

// Colour-scope readout (top-left), shown only when the extension is active:
// a stacked bar whose segments are the k-means colours sized by their share.
function extDrawSwatches(imageIndex) {
  if (!extActive || !extAnalyzed) return;
  const pal = extPalettes[imageIndex];
  if (!pal) return;

  const x = 44;
  const y = NAV_H + 22;
  const barW = 320;
  const barH = 30;

  push();
  // header (mono, instrument style)
  fill(T.accent);
  textFont(MONO);
  textStyle(BOLD);
  textSize(11);
  textAlign(LEFT, BASELINE);
  text('COLOUR SCOPES  k-means k=' + EXT_K, x, y - 8);

  // stacked share bar
  const ctx = drawingContext;
  ctx.save();
  roundedRectPath(ctx, x, y, barW, barH, 5);
  ctx.clip();
  let cx = x;
  for (let i = 0; i < pal.length; i++) {
    const segW = barW * pal[i].frac;
    noStroke();
    fill('rgb(' + pal[i].r + ',' + pal[i].g + ',' + pal[i].b + ')');
    rect(cx, y, ceil(segW) + 1, barH);
    cx += segW;
  }
  ctx.restore();
  strokeRoundedRect(x, y, barW, barH, 5, 'rgba(255,255,255,0.2)', 1);

  // percentage ticks under the bar (mono)
  fill(T.muted);
  textFont(MONO);
  textStyle(NORMAL);
  textSize(10);
  textAlign(LEFT, TOP);
  let tx = x;
  for (let i = 0; i < pal.length; i++) {
    const segW = barW * pal[i].frac;
    if (segW > 26) text(round(pal[i].frac * 100) + '%', tx + 3, y + barH + 4);
    tx += segW;
  }
  pop();
}
