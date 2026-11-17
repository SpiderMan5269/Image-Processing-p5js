/*
  ui.js
  -----
  Shared application chrome that sits on top of whichever task is active:
  a streaming-style navigation bar (brand + task tabs + profile) and a
  bottom control-hint strip that highlights the next key to press.

  These are drawn by main.js after the task, so they always overlay it.
*/

// Top status strip: REC dot + mode (left), mode switch (centre), telemetry (right).
function drawTopStrip() {
  const ctx = drawingContext;
  ctx.save();
  ctx.fillStyle = 'rgba(8,9,11,0.92)';
  ctx.fillRect(0, 0, width, NAV_H);
  ctx.restore();

  push();
  stroke(T.stroke);
  strokeWeight(1);
  line(0, NAV_H, width, NAV_H);
  pop();

  const isPortrait = activeTask === TASK.CAROUSEL;
  const cy = NAV_H / 2;

  // Left: red capture dot + mode name + live status.
  push();
  noStroke();
  fill('#ff3b30');
  circle(28, cy, 8);
  fill(T.text);
  textFont(MONO);
  textStyle(BOLD);
  textSize(13);
  textAlign(LEFT, CENTER);
  text(isPortrait ? 'PORTRAIT' : 'PANORAMA', 42, cy + 1);
  fill(T.muted);
  textFont(SANS);
  textStyle(NORMAL);
  textSize(12);
  text(statusMessage, 150, cy + 1);
  pop();

  drawModeSwitch(width / 2, cy);
  drawTelemetry(width - 24, cy, isPortrait);
}

// Centre mode switch (the camera "mode wheel"): PORTRAIT | PANORAMA.
function drawModeSwitch(cx, cy) {
  const modes = [
    { label: 'PORTRAIT', task: TASK.CAROUSEL },
    { label: 'PANORAMA', task: TASK.PANORAMA }
  ];
  push();
  textFont(MONO);
  textStyle(BOLD);
  textSize(12);
  const gap = 28;
  const w = modes.map((m) => textWidth(m.label));
  let total = w[0] + w[1] + gap;
  let x = cx - total / 2;
  for (let i = 0; i < modes.length; i++) {
    const active = activeTask === modes[i].task;
    fill(active ? T.accent : T.muted);
    textAlign(LEFT, CENTER);
    text(modes[i].label, x, cy + 1);
    if (active) { noStroke(); fill(T.accent); rect(x, cy + 12, w[i], 2); }
    x += w[i] + gap;
  }
  pop();
}

// Right-hand technical readout, per mode.
function drawTelemetry(rightX, cy, isPortrait) {
  let str;
  if (isPortrait) {
    const n = carousel.imagesLoaded ? carousel.processed.length : 0;
    str = 'SRC ' + (n ? String(n).padStart(2, '0') : '--') + '  RGB/HSB';
  } else {
    const thr = panorama.threshold;
    str = 'THLD ' + String(thr).padStart(3, '0') + '  ' + STAGE_LABELS[panorama.stage].toUpperCase();
  }
  telemetry(str, rightX, cy, 12, T.muted, RIGHT);
}

// Viewfinder framing drawn over the content: faint rule-of-thirds grid + corner brackets.
function drawViewfinder() {
  thirdsGrid(VF.x, VF.y, VF.w, VF.h, 'rgba(255,255,255,0.045)');
  cornerBrackets(VF.x, VF.y, VF.w, VF.h, 18, 'rgba(255,255,255,0.35)', 2);
}

// Bottom-centre control hint: key caps with labels for the active task; the
// current / next step is highlighted in amber.
function drawControlsHint() {
  const isCarousel = activeTask === TASK.CAROUSEL;
  const steps = isCarousel
    ? [{ key: 'c', label: 'Open' }, { key: 'l', label: 'Load' }, { key: 's', label: 'Play' },
       { key: 'k', label: 'Palette' }] // EXTENSION
    : [{ key: 'p', label: 'Screen' }, { key: 'i', label: 'Pair' }, { key: 'g', label: 'Gray' },
       { key: 'e', label: 'Edge' }, { key: 't', label: 'Thresh' }, { key: 'n', label: 'Cent' },
       { key: 'd', label: 'Arrow' }];
  const highlightKey = isCarousel
    ? ((typeof extActive !== 'undefined' && extActive) ? 'k' : carouselNextKey()) // EXTENSION
    : panoramaActiveKey();

  push();
  textSize(13);
  textStyle(BOLD);
  const capW = 26;
  const gapKeyLabel = 7;
  const gapItems = isCarousel ? 22 : 16;
  let total = 0;
  for (const s of steps) total += capW + gapKeyLabel + textWidth(s.label) + gapItems;
  total -= gapItems;

  let x = (width - total) / 2;
  const y = height - 30;
  for (const s of steps) {
    const on = s.key === highlightKey;
    keyCap(x, y - 13, s.key, on);
    x += capW + gapKeyLabel;
    fill(on ? T.text : T.muted);
    textAlign(LEFT, CENTER);
    text(s.label, x, y + 1);
    x += textWidth(s.label) + gapItems;
  }
  pop();
}

// Which carousel key the user should press next (drives the hint highlight).
function carouselNextKey() {
  if (!carousel.screenReady) return 'c';
  if (!carousel.imagesLoaded) return 'l';
  if (!carousel.running) return 's';
  return null;
}

// Which panorama key represents the current stage (drives the hint highlight).
function panoramaActiveKey() {
  if (!panorama.screenReady) return 'p';
  return ['i', 'g', 'e', 't', 'n', 'd'][panorama.stage];
}
