import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildIcons() {
  const iconSvg = fs.readFileSync(path.join(__dirname, 'icon.svg'));
  const ogSvg = fs.readFileSync(path.join(__dirname, 'og-image.svg'));

  console.log('Generating PWA icons...');
  
  // icon-192.png
  await sharp(iconSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(__dirname, 'icon-192.png'));
  console.log('✔ icon-192.png');

  // icon-512.png
  await sharp(iconSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, 'icon-512.png'));
  console.log('✔ icon-512.png');

  // apple-touch-icon.png (180x180)
  await sharp(iconSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, 'apple-touch-icon.png'));
  console.log('✔ apple-touch-icon.png');

  // favicon.png (64x64)
  await sharp(iconSvg)
    .resize(64, 64)
    .png()
    .toFile(path.join(__dirname, 'favicon.png'));
  console.log('✔ favicon.png');

  // og-image.png (1200x630)
  await sharp(ogSvg)
    .resize(1200, 630)
    .png()
    .toFile(path.join(__dirname, 'og-image.png'));
  console.log('✔ og-image.png');

  console.log('All icons generated successfully!');
}

buildIcons().catch(err => {
  console.error('Error building icons:', err);
  process.exit(1);
});
