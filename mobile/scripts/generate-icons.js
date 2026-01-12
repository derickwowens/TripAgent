/**
 * Generate TripAgent app icons
 * Run: node mobile/scripts/generate-icons.js
 * 
 * Creates PNG icons from a canvas drawing
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');

function drawIcon(ctx, size) {
  const scale = size / 1024;
  
  // Background - forest green
  ctx.fillStyle = '#166534';
  ctx.fillRect(0, 0, size, size);
  
  // Pine tree - white
  ctx.fillStyle = '#FFFFFF';
  
  // Tree layers (triangles)
  const centerX = size / 2;
  
  // Top layer
  ctx.beginPath();
  ctx.moveTo(centerX, 120 * scale);
  ctx.lineTo(centerX - 132 * scale, 320 * scale);
  ctx.lineTo(centerX + 132 * scale, 320 * scale);
  ctx.closePath();
  ctx.fill();
  
  // Second layer
  ctx.beginPath();
  ctx.moveTo(centerX, 220 * scale);
  ctx.lineTo(centerX - 172 * scale, 450 * scale);
  ctx.lineTo(centerX + 172 * scale, 450 * scale);
  ctx.closePath();
  ctx.fill();
  
  // Third layer
  ctx.beginPath();
  ctx.moveTo(centerX, 340 * scale);
  ctx.lineTo(centerX - 212 * scale, 600 * scale);
  ctx.lineTo(centerX + 212 * scale, 600 * scale);
  ctx.closePath();
  ctx.fill();
  
  // Bottom layer
  ctx.beginPath();
  ctx.moveTo(centerX, 480 * scale);
  ctx.lineTo(centerX - 252 * scale, 780 * scale);
  ctx.lineTo(centerX + 252 * scale, 780 * scale);
  ctx.closePath();
  ctx.fill();
  
  // Trunk
  ctx.fillRect(centerX - 40 * scale, 780 * scale, 80 * scale, 124 * scale);
  
  // Mountain silhouette at bottom (subtle)
  ctx.fillStyle = 'rgba(15, 76, 42, 0.5)';
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(200 * scale, 850 * scale);
  ctx.lineTo(350 * scale, 920 * scale);
  ctx.lineTo(centerX, 800 * scale);
  ctx.lineTo(674 * scale, 920 * scale);
  ctx.lineTo(824 * scale, 850 * scale);
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();
}

function generateIcon(filename, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawIcon(ctx, size);
  
  const buffer = canvas.toBuffer('image/png');
  const filepath = join(assetsDir, filename);
  writeFileSync(filepath, buffer);
  console.log(`✅ Created ${filename} (${size}x${size})`);
}

console.log('🎨 Generating TripAgent icons...\n');

try {
  generateIcon('icon.png', 1024);
  generateIcon('adaptive-icon.png', 432);
  generateIcon('splash-icon.png', 200);
  generateIcon('favicon.png', 48);
  
  console.log('\n🎉 All icons generated in mobile/assets/');
} catch (error) {
  console.error('Error generating icons:', error.message);
  console.log('\nFallback: Using existing Expo default icons.');
  console.log('You can replace them manually with custom icons later.');
}
