/**
 * Genera icon-192.png e icon-512.png desde icons/icon.svg.
 * Ejecutar desde la raíz del proyecto: node tools/export-icons.mjs
 * Requiere: npm install sharp
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconSvg = path.join(root, 'icons', 'icon.svg');
const out192 = path.join(root, 'icons', 'icon-192.png');
const out512 = path.join(root, 'icons', 'icon-512.png');

const sharp = (await import('sharp')).default;
const svg = fs.readFileSync(iconSvg);

await sharp(svg).resize(192, 192).png().toFile(out192);
await sharp(svg).resize(512, 512).png().toFile(out512);

console.log('Creados: icons/icon-192.png, icons/icon-512.png');
