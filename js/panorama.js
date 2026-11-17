/*
  panorama.js
  -----------
  Task 2: a panorama-style motion guide. For the selected image pair it runs
  Frame A and Frame B through grayscale -> edges -> threshold, measures each
  frame's centroid, compares them, and shows the motion direction as an arrow.

  Controls (routed from main.js):
    p - open the panorama screen
    i - load / cycle the image pairs
    g - grayscale       e - edge filter     t - threshold (+ slider)
    n - centroids       d - direction arrow

  The pipeline is recomputed only when the pair, stage, or threshold changes
  (cached otherwise), so running it every frame stays cheap.

  Layout (1280x720): nav bar (0-60), two frame panels, readouts + slider + arrow.
*/

const FRAME_A = { x: 50, y: 96, w: 560, h: 360 };
const FRAME_B = { x: 670, y: 96, w: 560, h: 360 };
const PANO_SLIDER = { x: 50, y: 512, w: 280 };

class PanoramaGuide {
  constructor(pairs) {
    this.pairs = pairs;
    this.selected = 0;
    this.stage = STAGE.ORIGINAL;
    this.screenReady = false;

    this.threshold = 90;   // value of the canvas-drawn threshold slider (0-255)
    this.dragging = false; // slider being dragged

    // Cached results, refreshed by recompute() when `dirty`.
    this.dirty = true;
    this.shownA = null;
    this.shownB = null;
    this.ca = null;
    this.cb = null;
    this.direction = null;
  }

  // --- Canvas-drawn threshold slider + mouse interaction ---
  // (p5 keeps mouseX/mouseY in sketch coordinates, so this works when scaled.)
  sliderHit(mx, my) {
    const s = PANO_SLIDER;
    return mx >= s.x - 10 && mx <= s.x + s.w + 10 && my >= s.y - 16 && my <= s.y + 18;
  }
  setThresholdFromX(mx) {
    const s = PANO_SLIDER;
    this.threshold = round(constrain(map(mx, s.x, s.x + s.w, 0, 255), 0, 255));
    if (this.stage >= STAGE.THRESHOLD) this.dirty = true;
  }
  pointerDown(mx, my) {
    if (!this.screenReady) return;
    if (this.sliderHit(mx, my)) { this.dragging = true; this.setThresholdFromX(mx); }
  }
  pointerDrag(mx, my) {
    if (this.dragging) this.setThresholdFromX(mx);
  }
  pointerUp() {
    this.dragging = false;
  }

  // 'p' - open the panorama screen.
  showScreen() {
    this.screenReady = true;
    this.stage = STAGE.ORIGINAL;
    this.dirty = true;
    setStatus('Panorama ready. Press I to load a pair.');
  }

  // 'i' - open the screen (first press) then cycle through the pairs.
  nextPair() {
    if (!this.pairs.length) { setStatus('No image pairs available.'); return; }
    if (this.screenReady) this.selected = (this.selected + 1) % this.pairs.length;
    this.screenReady = true;
    this.stage = STAGE.ORIGINAL;
    this.dirty = true;
    setStatus('Pair ' + (this.selected + 1) + ' of ' + this.pairs.length +
      ' (expected ' + this.pairs[this.selected].expected + ').');
  }

  // g / e / t / n / d - advance the pipeline (also opens the screen).
  setStage(stage, label) {
    this.screenReady = true;
    this.stage = stage;
    this.dirty = true;
    setStatus(label);
  }

  // Run one frame through the pipeline up to the current stage.
  processFrame(source) {
    if (this.stage === STAGE.ORIGINAL) return source;
    const gray = toGrayscale(source);
    if (this.stage === STAGE.GRAYSCALE) return gray;
    const edges = edgeFilter(gray);
    if (this.stage === STAGE.EDGES) return edges;
    return thresholdEdges(edges, this.threshold);
  }

  // Refresh the cached processed frames, centroids and direction.
  recompute() {
    const pair = this.pairs[this.selected];
    this.shownA = this.processFrame(pair.a);
    this.shownB = this.processFrame(pair.b);
    if (this.stage >= STAGE.CENTROIDS) {
      this.ca = computeCentroid(this.shownA);
      this.cb = computeCentroid(this.shownB);
      this.direction = classifyDirection(this.cb.x - this.ca.x, this.cb.y - this.ca.y);
    } else {
      this.ca = this.cb = null;
      this.direction = null;
    }
    this.dirty = false;
  }

  draw() {
    if (!this.screenReady) {
      drawEmptyState('Panorama Motion Guide', 'Press  P  to open the guide, then I', 'p');
      return;
    }
    if (!this.pairs.length) {
      drawCenteredMessage('No image pairs found in assets/panorama.');
      return;
    }

    if (this.dirty) this.recompute();

    const pair = this.pairs[this.selected];
    const rectA = this.drawFramePanel('FRAME A', this.shownA, FRAME_A);
    const rectB = this.drawFramePanel('FRAME B', this.shownB, FRAME_B);

    this.drawLevelGuide();       // camera level indicator in the gap between frames
    this.drawReadouts(pair);
    this.drawThresholdControl(); // canvas-drawn threshold slider

    if (this.stage >= STAGE.CENTROIDS && this.ca && this.cb) {
      this.drawCentroid(rectA, this.shownA, this.ca, 'A');
      this.drawCentroid(rectB, this.shownB, this.cb, 'B');
    }
    if (this.stage === STAGE.DIRECTION && this.direction) {
      this.drawArrow(this.direction);
    }
  }

