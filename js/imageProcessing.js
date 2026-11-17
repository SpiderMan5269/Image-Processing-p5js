/*
  imageProcessing.js
  ------------------
  Reusable pixel-level helpers. These are pure functions (no drawing, no shared
  state) so they can be unit-reasoned about and reused by any part of the app.
*/

// Convert one RGB triplet (0-255) to HSB.
// Returns { h: 0-360, s: 0-100, b: 0-100 }.
// Written by hand so the sketch never has to switch p5's global colorMode.
function rgbToHsb(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const maxC = Math.max(rn, gn, bn);
  const minC = Math.min(rn, gn, bn);
  const delta = maxC - minC;

  let hue = 0;
  if (delta > 0) {
    if (maxC === rn) hue = ((gn - bn) / delta) % 6;
    else if (maxC === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = maxC === 0 ? 0 : (delta / maxC) * 100;
  const brightness = maxC * 100;
  return { h: hue, s: saturation, b: brightness };
}

// Return a copy of `source` with background pixels made transparent, using the
// stored colour-space mode and thresholds for that image.
//   config = [colourSpace, c1, c2, c3]  (see config.js for the meaning).
function removeBackground(source, config) {
  const output = source.get();
  if (!config) return output;

  output.loadPixels();
  const [colourSpace, c1, c2, c3] = config;
  const px = output.pixels;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    let isBackground;

    if (colourSpace === RGB_SPACE) {
      // RGB: a plain light backdrop is bright on every channel.
      isBackground = r > c1 && g > c2 && b > c3;
    } else {
      // HSB: a light, washed-out backdrop is LOW in saturation and HIGH in
      // brightness. Judging colour and lightness separately separates a
      // neutral/tinted background (cream, grey, lavender) from colourful or
      // dark foreground far more cleanly than a flat per-channel RGB cut.
      //   c1 = max saturation, c2 = min brightness (both 0-100),
      //   c3 = min luma (0-255) safety floor so dark foreground is never removed.
      const hsb = rgbToHsb(r, g, b);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      isBackground = hsb.s < c1 && hsb.b > c2 && luma > c3;
    }

    if (isBackground) px[i + 3] = 0; // punch a hole in the alpha channel
  }

  output.updatePixels();
  return output;
}

// ---------------------------------------------------------------------------
// Task 2 pipeline: grayscale -> edges -> threshold -> centroid -> direction.
// All pure functions operating on p5.Image copies.
// ---------------------------------------------------------------------------

// Convert an image to greyscale using perceptual luma weights.
function toGrayscale(source) {
  const output = source.get();
  output.loadPixels();
  const px = output.pixels;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = gray;
  }
  output.updatePixels();
  return output;
}

// Simple gradient-magnitude edge filter on a greyscale image: each pixel's
// response is how sharply brightness changes to its right and below.
function edgeFilter(grayImage) {
  grayImage.loadPixels();
  const w = grayImage.width;
  const h = grayImage.height;
  const output = createImage(w, h);
  output.loadPixels();

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = 4 * (x + y * w);
      const right = 4 * (x + 1 + y * w);
      const below = 4 * (x + (y + 1) * w);
      const strength = abs(grayImage.pixels[i] - grayImage.pixels[right]) +
                       abs(grayImage.pixels[i] - grayImage.pixels[below]);
      const v = constrain(strength, 0, 255);
      output.pixels[i] = output.pixels[i + 1] = output.pixels[i + 2] = v;
      output.pixels[i + 3] = 255;
    }
  }
  output.updatePixels();
  return output;
}

// Keep only the strongest edges: pixels at/above `cutoff` become white, the
// rest black. Produces the binary image the centroid is measured from.
function thresholdEdges(edgeImage, cutoff) {
  const output = edgeImage.get();
  output.loadPixels();
  const px = output.pixels;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] >= cutoff ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  output.updatePixels();
  return output;
}

// Centroid of all lit pixels in a binary image, in image-pixel coordinates.
// Sums every remaining pixel's x and y, then divides by the pixel count.
function computeCentroid(binaryImage) {
  binaryImage.loadPixels();
  const w = binaryImage.width;
  const h = binaryImage.height;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binaryImage.pixels[4 * (x + y * w)] > 0) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (count === 0) return { x: w / 2, y: h / 2, count: 0 };
  return { x: sumX / count, y: sumY / count, count: count };
}

// Turn a centroid shift (dx, dy) into one of the eight named directions.
// y grows downward, so a positive dy means the subject moved DOWN.
function classifyDirection(dx, dy) {
  const tolerance = 4; // ignore sub-pixel jitter
  const horizontal = dx > tolerance ? 'RIGHT' : dx < -tolerance ? 'LEFT' : '';
  const vertical = dy > tolerance ? 'DOWN' : dy < -tolerance ? 'UP' : '';
  if (vertical && horizontal) return vertical + '-' + horizontal;
  return vertical || horizontal || 'STILL';
}
