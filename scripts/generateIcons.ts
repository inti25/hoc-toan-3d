import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

async function generate() {
  const rootDir = process.cwd();
  const inputLogo = path.join(rootDir, 'public', 'logo.png');
  const iconsDir = path.join(rootDir, 'public', 'icons');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating icons from:', inputLogo);

  // 1. Favicons
  await sharp(inputLogo).resize(16, 16).png().toFile(path.join(iconsDir, 'favicon-16x16.png'));
  await sharp(inputLogo).resize(32, 32).png().toFile(path.join(iconsDir, 'favicon-32x32.png'));
  await sharp(inputLogo).resize(48, 48).png().toFile(path.join(iconsDir, 'favicon-48x48.png'));
  await sharp(inputLogo).resize(32, 32).toFormat('png').toFile(path.join(rootDir, 'public', 'favicon.ico'));

  // 2. Apple Touch Icon (180x180)
  await sharp(inputLogo).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  await sharp(inputLogo).resize(180, 180).png().toFile(path.join(rootDir, 'public', 'apple-touch-icon.png'));

  // 3. PWA Icons (192x192 & 512x512 standard)
  await sharp(inputLogo).resize(192, 192).png().toFile(path.join(iconsDir, 'pwa-192x192.png'));
  await sharp(inputLogo).resize(512, 512).png().toFile(path.join(iconsDir, 'pwa-512x512.png'));

  // 4. PWA Maskable Icon (512x512 with safe-zone padding: logo sized to ~80% = 410px, centered on #194f42 canvas)
  const innerLogo = await sharp(inputLogo).resize(410, 410, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 25, g: 79, b: 66, alpha: 1 } // #194f42 theme green
    }
  })
    .composite([{ input: innerLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'pwa-maskable-512x512.png'));

  // 5. Compact UI Logo for Topbar & Loading screen (~128x128)
  await sharp(inputLogo).resize(128, 128).png({ quality: 90 }).toFile(path.join(iconsDir, 'logo-ui.png'));

  console.log('All icons generated successfully in public/icons and public/!');
}

generate().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
