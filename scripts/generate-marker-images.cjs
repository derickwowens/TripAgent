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

function createBadgeMarker(color, w, h) {
  const [r, g, b] = hexToRgb(color);
  const buf = Buffer.alloc(w * h * 4);
  const bw = Math.max(2, Math.round(w * 0.10)); // border width
  const radius = Math.round(Math.min(w, h) * 0.25); // corner radius ~25% of smaller dimension

  // Draw rounded rectangle with white border and colored fill
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Check if pixel is inside rounded rect
      let inside = true;
      let inBorder = false;
      
      // Check corners for rounding
      const corners = [
        { cx: radius, cy: radius },           // top-left
        { cx: w - radius, cy: radius },       // top-right
        { cx: radius, cy: h - radius },       // bottom-left
        { cx: w - radius, cy: h - radius },   // bottom-right
      ];
      
      for (const { cx, cy } of corners) {
        const inCornerRegion = 
          (x < radius && y < radius && cx === radius && cy === radius) ||
          (x >= w - radius && y < radius && cx === w - radius && cy === radius) ||
          (x < radius && y >= h - radius && cx === radius && cy === h - radius) ||
          (x >= w - radius && y >= h - radius && cx === w - radius && cy === h - radius);
        
        if (inCornerRegion) {
          const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
          if (dist > radius) {
            inside = false;
          } else if (dist > radius - bw) {
            inBorder = true;
          }
        }
      }
      
      // Check if in border region (not corners)
      if (inside && !inBorder) {
        if (x < bw || x >= w - bw || y < bw || y >= h - bw) {
          inBorder = true;
        }
      }
      
      if (inside) {
        if (inBorder) {
          setPixel(buf, w, x, y, 255, 255, 255, 255); // white border
        } else {
          setPixel(buf, w, x, y, r, g, b, 255); // colored fill
        }
      }
    }
  }
  return buf;
}

function createDiamondMarker(color, size) {
  const [r, g, b] = hexToRgb(color);
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const half = size / 2 - 0.5;

  // Diamond = rotated square. For each pixel, check if |x-cx| + |y-cy| <= half
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - cx + 0.5) + Math.abs(y - cy + 0.5);
      if (dist <= half) {
        // White border for outer 1.5px
        if (dist > half - 1.5) {
          setPixel(buf, size, x, y, 255, 255, 255, 255);
        } else {
          setPixel(buf, size, x, y, r, g, b, 255);
        }
      } else if (dist <= half + 0.5) {
        const a = Math.round(Math.max(0, half + 0.5 - dist) * 255);
        setPixel(buf, size, x, y, 255, 255, 255, a);
      }
    }
  }
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

// Density variants: @1x, @2x, @3x
// React Native picks the right variant for device density.
// Logical sizes (in dp) match iOS custom views:
//   Trail dot: 12dp, Selected: 18dp, House: 14x13dp, Tent: 12x11dp
const scales = [
  { suffix: '',    scale: 1 },
  { suffix: '@2x', scale: 2 },
  { suffix: '@3x', scale: 3 },
];

const trailColors = {
  'trail-easy':     '#4CAF50',
  'trail-moderate': '#FF9800',
  'trail-hard':     '#F44336',
  'trail-expert':   '#9C27B0',
  'trail-unknown':  '#9E9E9E',
};

const parkBadgeColors = {
  'park-national': '#4A2C0A',  // US Recreation Brown (road sign brown)
  'park-state':    '#33691E',  // State park green
};
const parkOtherColor = '#78909C'; // Gray for other national sites

let count = 0;
for (const { suffix, scale } of scales) {
  // Trail markers - colored circles (12dp logical)
  const trailSize = Math.round(12 * scale);
  const trailBorder = Math.max(1, Math.round(1.5 * scale));
  for (const [name, color] of Object.entries(trailColors)) {
    const buf = createTrailCircle(color, trailSize, trailBorder);
    writePNG(path.join(outDir, `${name}${suffix}.png`), trailSize, trailSize, buf);
    count++;
  }

  // Selected trail markers (18dp logical)
  const selSize = Math.round(18 * scale);
  const selBorder = Math.max(1, Math.round(2 * scale));
  for (const [name, color] of Object.entries(trailColors)) {
    const buf = createTrailCircle(color, selSize, selBorder);
    writePNG(path.join(outDir, `${name}-selected${suffix}.png`), selSize, selSize, buf);
    count++;
  }

  // Park badge markers - rounded rect (24x16dp logical, more prominent)
  const badgeW = Math.round(24 * scale);
  const badgeH = Math.round(16 * scale);
  for (const [name, color] of Object.entries(parkBadgeColors)) {
    const buf = createBadgeMarker(color, badgeW, badgeH);
    writePNG(path.join(outDir, `${name}${suffix}.png`), badgeW, badgeH, buf);
    count++;
  }

  // Other national site markers - diamond shape (10x10dp logical)
  const diamondSize = Math.round(10 * scale);
  const diamondBuf = createDiamondMarker(parkOtherColor, diamondSize);
  writePNG(path.join(outDir, `park-other${suffix}.png`), diamondSize, diamondSize, diamondBuf);
  count++;

  // Campground marker - tent shape (12x11dp logical)
  const cgW = Math.round(12 * scale);
  const cgH = Math.round(11 * scale);
  const cgBuf = createTentMarker('#E65100', cgW, cgH);
  writePNG(path.join(outDir, `campground${suffix}.png`), cgW, cgH, cgBuf);
  count++;
}

console.log(`\n✅ Generated ${count} marker images in ${outDir}`);