  // Subtle camera "level" indicator in the gap between the two frames.
  drawLevelGuide() {
    const ly = FRAME_A.y + FRAME_A.h / 2;
    const x1 = FRAME_A.x + FRAME_A.w + 8;
    const x2 = FRAME_B.x - 8;
    const midX = (x1 + x2) / 2;
    push();
    stroke('rgba(255,255,255,0.18)');
    strokeWeight(1);
    line(x1, ly, midX - 9, ly);
    line(midX + 9, ly, x2, ly);
    noStroke();
    fill(T.accent);
    circle(midX, ly, 6);
    pop();
  }

  // Canvas-drawn threshold slider (a camera control) under Frame A.
  drawThresholdControl() {
    const s = PANO_SLIDER;
    const t = this.threshold / 255;
    const hx = s.x + s.w * t;
    push();
    textFont(MONO);
    textStyle(BOLD);
    textSize(11);
    fill(T.muted);
    textAlign(LEFT, BASELINE);
    text('THRESHOLD', s.x, s.y - 12);
    fill(T.accent);
    textAlign(RIGHT, BASELINE);
    text(String(this.threshold).padStart(3, '0'), s.x + s.w, s.y - 12);
    fillRoundedRect(s.x, s.y - 2, s.w, 4, 2, 'rgba(255,255,255,0.14)');
    fillRoundedRect(s.x, s.y - 2, s.w * t, 4, 2, T.accent);
    noStroke();
    fill(T.accent);
    circle(hx, s.y, this.dragging ? 18 : 16);
    fill(T.accentInk);
    circle(hx, s.y, 6);
    pop();
  }

  // Draw one framed panel, fitting the image inside (contain). Returns the
  // on-screen rectangle the image occupies, for centroid mapping.
  drawFramePanel(title, img, panel) {
    fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 12, 'rgba(10,13,20,0.62)');

    const pad = 12;
    const bw = panel.w - 2 * pad;
    const bh = panel.h - 2 * pad;
    const s = Math.min(bw / img.width, bh / img.height);
    const w = img.width * s;
    const h = img.height * s;
    const dx = panel.x + pad + (bw - w) / 2;
    const dy = panel.y + pad + (bh - h) / 2;
    image(img, dx, dy, w, h);

    strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 12, 'rgba(255,255,255,0.14)', 1);
    cornerBrackets(panel.x + 6, panel.y + 6, panel.w - 12, panel.h - 12, 12, 'rgba(255,214,10,0.5)', 1.5);

    // Title badge (top-left).
    push();
    textSize(13);
    textStyle(BOLD);
    const tw = textWidth(title) + 18;
    fillRoundedRect(panel.x + 12, panel.y + 12, tw, 24, 12, 'rgba(0,0,0,0.55)');
    fill(T.accent);
    textAlign(LEFT, CENTER);
    text(title, panel.x + 21, panel.y + 24 + 1);
    pop();

    return { x: dx, y: dy, w: w, h: h };
  }

  // Stage + threshold readout under Frame A; motion readout under Frame B.
  drawReadouts(pair) {
    push();
    textFont(MONO);
    textAlign(LEFT, BASELINE);
    fill(T.muted);
    textSize(13);
    text('STAGE ' + STAGE_LABELS[this.stage].toUpperCase(),
      FRAME_A.x, FRAME_A.y + FRAME_A.h + 26);

    if (this.stage >= STAGE.CENTROIDS && this.ca && this.cb) {
      const dx = round(this.cb.x - this.ca.x);
      const dy = round(this.cb.y - this.ca.y);
      const ok = this.direction === pair.expected;
      fill(T.text);
      text('dx: ' + dx + '    dy: ' + dy, FRAME_B.x, FRAME_B.y + FRAME_B.h + 26);
      fill(T.muted);
      text('Expected: ' + pair.expected, FRAME_B.x + 210, FRAME_B.y + FRAME_B.h + 26);
      fill(ok ? '#8fe28f' : T.accent);
      text('Detected: ' + this.direction + (ok ? '  ✓' : ''),
        FRAME_B.x + 400, FRAME_B.y + FRAME_B.h + 26);
    } else {
      fill(T.muted);
      text('Expected: ' + pair.expected, FRAME_B.x, FRAME_B.y + FRAME_B.h + 26);
    }
    pop();
  }

  // Map a centroid from image space to the on-screen panel and mark it.
  drawCentroid(rect, img, centroid, label) {
    const sx = rect.x + (centroid.x / img.width) * rect.w;
    const sy = rect.y + (centroid.y / img.height) * rect.h;
    push();
    stroke(T.accent);
    strokeWeight(3);
    line(sx - 14, sy, sx + 14, sy);
    line(sx, sy - 14, sx, sy + 14);
    noStroke();
    fill(T.accent);
    circle(sx, sy, 6);
    textSize(16);
    textStyle(BOLD);
    text(label, sx + 12, sy - 12);
    pop();
  }

  // Large arrow overlay + label for the detected direction.
  drawArrow(direction) {
    const glyphs = {
      LEFT: '←', RIGHT: '→', UP: '↑', DOWN: '↓',
      'UP-LEFT': '↖', 'UP-RIGHT': '↗',
      'DOWN-LEFT': '↙', 'DOWN-RIGHT': '↘', STILL: '•'
    };
    push();
    textAlign(CENTER, CENTER);
    withShadow('rgba(255,214,10,0.5)', 30, 0, 0, () => {
      fill(T.accent);
      textSize(120);
      text(glyphs[direction], width / 2, 578);
    });
    fill(T.text);
    textStyle(BOLD);
    textSize(38);
    text(direction, width / 2, 652);
    pop();
  }
}
