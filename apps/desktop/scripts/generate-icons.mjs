import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, "..", "build");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function roundedRectDistance(px, py, half, radius) {
  const qx = Math.abs(px) - (half - radius);
  const qy = Math.abs(py) - (half - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function blend(target, index, color, alpha) {
  for (let channel = 0; channel < 3; channel++) {
    target[index + channel] = Math.round(target[index + channel] * (1 - alpha) + color[channel] * alpha);
  }
  target[index + 3] = 255;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const nodes = [
    [size * 0.28, size * 0.64],
    [size * 0.5, size * 0.36],
    [size * 0.72, size * 0.64],
  ];
  const cyan = [34, 211, 238];
  const border = [56, 189, 248];
  const lineWidth = size * 0.022;
  const nodeRadius = size * 0.058;
  const innerRadius = size * 0.022;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const t = y / size;
      rgba[index] = Math.round(11 + t * 4);
      rgba[index + 1] = Math.round(18 + t * 9);
      rgba[index + 2] = Math.round(32 + t * 15);
      rgba[index + 3] = 255;

      const borderDistance = Math.abs(roundedRectDistance(x - center, y - center, size * 0.44, size * 0.19));
      if (borderDistance < size * 0.006) blend(rgba, index, border, 0.35);

      for (let n = 0; n < nodes.length - 1; n++) {
        const distance = segmentDistance(x, y, nodes[n][0], nodes[n][1], nodes[n + 1][0], nodes[n + 1][1]);
        if (distance < lineWidth) blend(rgba, index, cyan, 0.85);
      }

      for (const [nx, ny] of nodes) {
        const distance = Math.hypot(x - nx, y - ny);
        if (distance < nodeRadius) blend(rgba, index, cyan, 1);
        if (distance < innerRadius) blend(rgba, index, [11, 18, 32], 1);
      }
    }
  }

  return rgba;
}

function encodeIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}

mkdirSync(buildDir, { recursive: true });
const large = encodePng(512, render(512));
const small = encodePng(256, render(256));
writeFileSync(join(buildDir, "icon.png"), large);
writeFileSync(join(buildDir, "icon.ico"), encodeIco(small, 256));
console.log(`icon.png ${large.length} bytes, icon.ico ${small.length} bytes`);
