/**
 * Create iPad 12.9"/13" screenshots from phone screenshots
 * Required size: 2048x2732 (portrait) or 2732x2048 (landscape)
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const screenshotsDir = join(__dirname, '..', 'assets', 'screenshots_appstore');
const outputDir = join(__dirname, '..', 'assets', 'screenshots_ipad');

// iPad 12.9"/13" dimensions
const IPAD_WIDTH = 2048;
const IPAD_HEIGHT = 2732;

async function createIPadScreenshots() {
  console.log('🖼️  Creating iPad 12.9"/13" screenshots...\n');
  console.log(`Target size: ${IPAD_WIDTH}x${IPAD_HEIGHT}px\n`);

  // Create output directory
  const { mkdirSync } = await import('fs');
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (e) {}

  // Get all PNG files in screenshots directory
  const files = readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputPath = join(screenshotsDir, file);
    const outputName = `ipad_screenshot_${i + 1}.png`;
    const outputPath = join(outputDir, outputName);

    try {
      // Get original image dimensions
      const metadata = await sharp(inputPath).metadata();
      console.log(`Processing: ${file} (${metadata.width}x${metadata.height})`);

      await sharp(inputPath)
        .resize(IPAD_WIDTH, IPAD_HEIGHT, {
          fit: 'contain',
          background: { r: 22, g: 101, b: 52, alpha: 1 } // Forest green #166534
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Created ${outputName} (${IPAD_WIDTH}x${IPAD_HEIGHT})`);
    } catch (error) {
      console.error(`❌ Failed to create ${outputName}: ${error.message}`);
    }
  }

  console.log(`\n🎉 iPad screenshots created in: ${outputDir}`);
}

createIPadScreenshots().catch(console.error);
