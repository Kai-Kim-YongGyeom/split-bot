import sharp from 'sharp';

async function generateIcons() {
  const sourceImage = 'public/logo-source.jpg';

  // PWA icons
  const sizes = [192, 512];
  for (const size of sizes) {
    await sharp(sourceImage)
      .resize(size, size)
      .png()
      .toFile(`public/icon-${size}.png`);
    console.log(`Generated icon-${size}.png`);
  }

  // Apple touch icon
  await sharp(sourceImage)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');
  console.log('Generated apple-touch-icon.png');

  // Favicon (32x32)
  await sharp(sourceImage)
    .resize(32, 32)
    .png()
    .toFile('public/favicon.png');
  console.log('Generated favicon.png');

  // Also create a larger favicon for browsers that support it
  await sharp(sourceImage)
    .resize(64, 64)
    .png()
    .toFile('public/favicon-64.png');
  console.log('Generated favicon-64.png');
}

generateIcons().catch(console.error);
