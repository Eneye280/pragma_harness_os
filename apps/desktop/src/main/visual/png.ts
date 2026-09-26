import { inflateSync } from "zlib";

export interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function paethPredictor(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

export function decodePng(buffer: Buffer): DecodedPng {
  for (let index = 0; index < PNG_SIGNATURE.length; index++) {
    if (buffer[index] !== PNG_SIGNATURE[index]) throw new Error("not a PNG");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth: ${bitDepth}`);
  if (interlace !== 0) throw new Error("interlaced PNG is not supported");
  if (colorType !== 2 && colorType !== 6) throw new Error(`unsupported PNG color type: ${colorType}`);

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);

  for (let row = 0; row < height; row++) {
    const filterType = raw[row * (stride + 1)];
    const rowStart = row * (stride + 1) + 1;
    const current = new Uint8Array(stride);
    for (let column = 0; column < stride; column++) {
      const rawByte = raw[rowStart + column];
      const left = column >= channels ? current[column - channels] : 0;
      const up = previous[column];
      const upLeft = column >= channels ? previous[column - channels] : 0;
      let value = rawByte;
      if (filterType === 1) value = rawByte + left;
      else if (filterType === 2) value = rawByte + up;
      else if (filterType === 3) value = rawByte + Math.floor((left + up) / 2);
      else if (filterType === 4) value = rawByte + paethPredictor(left, up, upLeft);
      current[column] = value & 0xff;
    }
    for (let pixel = 0; pixel < width; pixel++) {
      const source = pixel * channels;
      const target = (row * width + pixel) * 4;
      rgba[target] = current[source];
      rgba[target + 1] = current[source + 1];
      rgba[target + 2] = current[source + 2];
      rgba[target + 3] = channels === 4 ? current[source + 3] : 255;
    }
    previous = current;
  }

  return { width, height, rgba };
}
