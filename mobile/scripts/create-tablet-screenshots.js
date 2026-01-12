/**
 * Create tablet-sized screenshots from phone screenshots
 * 7-inch tablet: 1200x1920 (portrait)
 * 10-inch tablet: 1600x2560 (portrait)
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const assetsDir = join(__dirname, '..', 'assets');

const demos = ['demo1.png', 'demo2.png', 'demo3.png', 'demo4.png'];

const tabletSizes = [
  { name: '7inch', width: 1200, height: 1920 },
  { name: '10inch', width: 1600, height: 2560 }
];

async function createTabletScreenshots() {
  console.log('🖼️  Creating tablet screenshots...\n');

  for (const demo of demos) {
    const inputPath = join(assetsDir, demo);
    const baseName = demo.replace('.png', '');

    for (const size of tabletSizes) {
      const outputName = `${baseName}-${size.name}.png`;
      const outputPath = join(assetsDir, outputName);

      try {
        await sharp(inputPath)
          .resize(size.width, size.height, {
            fit: 'contain',
            background: { r: 22, g: 101, b: 52, alpha: 1 } // Forest green #166534
          })
          .png()
          .toFile(outputPath);

        console.log(`✅ Created ${outputName} (${size.width}x${size.height})`);
      } catch (error) {
        console.error(`❌ Failed to create ${outputName}: ${error.message}`);
      }
    }
  }

  console.log('\n🎉 Tablet screenshots created in mobile/assets/');
  console.log('\nFiles created:');
  demos.forEach(demo => {
    const baseName = demo.replace('.png', '');
    console.log(`  - ${baseName}-7inch.png (1200x1920)`);
    console.log(`  - ${baseName}-10inch.png (1600x2560)`);
  });
}

createTabletScreenshots().catch(console.error);
