import sharp from 'sharp';
import { writeFileSync } from 'fs';

// Robot emoji SVG with dark background for better visibility
const createSvg = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1f2937"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="${size * 0.7}">🤖</text>
</svg>
`;

async function generateIcons() {
  const sizes = [192, 512];

  for (const size of sizes) {
    const svg = Buffer.from(createSvg(size));
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(`public/icon-${size}.png`);

    console.log(`Generated icon-${size}.png`);
  }

  // Also create apple-touch-icon
  const svg180 = Buffer.from(createSvg(180));
  await sharp(svg180)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');

  console.log('Generated apple-touch-icon.png');
}

generateIcons().catch(console.error);
