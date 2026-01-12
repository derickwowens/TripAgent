/**
 * Create feature graphic (1024x500) for Play Store
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createFeatureGraphic() {
  const assetsDir = join(__dirname, '..', 'assets');
  const svgPath = join(assetsDir, 'icon.svg');
  const svgContent = readFileSync(svgPath, 'utf8');

  console.log('🎨 Creating feature graphic (1024x500)...\n');

  // Create green background
  const background = await sharp({
    create: {
      width: 1024,
      height: 500,
      channels: 4,
      background: { r: 22, g: 101, b: 52, alpha: 1 } // #166534
    }
  }).png().toBuffer();

  // Resize icon to fit on left side
  const icon = await sharp(Buffer.from(svgContent))
    .resize(300, 300)
    .png()
    .toBuffer();

  // Create text overlay using SVG
  const textSvg = `
    <svg width="1024" height="500">
      <text x="400" y="200" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white">
        TripAgent
      </text>
      <text x="400" y="280" font-family="Arial, sans-serif" font-size="32" fill="white" opacity="0.9">
        AI-Powered National Park Planning
      </text>
      <text x="400" y="340" font-family="Arial, sans-serif" font-size="24" fill="white" opacity="0.8">
        Real-time flights • Hiking trails • Budget breakdowns
      </text>
    </svg>
  `;

  // Composite everything together
  await sharp(background)
    .composite([
      {
        input: icon,
        top: 100,
        left: 50
      },
      {
        input: Buffer.from(textSvg),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toFile(join(assetsDir, 'feature-graphic.png'));

  console.log('✅ Created feature-graphic.png (1024x500)');
  console.log('📁 Location: mobile/assets/feature-graphic.png\n');
}

createFeatureGraphic().catch(console.error);
