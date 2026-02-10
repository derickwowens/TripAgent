#!/usr/bin/env node
/**
 * Generate colored marker PNG images for Android map markers.
 * These bypass react-native-maps custom view bitmap rendering issues on Android.
 * Output: mobile/assets/markers/*.png
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- PNG helpers ---

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function writePNG(filename, width, height, pixels) {
  // pixels: Uint8Array of RGBA data (width * height * 4)
  // Add filter byte (0 = None) before each row
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const png = Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filename, png);
  console.log(`  ✓ ${path.basename(filename)} (${width}x${height}, ${png.length} bytes)`);
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

function setPixel(buf, w, x, y, r, g, b, a) {
  if (x < 0 || x >= w || y < 0) return;
  const h = buf.length / (w * 4);
  if (y >= h) return;
  const i = (y * w + x) * 4;
  // Alpha blend
  const srcA = a / 255;
  const dstA = buf[i+3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA > 0) {
    buf[i]   = Math.round((r * srcA + buf[i]   * dstA * (1-srcA)) / outA);
    buf[i+1] = Math.round((g * srcA + buf[i+1] * dstA * (1-srcA)) / outA);
    buf[i+2] = Math.round((b * srcA + buf[i+2] * dstA * (1-srcA)) / outA);
  }
  buf[i+3] = Math.round(outA * 255);
}

// --- Shape drawing ---

function drawCircle(buf, w, cx, cy, radius, r, g, b) {
  const h = buf.length / (w * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= radius - 0.5) {
        setPixel(buf, w, x, y, r, g, b, 255);
      } else if (dist <= radius + 0.5) {
        const a = Math.round(Math.max(0, Math.min(1, radius + 0.5 - dist)) * 255);
        setPixel(buf, w, x, y, r, g, b, a);
      }
    }
  }
}

function drawTriangle(buf, w, x1, y1, x2, y2, x3, y3, r, g, b) {
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Barycentric coordinates
      const px = x + 0.5, py = y + 0.5;
      const d = (y2-y3)*(x1-x3) + (x3-x2)*(y1-y3);
      const a = ((y2-y3)*(px-x3) + (x3-x2)*(py-y3)) / d;
      const bv = ((y3-y1)*(px-x3) + (x1-x3)*(py-y3)) / d;
      const c = 1 - a - bv;
      if (a >= -0.02 && bv >= -0.02 && c >= -0.02) {
        const inside = Math.min(a, bv, c);
        const alpha = inside < 0 ? Math.round((inside + 0.02) / 0.02 * 255) : 255;
        setPixel(buf, w, x, y, r, g, b, alpha);
      }
    }
  }
}

function drawRect(buf, w, rx, ry, rw, rh, r, g, b) {
  for (let y = Math.floor(ry); y < Math.ceil(ry + rh); y++) {
    for (let x = Math.floor(rx); x < Math.ceil(rx + rw); x++) {
      setPixel(buf, w, x, y, r, g, b, 255);
    }
  }
}

// --- Marker generators ---

function createTrailCircle(color, size, borderWidth) {
  const [r, g, b] = hexToRgb(color);
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  // White border
  drawCircle(buf, size, cx, cy, size/2 - 0.5, 255, 255, 255);
  // Colored fill
  drawCircle(buf, size, cx, cy, size/2 - borderWidth - 0.5, r, g, b);
  return buf;
}

function createHouseMarker(color, w, h) {
  const [r, g, b] = hexToRgb(color);
  const buf = Buffer.alloc(w * h * 4);
  const cx = w / 2;
  const roofH = Math.floor(h * 0.55);
  const bodyH = h - roofH;

  // White outline (slightly larger shapes)
  drawTriangle(buf, w, cx, 0, 0, roofH + 1, w, roofH + 1, 255, 255, 255);
  drawRect(buf, w, (w - w*0.7)/2 - 1, roofH - 1, w*0.7 + 2, bodyH + 1, 255, 255, 255);

  // Colored roof triangle
  drawTriangle(buf, w, cx, 2, 2, roofH, w - 2, roofH, r, g, b);
  // Colored body rectangle
  const bodyW = w * 0.6;
  drawRect(buf, w, (w - bodyW)/2, roofH, bodyW, bodyH - 2, r, g, b);
  return buf;
}

function createTentMarker(color, w, h) {
  const [r, g, b] = hexToRgb(color);
  const buf = Buffer.alloc(w * h * 4);
  const cx = w / 2;
  const tentH = Math.floor(h * 0.7);
  const baseH = h - tentH;

  // White outline
  drawTriangle(buf, w, cx, 0, 0, tentH + 1, w, tentH + 1, 255, 255, 255);
  drawRect(buf, w, (w - w*0.75)/2 - 1, tentH - 1, w*0.75 + 2, baseH + 1, 255, 255, 255);

  // Colored tent triangle
  drawTriangle(buf, w, cx, 2, 2, tentH, w - 2, tentH, r, g, b);
  // Colored base
  const baseW = w * 0.65;
  drawRect(buf, w, (w - baseW)/2, tentH, baseW, baseH - 2, r, g, b);
  return buf;
}

// --- Main ---

const outDir = path.join(__dirname, '..', 'mobile', 'assets', 'markers');
fs.mkdirSync(outDir, { recursive: true });

console.log('Generating marker images...\n');

// Trail markers - colored circles with white border (40x40 for 2x density)
const trailSize = 40;
const trailBorder = 3;
const trailColors = {
  'trail-easy':     '#4CAF50',
  'trail-moderate': '#FF9800',
  'trail-hard':     '#F44336',
  'trail-expert':   '#9C27B0',
  'trail-unknown':  '#9E9E9E',
};
for (const [name, color] of Object.entries(trailColors)) {
  const buf = createTrailCircle(color, trailSize, trailBorder);
  writePNG(path.join(outDir, `${name}.png`), trailSize, trailSize, buf);
}

// Selected trail markers (larger, 56x56)
const selSize = 56;
const selBorder = 4;
for (const [name, color] of Object.entries(trailColors)) {
  const buf = createTrailCircle(color, selSize, selBorder);
  writePNG(path.join(outDir, `${name}-selected.png`), selSize, selSize, buf);
}

// Park markers - house shape (44x40 for 2x)
const parkW = 44, parkH = 40;
const parkColors = {
  'park-state':    '#2E7D32',
  'park-national': '#1565C0',
};
for (const [name, color] of Object.entries(parkColors)) {
  const buf = createHouseMarker(color, parkW, parkH);
  writePNG(path.join(outDir, `${name}.png`), parkW, parkH, buf);
}

// Campground marker - tent shape (40x36 for 2x)
const cgW = 40, cgH = 36;
const cgBuf = createTentMarker('#E65100', cgW, cgH);
writePNG(path.join(outDir, 'campground.png'), cgW, cgH, cgBuf);

console.log(`\n✅ Generated ${Object.keys(trailColors).length * 2 + Object.keys(parkColors).length + 1} marker images in ${outDir}`);
