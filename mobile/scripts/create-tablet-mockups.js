/**
 * Create realistic tablet mockup screenshots
 * Places phone screenshot content into tablet-sized frames with proper UI
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const assetsDir = join(__dirname, '..', 'assets');

const demos = ['demo1.png', 'demo2.png', 'demo3.png', 'demo4.png'];

// Tablet dimensions
const TABLET_7 = { width: 1200, height: 1920 };
const TABLET_10 = { width: 1600, height: 2560 };

// Colors
const GREEN = { r: 22, g: 101, b: 52, alpha: 1 }; // #166534
const STATUS_BAR = { r: 15, g: 70, b: 36, alpha: 1 }; // Darker green

async function createStatusBar(width, height = 48) {
  // Create status bar with time, wifi, battery icons
  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="#0f4624"/>
      <text x="30" y="32" font-family="Arial" font-size="24" fill="white">12:00</text>
      <text x="${width - 120}" y="32" font-family="Arial" font-size="20" fill="white">📶 🔋</text>
    </svg>
  `;
  return Buffer.from(svg);
}

async function createTabletMockup(inputPath, outputPath, dimensions, sizeName) {
  const { width, height } = dimensions;
  
  // Read the original phone screenshot
  const phoneImage = await sharp(inputPath).metadata();
  
  // Calculate scaling to fit phone content in tablet with padding
  const padding = Math.round(width * 0.08); // 8% padding on sides
  const contentWidth = width - (padding * 2);
  const contentHeight = height - 100; // Leave room for status bar
  
  // Scale phone image to fit content area while maintaining aspect ratio
  const scale = Math.min(
    contentWidth / phoneImage.width,
    contentHeight / phoneImage.height
  );
  
  const scaledWidth = Math.round(phoneImage.width * scale);
  const scaledHeight = Math.round(phoneImage.height * scale);
  
  // Center the content
  const xOffset = Math.round((width - scaledWidth) / 2);
  const yOffset = Math.round((height - scaledHeight) / 2) + 24; // Shift down for status bar
  
  // Resize phone screenshot
  const resizedContent = await sharp(inputPath)
    .resize(scaledWidth, scaledHeight, { fit: 'contain' })
    .png()
    .toBuffer();
  
  // Create tablet background
  const background = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: GREEN
    }
  }).png().toBuffer();
  
  // Create status bar
  const statusBar = await createStatusBar(width, 48);
  
  // Composite everything
  await sharp(background)
    .composite([
      { input: statusBar, top: 0, left: 0 },
      { input: resizedContent, top: yOffset, left: xOffset }
    ])
    .png()
    .toFile(outputPath);
  
  console.log(`✅ Created ${sizeName} mockup: ${outputPath.split('/').pop()}`);
}

async function main() {
  console.log('📱 Creating tablet mockup screenshots...\n');
  
  for (const demo of demos) {
    const inputPath = join(assetsDir, demo);
    const baseName = demo.replace('.png', '');
    
    // Create 7-inch version
    await createTabletMockup(
      inputPath,
      join(assetsDir, `${baseName}-tablet-7inch.png`),
      TABLET_7,
      '7-inch'
    );
    
    // Create 10-inch version
    await createTabletMockup(
      inputPath,
      join(assetsDir, `${baseName}-tablet-10inch.png`),
      TABLET_10,
      '10-inch'
    );
  }
  
  console.log('\n🎉 All tablet mockups created!');
  console.log('\n📁 Files in mobile/assets/:');
  demos.forEach(demo => {
    const baseName = demo.replace('.png', '');
    console.log(`   ${baseName}-tablet-7inch.png`);
    console.log(`   ${baseName}-tablet-10inch.png`);
  });
}

main().catch(console.error);
