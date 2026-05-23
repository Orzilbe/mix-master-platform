const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const LOGO       = path.join(__dirname, '../public/logo.png');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

async function generateIcon(size, filename) {
  const padding  = Math.round(size * 0.12);
  const logoSize = size - padding * 2;

  const bg = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 15, g: 15, b: 15, alpha: 1 } },
  }).png().toBuffer();

  const logo = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 15, g: 15, b: 15, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(bg)
    .composite([{ input: logo, top: padding, left: padding }])
    .png()
    .toFile(path.join(OUTPUT_DIR, filename));

  console.log(`✅ ${filename} (${size}x${size})`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await generateIcon(192, 'icon-192.png');
  await generateIcon(512, 'icon-512.png');
  await generateIcon(180, 'apple-touch-icon.png');
  console.log('🎉 All icons generated in public/icons/');
}

main().catch(err => { console.error(err); process.exit(1); });
