import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconDir = path.join(__dirname, '..', 'public', 'icons')

if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true })

function createSvg(size) {
  const r = Math.round(size * 0.2)
  const fontSize = Math.round(size * 0.52)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#1a73e8"/>
  <text x="${size/2}" y="${size*0.62}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle">S</text>
</svg>`
}

for (const size of [16, 32, 48, 128]) {
  const svgPath = path.join(iconDir, `icon${size}.png`)
  // Write a minimal valid 1x1 red PNG as placeholder (base64 decoded)
  // Real project: use sharp/jimp to convert SVG to PNG
  const minimalPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
  fs.writeFileSync(svgPath, minimalPng)
  console.log(`Created ${size}x${size} icon placeholder`)
}

// Also save SVGs for reference
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(
    path.join(iconDir, `icon${size}.svg`),
    createSvg(size)
  )
}

console.log('Icons created successfully!')
