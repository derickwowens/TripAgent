/**
 * Create 512x512 icon for Play Store
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createPlayStoreIcon() {
  const assetsDir = join(__dirname, '..', 'assets');
  const svgPath = join(assetsDir, 'icon.svg');
  const svgContent = readFileSync(svgPath, 'utf8');

  console.log('🎨 Creating Play Store icon (512x512)...\n');

  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(join(assetsDir, 'play-store-icon.png'));

  console.log('✅ Created play-store-icon.png (512x512)');
  console.log('📁 Location: mobile/assets/play-store-icon.png\n');
}

createPlayStoreIcon().catch(console.error);
