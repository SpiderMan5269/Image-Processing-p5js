/*
  config.js
  ---------
  Global constants and the per-image background-removal table for Task 1.
  Kept separate so the tunable data lives in one obvious place.
*/

// Canvas dimensions.
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

// Task identifiers (only Task 1 is built for now; Task 2 will slot in later).
const TASK = { CAROUSEL: 1, PANORAMA: 2 };

// Colour-space codes used by the thresholds table (format required by the brief).
const RGB_SPACE = 0;
const HSB_SPACE = 1;

// The eight provided carousel images.
const CAROUSEL_FILES = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg'];

// How long (seconds) each image is featured in the hero animation.
const SECONDS_PER_IMAGE = 4;

// --- Task 2: Panorama Motion Guide -----------------------------------------

// Image pairs and the motion direction each one demonstrates. The four
// provided pairs cover RIGHT, LEFT, DOWN-RIGHT, UP-LEFT. The remaining four
// directions (UP, DOWN, UP-RIGHT, DOWN-LEFT) will be added as pair5-8 later.
const PANORAMA_FILES = [
  { a: 'pair1_1.png', b: 'pair1_2.png', expected: 'RIGHT' },
  { a: 'pair2_1.png', b: 'pair2_2.png', expected: 'LEFT' },
  { a: 'pair3_1.png', b: 'pair3_2.png', expected: 'DOWN-RIGHT' },
  { a: 'pair4_1.png', b: 'pair4_2.png', expected: 'UP-LEFT' },
  // Additional pairs made in GIMP (repositioning provided images) so all eight
  // directions are demonstrated.
  { a: 'pair5_1.png', b: 'pair5_2.png', expected: 'UP' },
  { a: 'pair6_1.png', b: 'pair6_2.png', expected: 'DOWN' },
  { a: 'pair7_1.png', b: 'pair7_2.png', expected: 'UP-RIGHT' },
  { a: 'pair8_1.png', b: 'pair8_2.png', expected: 'DOWN-LEFT' }
];

// Stages of the panorama pipeline, advanced by the g/e/t/n/d keys.
const STAGE = {
  ORIGINAL: 0,
  GRAYSCALE: 1,
  EDGES: 2,
  THRESHOLD: 3,
  CENTROIDS: 4,
  DIRECTION: 5
};
const STAGE_LABELS = ['Original', 'Grayscale', 'Edges', 'Threshold', 'Centroid', 'Direction'];

/*
  Per-image background-removal settings, one row per carousel image:

      thresholds[i] = [colourSpace, c1, c2, c3]

  colourSpace = 0 (RGB):  a pixel is BACKGROUND when
                          R > c1  AND  G > c2  AND  B > c3
  colourSpace = 1 (HSB):  a pixel is BACKGROUND when it is desaturated AND bright,
                          i.e.  saturation < c1  AND  brightness > c2  (both 0-100),
                          with c3 a min-luma (0-255) floor protecting dark pixels.

  Both colour spaces were tried on every image and the better one kept:
  HSB wins when the backdrop is neutral/tinted and the foreground is dark or
  colourful (its high saturation survives the cut); RGB wins when the person
  wears LIGHT clothing that HSB would strip along with the background.
*/
const thresholds = [
  [RGB_SPACE,   0,   0, 187], // 1  RGB  dark tee on lavender bg (remove where B > 187)
  [RGB_SPACE, 238, 240, 242], // 2  RGB  keeps the light striped shirt (HSB would strip it)
  [HSB_SPACE,  14,  72,  45], // 3  HSB  grey backdrop; low-sat+bright cut beats RGB
  [RGB_SPACE, 200, 200, 200], // 4  RGB  clean white backdrop, dark suit
  [RGB_SPACE, 200, 200, 200], // 5  RGB  near-white backdrop, navy shirt
  [HSB_SPACE,  14,  80,  45], // 6  HSB  keeps the vivid blue plaid (high saturation)
  [RGB_SPACE, 200, 252, 200], // 7  RGB  keeps the light plaid shirt (HSB would strip it)
  [RGB_SPACE, 200, 200, 200]  // 8  RGB  keeps the beige blazer (HSB would strip it)
];
