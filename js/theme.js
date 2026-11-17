/*
  theme.js
  --------
  The professional camera design system: colour tokens, layout constants, and a
  set of small reusable drawing primitives.

  Uses p5's underlying canvas 2D context (drawingContext) for rounded clipping,
  gradients and shadows - still core canvas, no external libraries.
*/

// ---- Colour tokens (pro-camera: near-black + camera yellow) ----------------
const T = {
  bg0: '#08090b',                     // deepest (near-black)
  bg1: '#0e1014',
  panel: 'rgba(14, 16, 20, 0.72)',    // frosted panel fill
  stroke: 'rgba(255, 255, 255, 0.08)',
  strokeSoft: 'rgba(255, 255, 255, 0.18)',
  text: '#f2f3f5',
  muted: '#868c96',
  accent: '#ffd60a',                  // camera yellow (focus accent)
  accentInk: '#0a0a0b'                // text drawn on yellow
};

// Font stacks: sans for labels, mono for telemetry / technical readouts.
const SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// ---- Layout constants ------------------------------------------------------
const NAV_H = 48;                              // top status strip height
const VF = { x: 24, y: 64, w: 1232, h: 510 };  // viewfinder region (clears the status strip; gallery tray sits below)

// ---- Rounded-rect helpers --------------------------------------------------

// Trace a rounded-rect path on a 2D context (no fill/stroke applied).
function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Filled rounded rectangle in a CSS colour.
function fillRoundedRect(x, y, w, h, r, cssColor) {
  const ctx = drawingContext;
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = cssColor;
  ctx.fill();
  ctx.restore();
}

// Stroked rounded rectangle in a CSS colour.
function strokeRoundedRect(x, y, w, h, r, cssColor, weight) {
  const ctx = drawingContext;
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = weight || 1;
  ctx.strokeStyle = cssColor;
  ctx.stroke();
  ctx.restore();
}

// Draw an image to fill a rounded box, cropped to "cover" (no distortion).
function imageCoverRounded(img, x, y, w, h, r) {
  const arBox = w / h;
  const arImg = img.width / img.height;
  let sw, sh, sx, sy;
  if (arImg > arBox) { sh = img.height; sw = img.height * arBox; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = img.width / arBox; sx = 0; sy = (img.height - sh) / 2; }

  const ctx = drawingContext;
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  image(img, x, y, w, h, sx, sy, sw, sh);
  ctx.restore();
}

// ---- Gradients / shadows ---------------------------------------------------

// Vertical gradient rectangle (top colour -> bottom colour), both CSS strings.
function verticalScrim(x, y, w, h, cssTop, cssBottom) {
  const ctx = drawingContext;
  ctx.save();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, cssTop);
  grad.addColorStop(1, cssBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Run a drawing callback with a soft shadow enabled, then reset.
function withShadow(cssColor, blur, offX, offY, drawFn) {
  const ctx = drawingContext;
  ctx.save();
  ctx.shadowColor = cssColor;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offX || 0;
  ctx.shadowOffsetY = offY || 0;
  drawFn();
  ctx.restore();
}

// ---- Small components ------------------------------------------------------

// Keyboard key cap (for the control hint). Returns its size.
function keyCap(x, y, letter, active) {
  const s = 26;
  fillRoundedRect(x, y, s, s, 6, active ? T.accent : 'rgba(255,255,255,0.06)');
  strokeRoundedRect(x, y, s, s, 6, active ? T.accent : T.strokeSoft, 1);
  push();
  fill(active ? T.accentInk : T.text);
  textFont(MONO);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(13);
  text(letter.toUpperCase(), x + s / 2, y + s / 2 + 1);
  pop();
  return s;
}

// ---- Camera / viewfinder primitives ---------------------------------------

// L-shaped corner brackets around a region (the viewfinder framing).
function cornerBrackets(x, y, w, h, len, cssColor, weight) {
  push();
  stroke(cssColor);
  strokeWeight(weight || 2);
  noFill();
  // top-left
  line(x, y, x + len, y); line(x, y, x, y + len);
  // top-right
  line(x + w - len, y, x + w, y); line(x + w, y, x + w, y + len);
  // bottom-left
  line(x, y + h - len, x, y + h); line(x, y + h, x + len, y + h);
  // bottom-right
  line(x + w - len, y + h, x + w, y + h); line(x + w, y + h - len, x + w, y + h);
  pop();
}

// Rule-of-thirds grid inside a region (faint camera grid).
function thirdsGrid(x, y, w, h, cssColor) {
  push();
  stroke(cssColor);
  strokeWeight(1);
  for (let i = 1; i < 3; i++) {
    const gx = x + (w * i) / 3;
    const gy = y + (h * i) / 3;
    line(gx, y, gx, y + h);
    line(x, gy, x + w, gy);
  }
  pop();
}

// Monospaced technical readout. align: LEFT/RIGHT/CENTER. Returns text width.
function telemetry(str, x, y, size, cssColor, align) {
  push();
  textFont(MONO);
  textStyle(NORMAL);
  textSize(size || 12);
  textAlign(align || LEFT, CENTER);
  fill(cssColor || T.muted);
  text(str, x, y);
  const w = textWidth(str);
  pop();
  return w;
}

// Small focus reticle (a ring with tick marks) centred at (cx, cy).
function reticle(cx, cy, r, cssColor) {
  push();
  stroke(cssColor);
  strokeWeight(1.5);
  noFill();
  circle(cx, cy, r * 2);
  const t = 5;
  line(cx - r - t, cy, cx - r + t, cy);
  line(cx + r - t, cy, cx + r + t, cy);
  line(cx, cy - r - t, cx, cy - r + t);
  line(cx, cy + r - t, cx, cy + r + t);
  pop();
}
