/**
 * Convert SVG to PNG using sharp (if available) or provide instructions
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function convertSvgToPng() {
  const assetsDir = join(__dirname, '..', 'assets');
  const svgPath = join(assetsDir, 'icon.svg');
  const svgContent = readFileSync(svgPath, 'utf8');

  try {
    // Try to use sharp if available
    const sharp = await import('sharp');
    
    const sizes = [
      { name: 'icon.png', size: 1024 },
      { name: 'adaptive-icon.png', size: 432 },
      { name: 'splash-icon.png', size: 200 },
      { name: 'favicon.png', size: 48 }
    ];

    console.log('🎨 Converting SVG to PNG...\n');

    for (const { name, size } of sizes) {
      await sharp.default(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toFile(join(assetsDir, name));
      console.log(`✅ Created ${name} (${size}x${size})`);
    }

    console.log('\n🎉 All icons generated!');
  } catch (error) {
    console.log('⚠️  Sharp not installed. Installing now...\n');
    console.log('Run: npm install sharp --save-dev\n');
    console.log('Then run this script again: node mobile/scripts/svg-to-png.js');
  }
}

convertSvgToPng();
